import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== Building QualCount Windows Executable Bundle ===');

// 1. Build Tauri release binary and NSIS bundle (Tauri CLI automatically runs `npm run build` via beforeBuildCommand)
console.log('\n[1/2] Compiling release binaries and NSIS single-exe bundle...');
execSync('npx @tauri-apps/cli build --bundles nsis', { cwd: rootDir, stdio: 'inherit' });

// 2. Copy artifacts to workspace root
console.log('\n[2/2] Synchronizing release artifacts to workspace root...');
const targetReleaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const nsisDir = path.join(targetReleaseDir, 'bundle', 'nsis');

let nsisExe = path.join(nsisDir, 'QualCount_2.0.0_x64-setup.exe');
if (!fs.existsSync(nsisExe) && fs.existsSync(nsisDir)) {
  const exeFiles = fs.readdirSync(nsisDir).filter(f => f.toLowerCase().endsWith('.exe'));
  if (exeFiles.length > 0) {
    // Prefer the setup exe
    const setupFile = exeFiles.find(f => f.toLowerCase().includes('setup')) || exeFiles[0];
    nsisExe = path.join(nsisDir, setupFile);
  }
}
const rootSetupExe = path.join(rootDir, 'QualCount-Setup.exe');

const rawExe = path.join(targetReleaseDir, 'qualcount.exe');
const rootExe = path.join(rootDir, 'QualCount.exe');

const loaderDll = path.join(targetReleaseDir, 'WebView2Loader.dll');
const rootLoaderDll = path.join(rootDir, 'WebView2Loader.dll');

if (fs.existsSync(nsisExe)) {
  fs.copyFileSync(nsisExe, rootSetupExe);
  const setupStat = fs.statSync(rootSetupExe);
  console.log(`✓ Single-file Installer: ${rootSetupExe} (${(setupStat.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.warn(`! NSIS installer not found at ${nsisExe}`);
}

if (fs.existsSync(rawExe)) {
  fs.copyFileSync(rawExe, rootExe);
  const exeStat = fs.statSync(rootExe);
  console.log(`✓ Standalone Binary:    ${rootExe} (${(exeStat.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.warn(`! Standalone executable not found at ${rawExe}`);
}

if (fs.existsSync(loaderDll)) {
  fs.copyFileSync(loaderDll, rootLoaderDll);
  console.log(`✓ Runtime Support DLL:  ${rootLoaderDll}`);
}

console.log('\n=== Build Complete Successfully ===');
