// Compile the same tested TypeScript codec; no hand-maintained browser fork.
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const compiler=process.argv[2] || path.join(__dirname,'node_modules/typescript/lib/tsc.js');
if(!fs.existsSync(compiler))throw Error('Install decoder dev dependencies or supply a TypeScript 6 compiler path.');
const result=spawnSync(process.execPath,[compiler,'--project','decoder/tsconfig.json','--noEmit','false','--rewriteRelativeImportExtensions','true','--rootDir','.','--outDir','decoder/browser'],{cwd:root,stdio:'inherit'});
process.exit(result.status ?? 1);
