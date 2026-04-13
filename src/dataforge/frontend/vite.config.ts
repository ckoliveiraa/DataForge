import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// ── Minimal cron scheduler (no external dependency) ───────────────────────────
interface ScheduledTask { stop(): void }

function _parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    if (part === '*') { for (let i = min; i <= max; i++) values.add(i) }
    else if (part.startsWith('*/')) { const s = parseInt(part.slice(2)); for (let i = min; i <= max; i += s) values.add(i) }
    else if (part.includes('-')) { const [lo, hi] = part.split('-').map(Number); for (let i = lo; i <= hi; i++) values.add(i) }
    else { values.add(parseInt(part)) }
  }
  return values
}

function _nextCronTime(expr: string): Date {
  const [minF, hourF, domF, monF, dowF] = expr.trim().split(/\s+/)
  const mins  = _parseCronField(minF,  0, 59)
  const hours = _parseCronField(hourF, 0, 23)
  const doms  = _parseCronField(domF,  1, 31)
  const mons  = _parseCronField(monF,  1, 12)
  const dows  = _parseCronField(dowF,  0, 6)
  const d = new Date(); d.setUTCSeconds(0, 0); d.setUTCMinutes(d.getUTCMinutes() + 1)
  for (let i = 0; i < 366 * 24 * 60; i++, d.setUTCMinutes(d.getUTCMinutes() + 1)) {
    if (mons.has(d.getUTCMonth() + 1) && doms.has(d.getUTCDate()) &&
        dows.has(d.getUTCDay()) && hours.has(d.getUTCHours()) && mins.has(d.getUTCMinutes()))
      return new Date(d)
  }
  throw new Error(`No next time for cron: ${expr}`)
}

const cron = {
  validate(expr: string): boolean { return expr.trim().split(/\s+/).length === 5 },
  schedule(expr: string, callback: () => void, _opts?: { timezone?: string }): ScheduledTask {
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    const scheduleNext = () => {
      if (stopped) return
      try { const delay = _nextCronTime(expr).getTime() - Date.now(); timer = setTimeout(() => { if (!stopped) { callback(); scheduleNext() } }, Math.max(0, delay)) }
      catch { /* invalid expression */ }
    }
    scheduleNext()
    return { stop() { stopped = true; if (timer !== null) clearTimeout(timer) } }
  }
}

// Read version from pyproject.toml — single source of truth
const pyprojectRaw = readFileSync(resolve(__dirname, '../../../pyproject.toml'), 'utf-8')
const appVersion = pyprojectRaw.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? '0.0.0'

let activeProcess: ReturnType<typeof spawn> | null = null
let browseInProgress = false

// ── Schedule types ────────────────────────────────────────────────────────────
interface DateAnchor {
  table: string
  column: string
  offsetDays: number
}

interface ScheduleConfig {
  yamlStr: string
  tables?: string[]
  rows?: number
  formats?: string[]
  outputDir?: string
  uploadTarget?: string
  bucket?: string
  prefix?: string
  partitionByTable?: Record<string, string>
  partitionDateGranularity?: Record<string, string>
  jsonMode?: string
  seed?: number | null
  dbUrl?: string | null
  ifExists?: string
  dbSchema?: string | null
  recurrence?: number | null
  count?: number | null
  credentials?: string | null
  increments?: { table: string; column: string; step: number; unit: string }[]
  cloudCreds?: Record<string, string>
  workers?: number
  dateAnchors?: DateAnchor[]
}

interface Schedule {
  id: string
  name: string
  cronExpression: string
  enabled: boolean
  config: ScheduleConfig
  createdAt: string
}

interface RunRecord {
  id: string
  scheduleId: string
  scheduleName: string
  triggeredBy: 'cron' | 'manual'
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'error'
  output: string
  exitCode: number | null
}

// ── Persistence helpers ───────────────────────────────────────────────────────
const baseAppDir = resolve(__dirname, '../../../')
const schedulesPath = resolve(baseAppDir, 'output', 'dataforge_schedules.json')
const historyPath = resolve(baseAppDir, 'output', 'dataforge_history.json')

function readSchedules(): Schedule[] {
  try {
    mkdirSync(resolve(baseAppDir, 'output'), { recursive: true })
    return JSON.parse(readFileSync(schedulesPath, 'utf-8'))
  } catch { return [] }
}

function writeSchedules(schedules: Schedule[]): void {
  mkdirSync(resolve(baseAppDir, 'output'), { recursive: true })
  writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8')
}

function readHistory(): RunRecord[] {
  try {
    return JSON.parse(readFileSync(historyPath, 'utf-8'))
  } catch { return [] }
}

function writeHistory(runs: RunRecord[]): void {
  mkdirSync(resolve(baseAppDir, 'output'), { recursive: true })
  // Keep last 200 entries
  writeFileSync(historyPath, JSON.stringify(runs.slice(-200), null, 2), 'utf-8')
}

function newUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const dataDir = resolve(baseAppDir, 'data')
const jwtSecretPath = resolve(dataDir, 'jwt_secret.txt')
const usersFilePath = resolve(dataDir, 'users.json')

interface AuthUser { id: string; username: string; passwordHash: string; salt: string; createdAt: string }

function getJwtSecret(): string {
  try { return readFileSync(jwtSecretPath, 'utf-8').trim() } catch {
    const secret = randomBytes(32).toString('hex')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(jwtSecretPath, secret, 'utf-8')
    return secret
  }
}

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })).toString('base64url')
  const sig = createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const expected = createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url')
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64)
    return timingSafeEqual(derived, Buffer.from(hash, 'hex'))
  } catch { return false }
}

function readUsers(): Record<string, AuthUser> {
  try { return JSON.parse(readFileSync(usersFilePath, 'utf-8')) } catch { return {} }
}

function writeUsers(users: Record<string, AuthUser>): void {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')
}

function envKeysFilePath(username: string): string {
  return resolve(dataDir, 'users', username, 'env_keys.json')
}

function readEnvKeys(username: string): Record<string, string> {
  try { return JSON.parse(readFileSync(envKeysFilePath(username), 'utf-8')) } catch { return {} }
}

function writeEnvKeys(username: string, keys: Record<string, string>): void {
  const p = envKeysFilePath(username)
  mkdirSync(resolve(p, '..'), { recursive: true })
  writeFileSync(p, JSON.stringify(keys, null, 2), 'utf-8')
}

function getAuthUser(req: any): { id: string; username: string } | null {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyToken(auth.slice(7))
  if (!payload || typeof payload.username !== 'string') return null
  return { id: payload.id as string, username: payload.username }
}

// ── Core generate runner (shared by /api/run-cli and schedule runner) ─────────
function buildGenerateArgs(config: ScheduleConfig, targetOut: string, tempSchemaPath: string): { args: string[]; extraEnv: Record<string, string> } {
  const { yamlStr: _y, ..._ } = config
  const {
    formats, rows, tables: tablesToInclude, columns: columnsToInclude,
    jsonMode, seed, partitionByTable, partitionDateGranularity,
    uploadTarget, bucket, prefix, cloudCreds, credentials,
    dbUrl, ifExists, dbSchema,
    recurrence, count, increments, workers, dateAnchors,
  } = config

  const args = ['-c', 'from dataforge.cli import cli; cli()', 'generate', '--domain', 'custom', '--config', tempSchemaPath, '--output', targetOut]

  if (rows) args.push('--rows', String(rows))

  const fmtList: string[] = Array.isArray(formats) && formats.length > 0 ? formats : ['csv']
  for (const fmt of fmtList) args.push('--format', fmt)
  if (fmtList.includes('json') && jsonMode) args.push('--json-mode', jsonMode)

  if (tablesToInclude && Array.isArray(tablesToInclude)) {
    for (const t of tablesToInclude) args.push('--tables', t)
  }
  if (columnsToInclude && Array.isArray(columnsToInclude)) {
    for (const c of columnsToInclude) args.push('--columns', c)
  }
  if (seed !== undefined && seed !== null && seed !== '') args.push('--seed', String(seed))

  if (partitionByTable && typeof partitionByTable === 'object') {
    for (const [table, col] of Object.entries(partitionByTable)) {
      if (col) args.push('--partition-by', `${table}:${col}`)
    }
  }
  if (partitionDateGranularity && typeof partitionDateGranularity === 'object') {
    for (const [table, gran] of Object.entries(partitionDateGranularity)) {
      if (gran === 'year' || gran === 'month') args.push('--partition-date-granularity', `${table}:${gran}`)
    }
  }

  const extraEnv: Record<string, string> = {}
  const credentialsDir = resolve(baseAppDir, 'credentials')

  if (uploadTarget) {
    args.push('--upload', uploadTarget)
    if (bucket?.trim()) args.push('--bucket', bucket.trim())
    if (prefix?.trim()) args.push('--prefix', prefix.trim())

    const creds = cloudCreds ?? {}
    if (uploadTarget === 'gcs') {
      if (creds['gcsJson']?.trim()) {
        const tempGcsKey = join(tmpdir(), `df_gcs_key_${Date.now()}.json`)
        writeFileSync(tempGcsKey, creds['gcsJson'].trim(), 'utf-8')
        args.push('--credentials', tempGcsKey)
      } else if (existsSync(credentialsDir)) {
        const jsonFile = readdirSync(credentialsDir).find(f => f.endsWith('.json'))
        if (jsonFile) args.push('--credentials', resolve(credentialsDir, jsonFile))
      }
    } else if (uploadTarget === 's3') {
      if (creds['s3AccessKey']?.trim() && creds['s3SecretKey']?.trim()) {
        const tempAwsCreds = join(tmpdir(), `df_aws_creds_${Date.now()}.ini`)
        writeFileSync(tempAwsCreds, `[default]\naws_access_key_id = ${creds['s3AccessKey'].trim()}\naws_secret_access_key = ${creds['s3SecretKey'].trim()}\n`, 'utf-8')
        extraEnv['AWS_SHARED_CREDENTIALS_FILE'] = tempAwsCreds
        if (creds['s3Region']?.trim()) extraEnv['AWS_DEFAULT_REGION'] = creds['s3Region'].trim()
      } else if (existsSync(credentialsDir)) {
        const awsFile = readdirSync(credentialsDir).find(f => f === 'credentials' || f.endsWith('.ini') || f.endsWith('.csv'))
        if (awsFile) extraEnv['AWS_SHARED_CREDENTIALS_FILE'] = resolve(credentialsDir, awsFile)
      }
    } else if (uploadTarget === 'azure') {
      if (creds['azureConnStr']?.trim()) {
        extraEnv['AZURE_STORAGE_CONNECTION_STRING'] = creds['azureConnStr'].trim()
      } else if (existsSync(credentialsDir)) {
        const azFile = readdirSync(credentialsDir).find(f => f.endsWith('.txt') || f === 'connection_string')
        if (azFile) extraEnv['AZURE_STORAGE_CONNECTION_STRING'] = readFileSync(resolve(credentialsDir, azFile), 'utf-8').trim()
      }
    }
  }

  if (dbUrl) {
    args.push('--db-url', dbUrl)
    if (ifExists) args.push('--if-exists', ifExists)
    if (dbSchema) args.push('--db-schema', dbSchema)
  }

  if (recurrence !== undefined && recurrence !== null && recurrence !== '') {
    args.push('--recurrence', String(recurrence))
    if (count !== undefined && count !== null && count !== '') args.push('--count', String(count))
  }

  // Merge dateAnchors into increments: compute offset relative to today
  const allIncrements = [...(increments ?? [])]
  if (dateAnchors && dateAnchors.length > 0) {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    for (const anchor of dateAnchors) {
      const targetMs = todayMs + anchor.offsetDays * 86400000
      const offsetDays = Math.round((targetMs - todayMs) / 86400000)
      allIncrements.push({ table: anchor.table, column: anchor.column, step: offsetDays, unit: 'days' })
    }
  }

  for (const inc of allIncrements) {
    if (inc.table && inc.column && inc.step !== undefined && inc.step !== null) {
      args.push('--increment', `${inc.table}:${inc.column}:${inc.step}:${inc.unit || 'days'}`)
    }
  }

  if (workers !== undefined && workers !== null) args.push('--workers', String(workers))

  return { args, extraEnv }
}

// ── Schedule runner ───────────────────────────────────────────────────────────
function runScheduleJob(schedule: Schedule, triggeredBy: 'cron' | 'manual'): Promise<RunRecord> {
  return new Promise(resolve_run => {
    const runId = newUuid()
    const startedAt = new Date().toISOString()

    const isCloud = !!schedule.config.uploadTarget
    const isDbOnly = !!schedule.config.dbUrl && !isCloud
    const useTemp = isCloud || isDbOnly
    const targetOut = useTemp
      ? join(tmpdir(), `dataforge_out_${Date.now()}`)
      : resolve(baseAppDir, schedule.config.outputDir || 'output')
    mkdirSync(targetOut, { recursive: true })

    const tempSchemaPath = join(tmpdir(), `dataforge_schema_${Date.now()}.yaml`)
    writeFileSync(tempSchemaPath, schedule.config.yamlStr)

    const { args, extraEnv } = buildGenerateArgs(schedule.config, targetOut, tempSchemaPath)

    const venvPath = resolve(baseAppDir, '.venv', 'Scripts', 'python.exe')
    const pyExec = existsSync(venvPath) ? venvPath : 'python'

    let output = `$ python ${args.join(' ')}\n`

    const proc = spawn(pyExec, args, {
      cwd: baseAppDir,
      env: { ...process.env, PYTHONPATH: resolve(baseAppDir, 'src'), ...extraEnv }
    })

    proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })

    proc.on('close', (code: number | null) => {
      if (useTemp) {
        try { rmSync(targetOut, { recursive: true, force: true }) } catch {}
      }
      try { rmSync(tempSchemaPath) } catch {}

      const record: RunRecord = {
        id: runId,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        triggeredBy,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: code === 0 ? 'success' : 'error',
        output,
        exitCode: code,
      }

      const history = readHistory()
      history.push(record)
      writeHistory(history)

      resolve_run(record)
    })
  })
}

// ── node-cron registry ────────────────────────────────────────────────────────
const cronTasks = new Map<string, ScheduledTask>()

function registerCronJob(schedule: Schedule): void {
  unregisterCronJob(schedule.id)
  if (!schedule.enabled) return
  if (!cron.validate(schedule.cronExpression)) return

  const task = cron.schedule(schedule.cronExpression, () => {
    console.log(`[dataforge-cron] Firing schedule "${schedule.name}" (${schedule.id})`)
    // Re-read schedule from disk in case config was updated
    const fresh = readSchedules().find(s => s.id === schedule.id)
    if (fresh && fresh.enabled) {
      runScheduleJob(fresh, 'cron').then(r => {
        console.log(`[dataforge-cron] "${schedule.name}" finished — status: ${r.status}`)
      })
    }
  }, { timezone: 'UTC' })

  cronTasks.set(schedule.id, task)
}

function unregisterCronJob(id: string): void {
  const existing = cronTasks.get(id)
  if (existing) {
    existing.stop()
    cronTasks.delete(id)
  }
}

const cliRunnerPlugin = () => ({
  name: 'cli-runner',
  configureServer(server: any) {
    // Initialize cron jobs from persisted schedules on server start
    const initialSchedules = readSchedules()
    for (const s of initialSchedules) {
      if (s.enabled) registerCronJob(s)
    }
    console.log(`[dataforge-cron] Loaded ${initialSchedules.filter(s => s.enabled).length} active schedule(s)`)

    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/capabilities' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ browseFolder: process.platform === 'win32' }))
        return
      }

      if (req.url === '/api/browse-folder' && req.method === 'GET') {
        if (process.platform !== 'win32') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: '', unsupported: true }))
          return
        }
        if (browseInProgress) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: '' }))
          return
        }
        browseInProgress = true
        try {
          const ps1Path = join(tmpdir(), `df_browse_${Date.now()}.ps1`)
          const script = [
            'Add-Type -AssemblyName System.Windows.Forms',
            '$owner = New-Object System.Windows.Forms.Form',
            '$owner.TopMost = $true',
            '$owner.StartPosition = "CenterScreen"',
            '$owner.Size = New-Object System.Drawing.Size(1,1)',
            '$owner.Show()',
            '$owner.Activate()',
            '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
            '$d.ShowNewFolderButton = $true',
            '$r = $d.ShowDialog($owner)',
            '$owner.Dispose()',
            'if ($r -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }',
          ].join('\n')
          writeFileSync(ps1Path, script, 'utf-8')
          const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`, { encoding: 'utf-8', timeout: 60000 }).trim()
          try { rmSync(ps1Path) } catch {}
          browseInProgress = false
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: result }))
        } catch (e: any) {
          browseInProgress = false
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: '', error: e.message }))
        }
        return
      }

      if (req.url === '/api/stop-cli' && req.method === 'POST') {
        if (activeProcess) {
          activeProcess.kill('SIGTERM')
          activeProcess = null
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ stopped: true }))
        } else {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ stopped: false, reason: 'No active process' }))
        }
        return
      }

      if (req.url === '/api/run-cli' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { yamlStr, formats, outputDir, uploadTarget, bucket, prefix, partitionByTable, partitionDateGranularity, jsonMode, seed, dbUrl, ifExists, dbSchema, recurrence, count, credentials, rows, tables: tablesToInclude, columns: columnsToInclude, increments, cloudCreds, workers } = data;

            const baseDir = resolve(__dirname, '../../../');
            // Cloud and database-only runs use a temp dir that is cleaned up after
            const isCloud = !!uploadTarget;
            const isDbOnly = !!dbUrl && !isCloud;
            const useTemp = isCloud || isDbOnly;
            const targetOut = useTemp
              ? join(tmpdir(), `dataforge_out_${Date.now()}`)
              : resolve(baseDir, outputDir || 'output');
            mkdirSync(targetOut, { recursive: true });

            // Write the current UI schema to a system temporary file so we don't pollute the user's output dir
            const tempSchemaPath = join(tmpdir(), `dataforge_schema_${Date.now()}.yaml`);
            writeFileSync(tempSchemaPath, yamlStr);

            // Prepare CLI arguments
            const args = ['-c', 'from dataforge.cli import cli; cli()', 'generate', '--domain', 'custom', '--config', tempSchemaPath, '--output', targetOut];
            if (rows) {
              args.push('--rows', String(rows));
            }
            const fmtList: string[] = Array.isArray(formats) && formats.length > 0 ? formats : ['csv'];
            for (const fmt of fmtList) {
              args.push('--format', fmt);
            }
            if (fmtList.includes('json') && jsonMode) {
              args.push('--json-mode', jsonMode);
            }
            if (tablesToInclude && Array.isArray(tablesToInclude)) {
              for (const t of tablesToInclude) args.push('--tables', t);
            }
            if (columnsToInclude && Array.isArray(columnsToInclude)) {
              for (const c of columnsToInclude) args.push('--columns', c);
            }
            if (seed !== undefined && seed !== null && seed !== '') {
              args.push('--seed', String(seed));
            }
            if (partitionByTable && typeof partitionByTable === 'object') {
              for (const [table, col] of Object.entries(partitionByTable as Record<string, string>)) {
                if (col) args.push('--partition-by', `${table}:${col}`);
              }
            }
            if (partitionDateGranularity && typeof partitionDateGranularity === 'object') {
              for (const [table, gran] of Object.entries(partitionDateGranularity as Record<string, string>)) {
                if (gran === 'year' || gran === 'month') args.push('--partition-date-granularity', `${table}:${gran}`);
              }
            }
            // Resolve credentials: UI input takes priority, falls back to credentials/ folder
            const credentialsDir = resolve(baseDir, 'credentials');
            const extraEnv: Record<string, string> = {};
            if (uploadTarget) {
              args.push('--upload', uploadTarget);
              if (bucket?.trim()) args.push('--bucket', bucket.trim());
              if (prefix?.trim()) args.push('--prefix', prefix.trim());

              const creds = cloudCreds ?? {};

              if (uploadTarget === 'gcs') {
                if (creds.gcsJson?.trim()) {
                  // Write JSON key to temp file
                  const tempGcsKey = join(tmpdir(), `df_gcs_key_${Date.now()}.json`);
                  writeFileSync(tempGcsKey, creds.gcsJson.trim(), 'utf-8');
                  args.push('--credentials', tempGcsKey);
                } else if (existsSync(credentialsDir)) {
                  const jsonFile = readdirSync(credentialsDir).find(f => f.endsWith('.json'));
                  if (jsonFile) args.push('--credentials', resolve(credentialsDir, jsonFile));
                }
              } else if (uploadTarget === 's3') {
                if (creds.s3AccessKey?.trim() && creds.s3SecretKey?.trim()) {
                  // Write AWS credentials file to temp
                  const tempAwsCreds = join(tmpdir(), `df_aws_creds_${Date.now()}.ini`);
                  const awsContent = `[default]\naws_access_key_id = ${creds.s3AccessKey.trim()}\naws_secret_access_key = ${creds.s3SecretKey.trim()}\n`;
                  writeFileSync(tempAwsCreds, awsContent, 'utf-8');
                  extraEnv['AWS_SHARED_CREDENTIALS_FILE'] = tempAwsCreds;
                  if (creds.s3Region?.trim()) extraEnv['AWS_DEFAULT_REGION'] = creds.s3Region.trim();
                } else if (existsSync(credentialsDir)) {
                  const awsFile = readdirSync(credentialsDir).find(f => f === 'credentials' || f.endsWith('.ini') || f.endsWith('.csv'));
                  if (awsFile) extraEnv['AWS_SHARED_CREDENTIALS_FILE'] = resolve(credentialsDir, awsFile);
                }
              } else if (uploadTarget === 'azure') {
                if (creds.azureConnStr?.trim()) {
                  extraEnv['AZURE_STORAGE_CONNECTION_STRING'] = creds.azureConnStr.trim();
                } else if (existsSync(credentialsDir)) {
                  const azFile = readdirSync(credentialsDir).find(f => f.endsWith('.txt') || f === 'connection_string');
                  if (azFile) extraEnv['AZURE_STORAGE_CONNECTION_STRING'] = readFileSync(resolve(credentialsDir, azFile), 'utf-8').trim();
                }
              }
            }
            if (dbUrl) {
              args.push('--db-url', dbUrl);
              if (ifExists) args.push('--if-exists', ifExists);
              if (dbSchema) args.push('--db-schema', dbSchema);
            }
            if (recurrence !== undefined && recurrence !== null && recurrence !== '') {
              args.push('--recurrence', String(recurrence));
              if (count !== undefined && count !== null && count !== '') {
                args.push('--count', String(count));
              }
            }
            if (increments && Array.isArray(increments)) {
              for (const inc of increments) {
                if (inc.table && inc.column && inc.step !== '' && inc.step !== undefined) {
                  args.push('--increment', `${inc.table}:${inc.column}:${inc.step}:${inc.unit || 'days'}`);
                }
              }
            }
            if (workers !== undefined && workers !== null && workers !== '') {
              args.push('--workers', String(workers));
            }

            const venvPath = resolve(baseDir, '.venv', 'Scripts', 'python.exe');
            const pyExec = existsSync(venvPath) ? venvPath : 'python';

            console.log('Running python', [pyExec, ...args].join(' '));

            // Stream output via SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

            send({ type: 'cmd', text: `$ python ${args.join(' ')}\n` });

            const pythonProcess = spawn(pyExec, args, {
              cwd: baseDir,
              env: { ...process.env, PYTHONPATH: resolve(baseDir, 'src'), ...extraEnv }
            });
            activeProcess = pythonProcess;

            pythonProcess.stdout.on('data', (chunk: Buffer) => send({ type: 'out', text: chunk.toString() }));
            pythonProcess.stderr.on('data', (chunk: Buffer) => send({ type: 'out', text: chunk.toString() }));

            pythonProcess.on('close', (code: number | null) => {
              activeProcess = null;
              if (useTemp) {
                try { rmSync(targetOut, { recursive: true, force: true }); } catch {}
              }
              const stopped = code === null;
              send({ type: 'done', success: !stopped && code === 0, stopped });
              res.end();
            });

            // Process lifecycle is controlled exclusively by /api/stop-cli (explicit Stop button).
            // Do NOT kill on req.close — SSE connections drop on HMR, focus loss or slow networks
            // (e.g. remote DB on Render), which would abort a valid in-flight run.
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }
      const schemasDir = resolve(__dirname, '../../../src/dataforge/schemas');

      if (req.url === '/api/schemas' && req.method === 'GET') {
        try {
          const files = readdirSync(schemasDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
          const names = files.map(f => f.replace(/\.(yaml|yml)$/, ''));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(names));
        } catch {
          res.end(JSON.stringify([]));
        }
        return;
      }

      const schemaMatch = req.url?.match(/^\/api\/schemas\/([a-z0-9_-]+)$/);
      if (schemaMatch && req.method === 'GET') {
        try {
          const name = schemaMatch[1];
          const content = readFileSync(resolve(schemasDir, `${name}.yaml`), 'utf-8');
          res.setHeader('Content-Type', 'text/plain');
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
        return;
      }

      if (req.url === '/api/test-db-connection' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { dbUrl } = JSON.parse(body);
            if (!dbUrl || typeof dbUrl !== 'string' || !dbUrl.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'DB URL is required.' }));
              return;
            }
            const baseDir = resolve(__dirname, '../../../');
            const venvPath = resolve(baseDir, '.venv', 'Scripts', 'python.exe');
            const pyExec = existsSync(venvPath) ? venvPath : 'python';
            const testScript = [
              'import sys',
              'try:',
              '    from sqlalchemy import create_engine, text',
              `    engine = create_engine(${JSON.stringify(dbUrl)})`,
              '    with engine.connect() as conn:',
              '        conn.execute(text("SELECT 1"))',
              '    print("OK")',
              'except Exception as e:',
              '    print("ERR:" + str(e), file=sys.stderr)',
              '    sys.exit(1)',
            ].join('\n');
            const proc = spawn(pyExec, ['-c', testScript], {
              cwd: baseDir,
              env: { ...process.env, PYTHONPATH: resolve(baseDir, 'src') }
            });
            let stderr = '';
            proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code: number | null) => {
              res.setHeader('Content-Type', 'application/json');
              if (code === 0) {
                res.end(JSON.stringify({ success: true }));
              } else {
                const msg = stderr.replace(/^ERR:/, '').trim() || 'Connection failed.';
                res.end(JSON.stringify({ success: false, error: msg }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
        });
        return;
      }

      const deleteMatch = req.url?.match(/^\/api\/schemas\/([a-z0-9_-]+)$/);
      if (deleteMatch && req.method === 'DELETE') {
        try {
          const name = deleteMatch[1];
          const filePath = resolve(schemasDir, `${name}.yaml`);
          if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Schema not found.' }));
            return;
          }
          rmSync(filePath);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message || String(e) }));
        }
        return;
      }

      if (req.url === '/api/ai-models' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { provider, apiKey } = JSON.parse(body);
            let models: string[] = [];

            if (provider === 'anthropic') {
              const r = await fetch('https://api.anthropic.com/v1/models', {
                headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
              });
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d.data ?? []).map((m: any) => m.id).sort();

            } else if (provider === 'openai') {
              const r = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d.data ?? [])
                .map((m: any) => m.id as string)
                .filter((id: string) => id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3'))
                .sort();

            } else if (provider === 'google') {
              const r = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
              );
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              const candidates: string[] = (d.models ?? [])
                .filter((m: any) =>
                  Array.isArray(m.supportedGenerationMethods) &&
                  m.supportedGenerationMethods.includes('generateContent')
                )
                .map((m: any) => (m.name as string).replace('models/', ''));

              // Probe each model with a minimal request to filter out quota-exceeded ones
              const probeBody = JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
              });
              const probeResults = await Promise.all(
                candidates.map(async (modelId) => {
                  try {
                    const probe = await fetch(
                      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
                      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: probeBody }
                    );
                    return probe.ok ? modelId : null;
                  } catch {
                    return null;
                  }
                })
              );
              models = probeResults.filter((m): m is string => m !== null).sort();

            } else if (provider === 'groq') {
              const r = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d.data ?? []).map((m: any) => m.id as string).sort();

            } else if (provider === 'mistral') {
              const r = await fetch('https://api.mistral.ai/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d.data ?? []).map((m: any) => m.id as string).sort();

            } else if (provider === 'together') {
              const r = await fetch('https://api.together.xyz/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d ?? [])
                .map((m: any) => m.id as string)
                .filter((id: string) => /(instruct|chat)/i.test(id))
                .sort();

            } else if (provider === 'ollama') {
              const r = await fetch('http://localhost:11434/api/tags');
              if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
              const d: any = await r.json();
              models = (d.models ?? []).map((m: any) => m.name as string).sort();

            } else {
              throw new Error(`Unknown provider "${provider}"`);
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ models }));
          } catch (e: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      if (req.url === '/api/ai-generate' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { provider, apiKey, model, prompt } = JSON.parse(body);
            // Ollama is local and doesn't need an API key
            if (!apiKey && provider !== 'ollama') {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'apiKey is required for this provider.' }));
              return;
            }
            if (!prompt) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'prompt is required.' }));
              return;
            }
            // model is optional — only included in API calls when provided
            const modelField = (model && typeof model === 'string' && model.trim()) ? model.trim() : undefined;

            // ─── SYSTEM PROMPT (role instructions) ──────────────────────────────────
            const systemPrompt = `You are a Dataforge schema generator. Dataforge is a synthetic dataset generation tool.
Your sole task: read the user's dataset description and output a valid Dataforge YAML schema.

Critical output rules:
- Output ONLY raw YAML — no markdown fences (\`\`\`), no prose, no explanation, no trailing text.
- Follow the format spec and rules in the user message exactly.
- Self-contained dtypes (name, email, phone, city, country, address, company, text, url, currency, iban, bool, int_seq, uuid) never need faker_provider or choices — omit them.
- dtype: str always needs either choices:[...] or faker_provider:<name> — never omit both.
- min/max only on int, float, date — never on any other dtype.
- Every table must have exactly one primary_key column (dtype: int_seq or uuid).`;

            // ─── FORMAT SPEC + FEW-SHOT EXAMPLE (injected into every user message) ──
            // Embedding the spec in the user turn guarantees models that ignore system
            // prompts (local Llama, some fine-tunes) still receive the full format.
            const formatSpec = `Output ONLY valid Dataforge YAML. No markdown fences, no explanation, no comments.

════════════════════════════════════════
STRUCTURE
════════════════════════════════════════
domain: <snake_case_name>
tables:
  <table_name>:
    rows: <int>
    columns:
      <column_name>:
        dtype: <dtype>
        primary_key: true      # exactly one per table; only on int_seq or uuid columns
        nullable: 0.0          # float 0.0–1.0; omit if not nullable
        faker_provider: <name> # only for dtype: str when no choices; never on other dtypes
        choices: [A, B, C]     # only for dtype: str enums; never on other dtypes
        min: <val>             # only for dtype: int, float, or date
        max: <val>             # only for dtype: int, float, or date
        foreign_key:
          table: <target_table>
          column: <pk_column_of_target>

════════════════════════════════════════
DTYPE REFERENCE  (choose exactly one per column)
════════════════════════════════════════
SELF-CONTAINED (generate data automatically — do NOT add faker_provider or choices):
  int_seq   → auto-increment integer (use for primary keys)
  uuid      → UUID string (use for primary keys)
  bool      → true/false
  email     → realistic e-mail address
  name      → full person name
  phone     → phone number
  address   → street address
  city      → city name
  country   → country name
  company   → company name
  text      → paragraph of text
  url       → web URL
  currency  → currency code (e.g. USD, BRL)
  iban      → bank account number

NUMERIC (support min/max):
  int       → integer; use min/max to constrain range
  float     → decimal; use min/max to constrain range

DATE (supports min/max with relative notation: -1y, -6M, -30d, today, +1y):
  date      → calendar date

NEEDS choices OR faker_provider:
  str       → MUST always have either choices:[...] or faker_provider:<name>

FAKER PROVIDERS (use only with dtype: str):
  first_name, last_name, job, user_name, postcode, slug, bothify,
  catch_phrase, bs, color_name, language_code, locale, ipv4,
  credit_card_number, latitude, longitude, currency_code, pricetag

════════════════════════════════════════
RULES  (all are mandatory — violating any will break generation)
════════════════════════════════════════
RULE 1 — str MUST have choices or faker_provider:
  BAD:  status: {dtype: str}
  GOOD: status: {dtype: str, choices: [active, inactive, suspended]}
  GOOD: role:   {dtype: str, faker_provider: job}

RULE 2 — Every table needs exactly ONE primary_key (dtype int_seq or uuid):
  BAD:  table with no primary_key column
  BAD:  table with two columns having primary_key: true
  GOOD: id: {dtype: int_seq, primary_key: true}

RULE 3 — foreign_key.column must be the PK column of the referenced table:
  BAD:  foreign_key: {table: orders, column: status}   # status is not a PK
  GOOD: foreign_key: {table: orders, column: id}       # id is the PK

RULE 4 — min/max only on int, float, or date — never on bool/str/email/name/phone/etc.:
  BAD:  email: {dtype: email, min: 1, max: 100}
  BAD:  status: {dtype: str, min: 0}
  GOOD: price: {dtype: float, min: 0.5, max: 9999}
  GOOD: birth_date: {dtype: date, min: -70y, max: -18y}

RULE 5 — nullable must be a decimal between 0.0 and 1.0:
  BAD:  nullable: true
  BAD:  nullable: 50%
  GOOD: nullable: 0.3

RULE 6 — domain must be snake_case:
  BAD:  domain: My Dataset
  BAD:  domain: my-dataset
  GOOD: domain: my_dataset

RULE 7 — Self-contained dtypes (name, email, phone, city, country, address, company, text,
  url, currency, iban, bool, int_seq, uuid) do NOT need faker_provider or choices.
  Adding them is wrong and will be ignored or cause errors.
  BAD:  name_col: {dtype: name, faker_provider: name}
  BAD:  email_col: {dtype: email, faker_provider: email}
  GOOD: full_name: {dtype: name}
  GOOD: contact_email: {dtype: email}

════════════════════════════════════════
EXAMPLE (copy this style exactly)
════════════════════════════════════════
domain: shop
tables:
  customers:
    rows: 1000
    columns:
      id:
        dtype: int_seq
        primary_key: true
      full_name:
        dtype: name
      email:
        dtype: email
      phone:
        dtype: phone
        nullable: 0.1
      city:
        dtype: city
      segment:
        dtype: str
        choices: [retail, wholesale, vip]
      registered_at:
        dtype: date
        min: -3y
        max: today
  orders:
    rows: 5000
    columns:
      id:
        dtype: int_seq
        primary_key: true
      customer_id:
        dtype: int
        foreign_key:
          table: customers
          column: id
      status:
        dtype: str
        choices: [pending, processing, shipped, delivered, cancelled]
      total:
        dtype: float
        min: 5
        max: 3000
      discount:
        dtype: float
        min: 0
        max: 500
        nullable: 0.6
      note:
        dtype: text
        nullable: 0.8
      created_at:
        dtype: date
        min: -2y
        max: today

════════════════════════════════════════
DATASET DESCRIPTION:
════════════════════════════════════════
`;

            // Final message sent as the user turn
            const fullUserMessage = formatSpec + prompt;

            // ─── HELPERS ────────────────────────────────────────────────────────────
            // Calls the selected provider with a given user message and returns raw text.
            const callProvider = async (userMsg: string): Promise<string> => {
              const openAIMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg },
              ];
              const buildOpenAIBody = (extraModel?: string) => {
                const body: Record<string, any> = {
                  max_tokens: 3000,
                  temperature: 0.1,
                  messages: openAIMessages,
                };
                const m = modelField ?? extraModel;
                if (m) body.model = m;
                return body;
              };
              const callOpenAICompat = async (baseUrl: string, key: string) => {
                const response = await fetch(`${baseUrl}/chat/completions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                  body: JSON.stringify(buildOpenAIBody()),
                });
                if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
                const data: any = await response.json();
                return (data.choices?.[0]?.message?.content ?? '') as string;
              };

              if (provider === 'anthropic') {
                const anthropicBody: Record<string, any> = {
                  max_tokens: 3000,
                  temperature: 0.1,
                  system: systemPrompt,
                  messages: [{ role: 'user', content: userMsg }],
                };
                if (modelField) anthropicBody.model = modelField;
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify(anthropicBody),
                });
                if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
                const data: any = await response.json();
                return data.content?.[0]?.text ?? '';

              } else if (provider === 'openai') {
                return callOpenAICompat('https://api.openai.com/v1', apiKey);

              } else if (provider === 'google') {
                if (!modelField) throw new Error('Google requires a model name. Fill in the Model field (e.g. gemini-1.5-flash or gemini-2.0-flash-lite).');
                const googleModelId = modelField.replace(/^models\//, '');
                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${googleModelId}:generateContent?key=${apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      systemInstruction: { parts: [{ text: systemPrompt }] },
                      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
                      generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
                    }),
                  }
                );
                if (!response.ok) throw new Error(`Google API error ${response.status}: ${await response.text()}`);
                const data: any = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

              } else if (provider === 'groq') {
                return callOpenAICompat('https://api.groq.com/openai/v1', apiKey);

              } else if (provider === 'mistral') {
                return callOpenAICompat('https://api.mistral.ai/v1', apiKey);

              } else if (provider === 'together') {
                return callOpenAICompat('https://api.together.xyz/v1', apiKey);

              } else if (provider === 'ollama') {
                const response = await fetch('http://localhost:11434/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(buildOpenAIBody()),
                });
                if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
                const data: any = await response.json();
                return data.choices?.[0]?.message?.content ?? '';

              } else {
                throw new Error(`Unknown provider "${provider}".`);
              }
            };

            // Validates the raw YAML string. Returns null on success or an error message.
            const { parse: parseYaml } = await import('yaml');
            const validateYaml = (raw: string): string | null => {
              if (!raw) return 'A IA retornou uma resposta vazia.';
              try {
                parseYaml(raw);
                return null;
              } catch (e: any) {
                const msg: string = e?.message ?? String(e);
                if (msg.includes('Map keys must be unique')) {
                  const lineMatch = msg.match(/line (\d+)/i);
                  const location = lineMatch ? ` (linha ${lineMatch[1]})` : '';
                  return `Colunas com nomes duplicados${location} — use nomes únicos em cada tabela.`;
                }
                return `YAML inválido: ${msg}`;
              }
            };

            // ─── GENERATION WITH AUTO-RETRY ─────────────────────────────────────────
            // Up to MAX_RETRIES additional attempts after the first. On each retry the
            // error and the bad YAML are fed back to the model as correction context.
            const MAX_RETRIES = 2;
            let yamlResult = '';
            let lastValidationError = '';
            let lastBadYaml = '';
            let succeeded = false;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              // On retries, augment the prompt with the error and the bad output.
              let userMsg = fullUserMessage;
              if (attempt > 0) {
                userMsg =
                  fullUserMessage +
                  `\n\n════════════════════════════════════════\n` +
                  `PREVIOUS ATTEMPT ${attempt}/${MAX_RETRIES} PRODUCED INVALID YAML.\n` +
                  `Error: ${lastValidationError}\n\n` +
                  `Invalid YAML produced:\n${lastBadYaml}\n\n` +
                  `Rewrite the ENTIRE schema from scratch, fixing every error listed above.\n` +
                  `Output ONLY the corrected YAML — no explanation, no markdown fences.\n` +
                  `════════════════════════════════════════\n`;
              }

              const raw = await callProvider(userMsg);
              // Strip markdown code fences if the model adds them despite instructions
              yamlResult = raw.replace(/^```(?:yaml)?\n?/m, '').replace(/\n?```$/m, '').trim();

              const validationError = validateYaml(yamlResult);
              if (!validationError) {
                succeeded = true;
                break;
              }

              lastValidationError = validationError;
              lastBadYaml = yamlResult;
            }

            if (!succeeded) {
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: `A IA não conseguiu gerar um YAML válido após ${MAX_RETRIES + 1} tentativas. Último erro: ${lastValidationError}`,
                yaml: lastBadYaml,
              }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ yaml: yamlResult }));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      if (req.url === '/api/save-schema' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { yamlStr, name } = JSON.parse(body);
            if (!name || !/^[a-z0-9_-]+$/.test(name)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid name. Use only lowercase letters, numbers, hyphens and underscores.' }));
              return;
            }
            mkdirSync(schemasDir, { recursive: true });
            writeFileSync(resolve(schemasDir, `${name}.yaml`), yamlStr, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      // ── Credentials profiles ──────────────────────────────────────────────
      const profilesPath = resolve(resolve(__dirname, '../../../'), 'credentials', 'profiles.json')

      const readProfiles = (): Record<string, any> => {
        try { return JSON.parse(readFileSync(profilesPath, 'utf-8')); } catch { return {}; }
      }
      const writeProfiles = (data: Record<string, any>) => {
        mkdirSync(resolve(profilesPath, '..'), { recursive: true });
        writeFileSync(profilesPath, JSON.stringify(data, null, 2), 'utf-8');
      }

      if (req.url === '/api/credential-profiles' && req.method === 'GET') {
        const profiles = readProfiles();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(Object.keys(profiles).map(name => ({ name, provider: profiles[name].provider }))));
        return;
      }

      if (req.url === '/api/credential-profiles' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { name, provider, creds } = JSON.parse(body);
            if (!name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Name is required.' })); return; }
            const profiles = readProfiles();
            profiles[name.trim()] = { provider, creds };
            writeProfiles(profiles);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      const credProfileMatch = req.url?.match(/^\/api\/credential-profiles\/(.+)$/);
      if (credProfileMatch && req.method === 'DELETE') {
        const name = decodeURIComponent(credProfileMatch[1]);
        const profiles = readProfiles();
        delete profiles[name];
        writeProfiles(profiles);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (credProfileMatch && req.method === 'GET') {
        const name = decodeURIComponent(credProfileMatch[1]);
        const profiles = readProfiles();
        if (!profiles[name]) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(profiles[name]));
        return;
      }

      // ── Schedules API ─────────────────────────────────────────────────────

      if (req.url === '/api/schedules' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(readSchedules()));
        return;
      }

      if (req.url === '/api/schedules' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { name, cronExpression, config } = JSON.parse(body);
            if (!name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: 'name is required' })); return; }
            if (!cronExpression?.trim() || !cron.validate(cronExpression.trim())) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid cron expression' })); return;
            }
            if (!config?.yamlStr?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: 'config.yamlStr is required' })); return; }
            const schedule: Schedule = {
              id: newUuid(),
              name: name.trim(),
              cronExpression: cronExpression.trim(),
              enabled: true,
              config,
              createdAt: new Date().toISOString(),
            };
            const schedules = readSchedules();
            schedules.push(schedule);
            writeSchedules(schedules);
            registerCronJob(schedule);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(schedule));
          } catch (e: any) {
            res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      const scheduleIdMatch = req.url?.match(/^\/api\/schedules\/([a-z0-9-]+)$/);

      if (scheduleIdMatch && req.method === 'PUT') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const id = scheduleIdMatch[1];
            const patch = JSON.parse(body);
            let schedules = readSchedules();
            const idx = schedules.findIndex(s => s.id === id);
            if (idx === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
            if (patch.cronExpression && !cron.validate(patch.cronExpression)) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid cron expression' })); return;
            }
            schedules[idx] = { ...schedules[idx], ...patch };
            writeSchedules(schedules);
            // Re-register (handles enable/disable/expression changes)
            if (schedules[idx].enabled) {
              registerCronJob(schedules[idx]);
            } else {
              unregisterCronJob(id);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(schedules[idx]));
          } catch (e: any) {
            res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      if (scheduleIdMatch && req.method === 'DELETE') {
        const id = scheduleIdMatch[1];
        let schedules = readSchedules();
        if (!schedules.find(s => s.id === id)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
        unregisterCronJob(id);
        schedules = schedules.filter(s => s.id !== id);
        writeSchedules(schedules);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      const scheduleRunMatch = req.url?.match(/^\/api\/schedules\/([a-z0-9-]+)\/run$/);
      if (scheduleRunMatch && req.method === 'POST') {
        const id = scheduleRunMatch[1];
        const schedule = readSchedules().find(s => s.id === id);
        if (!schedule) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
        // Fire and return immediately with the run ID; client polls /api/run-history
        const runId = newUuid();
        const startedAt = new Date().toISOString();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ runId, startedAt }));
        runScheduleJob(schedule, 'manual').then(r => {
          console.log(`[dataforge-cron] Manual run "${schedule.name}" finished — status: ${r.status}`);
        });
        return;
      }

      if (req.url?.startsWith('/api/run-history') && req.method === 'GET') {
        const urlObj = new URL(req.url, 'http://localhost');
        const filterScheduleId = urlObj.searchParams.get('scheduleId');
        const limit = parseInt(urlObj.searchParams.get('limit') ?? '100', 10);
        let history = readHistory();
        if (filterScheduleId) history = history.filter(r => r.scheduleId === filterScheduleId);
        // Return most recent first
        history = history.slice().reverse().slice(0, limit);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(history));
        return;
      }

      // ── Auth endpoints ────────────────────────────────────────────────────
      if (req.url === '/api/auth/register' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { username, password } = JSON.parse(body);
            if (!username?.trim() || !password) {
              res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Username and password are required.' })); return;
            }
            const clean = username.trim().toLowerCase();
            if (!/^[a-z0-9_-]{3,32}$/.test(clean)) {
              res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Username must be 3–32 characters (letters, numbers, _ or -).' })); return;
            }
            if (password.length < 6) {
              res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password must be at least 6 characters.' })); return;
            }
            const users = readUsers();
            if (users[clean]) {
              res.statusCode = 409; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Username already taken.' })); return;
            }
            const { hash, salt } = hashPassword(password);
            const user: AuthUser = { id: newUuid(), username: clean, passwordHash: hash, salt, createdAt: new Date().toISOString() };
            users[clean] = user;
            writeUsers(users);
            const token = signToken({ id: user.id, username: user.username });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ token, username: user.username }));
          } catch (e: any) {
            res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      if (req.url === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { username, password } = JSON.parse(body);
            if (!username?.trim() || !password) {
              res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Username and password are required.' })); return;
            }
            const clean = username.trim().toLowerCase();
            const users = readUsers();
            const user = users[clean];
            if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
              res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid username or password.' })); return;
            }
            const token = signToken({ id: user.id, username: user.username });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ token, username: user.username }));
          } catch (e: any) {
            res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      if (req.url === '/api/auth/me' && req.method === 'GET') {
        const authUser = getAuthUser(req);
        if (!authUser) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ username: authUser.username }));
        return;
      }

      // ── Profile env-keys endpoints ────────────────────────────────────────
      if (req.url === '/api/profile/env-keys' && req.method === 'GET') {
        const authUser = getAuthUser(req);
        if (!authUser) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        const keys = readEnvKeys(authUser.username);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(keys));
        return;
      }

      if (req.url === '/api/profile/env-keys' && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (!authUser) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { key, value } = JSON.parse(body);
            if (!key?.trim()) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Key is required.' })); return; }
            if (!/^[A-Z0-9_]+$/.test(key.trim())) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Key must be uppercase letters, numbers and underscores (e.g. AWS_ACCESS_KEY).' })); return; }
            const keys = readEnvKeys(authUser.username);
            keys[key.trim()] = value ?? '';
            writeEnvKeys(authUser.username, keys);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || String(e) }));
          }
        });
        return;
      }

      const envKeyMatch = req.url?.match(/^\/api\/profile\/env-keys\/(.+)$/);
      if (envKeyMatch && req.method === 'DELETE') {
        const authUser = getAuthUser(req);
        if (!authUser) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        const keyName = decodeURIComponent(envKeyMatch[1]);
        const keys = readEnvKeys(authUser.username);
        delete keys[keyName];
        writeEnvKeys(authUser.username, keys);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cliRunnerPlugin()],
  define: {
    // Injected at build time from pyproject.toml — not available as a .env file
    // because the version is the Python package's single source of truth.
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',  // Required for Docker
    port: 5173,
    allowedHosts: 'all',
    fs: {
      allow: ['../schemas', '.']
    }
  },
  // dagre is a CommonJS library — pre-bundle it so Vite doesn't fail in dev mode
  // See: https://vitejs.dev/config/dep-optimization-options#optimizedeps-include
  optimizeDeps: {
    include: ['dagre'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-flow': ['reactflow', 'dagre'],
          'vendor-yaml': ['yaml'],
        }
      }
    }
  }
})
