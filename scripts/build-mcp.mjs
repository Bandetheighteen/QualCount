import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const entryPoint = path.join(rootDir, 'packages', 'mcp-server', 'src', 'index.ts');
const outfile = path.join(rootDir, 'packages', 'mcp-server', 'dist', 'index.js');

console.log('[build-mcp] Bundling @qualcount/mcp-server...');

await esbuild.build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});

console.log(`[build-mcp] Successfully bundled to: ${outfile}`);
