import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

// Read version from pyproject.toml — single source of truth
const pyprojectRaw = readFileSync(resolve(__dirname, '../../../pyproject.toml'), 'utf-8')
const appVersion = pyprojectRaw.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? '0.0.0'

let activeProcess: ReturnType<typeof spawn> | null = null
let browseInProgress = false

const cliRunnerPlugin = () => ({
  name: 'cli-runner',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/browse-folder' && req.method === 'GET') {
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
            const { yamlStr, formats, outputDir, uploadTarget, bucket, prefix, partitionByTable, jsonMode, seed, dbUrl, ifExists, dbSchema, recurrence, count, credentials, rows, tables: tablesToInclude, columns: columnsToInclude, increments } = data;

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
            // Resolve credentials from the fixed credentials/ folder
            const credentialsDir = resolve(baseDir, 'credentials');
            const extraEnv: Record<string, string> = {};
            if (uploadTarget) {
              args.push('--upload', uploadTarget);
              if (bucket?.trim()) args.push('--bucket', bucket.trim());
              if (prefix?.trim()) args.push('--prefix', prefix.trim());

              if (existsSync(credentialsDir)) {
                const credFiles = readdirSync(credentialsDir);
                if (uploadTarget === 'gcs') {
                  const jsonFile = credFiles.find(f => f.endsWith('.json'));
                  if (jsonFile) args.push('--credentials', resolve(credentialsDir, jsonFile));
                } else if (uploadTarget === 's3') {
                  const awsFile = credFiles.find(f => f === 'credentials' || f.endsWith('.ini') || f.endsWith('.csv'));
                  if (awsFile) extraEnv['AWS_SHARED_CREDENTIALS_FILE'] = resolve(credentialsDir, awsFile);
                } else if (uploadTarget === 'azure') {
                  const azFile = credFiles.find(f => f.endsWith('.txt') || f === 'connection_string');
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
            const systemPrompt = `You are a Dataforge schema generator. Dataforge is a synthetic dataset tool.
Your sole task: read the user's dataset description and output a valid Dataforge YAML schema.
Output ONLY the raw YAML — no prose, no markdown fences, no comments outside the schema.`;

            // ─── FORMAT SPEC + FEW-SHOT EXAMPLE (injected into every user message) ──
            // Embedding the spec in the user turn guarantees models that ignore system
            // prompts (local Llama, some fine-tunes) still receive the full format.
            const formatSpec = `Output ONLY valid Dataforge YAML. No markdown, no explanation.

STRUCTURE:
domain: <snake_case>
tables:
  <name>:
    rows: <int>
    columns:
      <col>:
        dtype: <dtype>
        primary_key: true        # one PK per table (int_seq or uuid)
        nullable: 0              # 0.0–1.0
        faker_provider: <name>   # optional
        choices: [A, B]          # optional, for enums
        min: <val>               # optional, for int/float/date
        max: <val>               # optional
        foreign_key:             # optional
          table: <t>
          column: <col>

DTYPES: int_seq, uuid, int, float, str, bool, date, email, name, phone, address, city, country, company, text, url, currency, iban
FAKER: name, first_name, last_name, email, phone_number, address, city, postcode, country, company, job, url, user_name, uuid4, date, past_date, future_date, iban, currency_code, pricetag, text, latitude, longitude, ipv4, credit_card_number

RULES (all mandatory):

1. str columns MUST have choices or faker_provider — never plain str alone:
   BAD:  status: {dtype: str}
   GOOD: status: {dtype: str, choices: [active, inactive]}
   GOOD: category: {dtype: str, faker_provider: job}

2. Every table MUST have exactly one primary_key column (dtype: int_seq or uuid).
   BAD:  two columns with primary_key: true in the same table
   BAD:  a table with no primary_key at all

3. foreign_key MUST reference the primary_key column of the target table:
   BAD:  foreign_key: {table: orders, column: status}
   GOOD: foreign_key: {table: orders, column: id}

4. min/max are only valid for dtype int, float, or date — never for bool, str, email, name, phone, etc.
   BAD:  email: {dtype: email, min: 1}
   GOOD: age:   {dtype: int,   min: 18, max: 99}

5. nullable must be a float between 0.0 and 1.0:
   BAD:  nullable: true
   BAD:  nullable: 50
   GOOD: nullable: 0.2

6. domain must be snake_case (lowercase letters, digits, underscores — no spaces, no hyphens):
   BAD:  domain: My Domain
   GOOD: domain: my_domain

EXAMPLE:
domain: shop
tables:
  customers:
    rows: 1000
    columns:
      id: {dtype: int_seq, primary_key: true}
      name: {dtype: name, faker_provider: name}
      email: {dtype: email, faker_provider: email}
      city: {dtype: city, faker_provider: city}
  orders:
    rows: 5000
    columns:
      id: {dtype: int_seq, primary_key: true}
      customer_id: {dtype: int, foreign_key: {table: customers, column: id}}
      status: {dtype: str, choices: [pending, shipped, delivered, cancelled]}
      total: {dtype: float, min: 10, max: 2000}
      created_at: {dtype: date, min: -2y, max: today}

DATASET DESCRIPTION:
`;

            // Final message sent as the user turn
            const fullUserMessage = formatSpec + prompt;

            // ─── HELPERS ────────────────────────────────────────────────────────────
            // Builds an OpenAI-compatible chat body, only including "model" if provided
            const openAIBody = (extraModel?: string) => {
              const body: Record<string, any> = {
                max_tokens: 3000,
                temperature: 0.1,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: fullUserMessage },
                ],
              };
              const m = modelField ?? extraModel;
              if (m) body.model = m;
              return body;
            };

            const callOpenAICompat = async (baseUrl: string, key: string) => {
              const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify(openAIBody()),
              });
              if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
              const data: any = await response.json();
              return (data.choices?.[0]?.message?.content ?? '') as string;
            };

            let yamlResult = '';

            if (provider === 'anthropic') {
              const anthropicBody: Record<string, any> = {
                max_tokens: 3000,
                temperature: 0.1,
                system: systemPrompt,
                messages: [{ role: 'user', content: fullUserMessage }],
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
              yamlResult = data.content?.[0]?.text ?? '';

            } else if (provider === 'openai') {
              yamlResult = await callOpenAICompat('https://api.openai.com/v1', apiKey);

            } else if (provider === 'google') {
              if (!modelField) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Google requires a model name. Fill in the Model field (e.g. gemini-1.5-flash or gemini-2.0-flash-lite).' }));
                return;
              }
              // Strip any leading "models/" prefix — the URL already includes it
              const googleModelId = modelField.replace(/^models\//, '');
              const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${googleModelId}:generateContent?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: fullUserMessage }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
                  }),
                }
              );
              if (!response.ok) throw new Error(`Google API error ${response.status}: ${await response.text()}`);
              const data: any = await response.json();
              yamlResult = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

            } else if (provider === 'groq') {
              yamlResult = await callOpenAICompat('https://api.groq.com/openai/v1', apiKey);

            } else if (provider === 'mistral') {
              yamlResult = await callOpenAICompat('https://api.mistral.ai/v1', apiKey);

            } else if (provider === 'together') {
              yamlResult = await callOpenAICompat('https://api.together.xyz/v1', apiKey);

            } else if (provider === 'ollama') {
              const response = await fetch('http://localhost:11434/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(openAIBody()),
              });
              if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
              const data: any = await response.json();
              yamlResult = data.choices?.[0]?.message?.content ?? '';

            } else {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Unknown provider "${provider}".` }));
              return;
            }

            // Strip markdown code fences if present
            yamlResult = yamlResult.replace(/^```(?:yaml)?\n?/m, '').replace(/\n?```$/m, '').trim();

            // Validate YAML before returning — detect duplicate keys and empty output
            if (!yamlResult) {
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'A IA retornou uma resposta vazia. Tente reformular seu prompt.' }));
              return;
            }

            try {
              const { parse: parseYaml } = await import('yaml');
              parseYaml(yamlResult); // throws if invalid (e.g. duplicate keys)
            } catch (yamlErr: any) {
              const msg: string = yamlErr?.message ?? String(yamlErr);
              if (msg.includes('Map keys must be unique')) {
                const lineMatch = msg.match(/line (\d+)/i);
                const location = lineMatch ? ` (linha ${lineMatch[1]} do YAML gerado)` : '';
                res.statusCode = 422;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  error: `A IA gerou colunas com nomes duplicados${location}. Tente gerar novamente — se o problema persistir, adicione ao prompt: "use unique column names in every table".`,
                  yaml: yamlResult,
                }));
                return;
              }
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: `O YAML gerado pela IA é inválido: ${msg}`,
                yaml: yamlResult,
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

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cliRunnerPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',  // Required for Docker
    port: 5173,
    fs: {
      allow: ['../schemas', '.']
    }
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
