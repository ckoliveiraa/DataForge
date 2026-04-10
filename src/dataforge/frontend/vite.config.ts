import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
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
            const { yamlStr, format, outputDir, uploadTarget, bucket, prefix } = data;
            
            // Create a temp output dir in the project root
            const baseDir = resolve(__dirname, '../../../');
            const targetOut = resolve(baseDir, outputDir || 'output');
            mkdirSync(targetOut, { recursive: true });
            
            // Write the current UI schema to a system temporary file so we don't pollute the user's output dir
            const tempSchemaPath = join(tmpdir(), `dataforge_schema_${Date.now()}.yaml`);
            writeFileSync(tempSchemaPath, yamlStr);

            // Prepare CLI arguments
            const args = ['-c', 'from dataforge.cli import cli; cli()', 'generate', '--domain', 'custom', '--config', tempSchemaPath, '--output', targetOut];
            if (format) {
              args.push('--format', format);
            }
            if (uploadTarget) {
              args.push('--upload', uploadTarget);
              if (bucket) args.push('--bucket', bucket);
              if (prefix) args.push('--prefix', prefix);
            }

            const venvPath = resolve(baseDir, '.venv', 'Scripts', 'python.exe');
            const pyExec = existsSync(venvPath) ? venvPath : 'python';
            
            console.log('Running python', [pyExec, ...args].join(' '));

            // Run process
            const pythonProcess = spawn(pyExec, args, { 
              cwd: baseDir, 
              env: { ...process.env, PYTHONPATH: resolve(baseDir, 'src') } 
            });
            
            let output = '';
            pythonProcess.stdout.on('data', (data) => output += data.toString());
            pythonProcess.stderr.on('data', (data) => output += data.toString());

            pythonProcess.on('close', (code) => {
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
      allow: ['../../schemas', '.']
    }
  }
})
