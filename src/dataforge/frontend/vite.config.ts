import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

const cliRunnerPlugin = () => ({
  name: 'cli-runner',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/run-cli' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { yamlStr, formats, outputDir, uploadTarget, bucket, prefix, partitionBy, jsonMode, seed, dbUrl, ifExists, dbSchema, recurrence, count, credentials, rows, tables: tablesToInclude, columns: columnsToInclude } = data;

            const baseDir = resolve(__dirname, '../../../');
            // When uploading to cloud, stage files in a temp dir and clean up after
            const isCloud = !!uploadTarget;
            const targetOut = isCloud
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
            if (partitionBy) {
              args.push('--partition-by', partitionBy);
            }
            // Resolve credentials from the fixed credentials/ folder
            const credentialsDir = resolve(baseDir, 'credentials');
            const extraEnv: Record<string, string> = {};
            if (uploadTarget) {
              args.push('--upload', uploadTarget);
              if (bucket) args.push('--bucket', bucket);
              if (prefix) args.push('--prefix', prefix);

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

            const venvPath = resolve(baseDir, '.venv', 'Scripts', 'python.exe');
            const pyExec = existsSync(venvPath) ? venvPath : 'python';

            console.log('Running python', [pyExec, ...args].join(' '));

            // Run process
            const pythonProcess = spawn(pyExec, args, {
              cwd: baseDir,
              env: { ...process.env, PYTHONPATH: resolve(baseDir, 'src'), ...extraEnv }
            });
            
            let output = '';
            pythonProcess.stdout.on('data', (data) => output += data.toString());
            pythonProcess.stderr.on('data', (data) => output += data.toString());

            pythonProcess.on('close', (code) => {
              if (isCloud) {
                try { rmSync(targetOut, { recursive: true, force: true }); } catch {}
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: code === 0, output, args: ['python', ...args].join(' ') }));
            });
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
