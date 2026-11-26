import fs from 'node:fs';
const edition=process.argv[2];
if(!/^flowers-20261120-ui\d+$/.test(edition||''))throw Error('Expected flowers-20261120-uiN');
// Stamp the complete worker/module graph as well as top-level HTML assets.
const revision=edition;
function stamp(file){const original=fs.readFileSync(file,'utf8');let source=original.replace(/((?:from|import)\s*['"])(\.[^'"?]+\.js)(?:\?[^'"]*)?(['"])/g,(_,a,b,c)=>a+b+'?v='+revision+c).replace(/(importScripts\(['"])(\.[^'"?]+\.js)(?:\?[^'"]*)?(['"]\))/g,(_,a,b,c)=>a+b+'?v='+revision+c);if(source!==original)fs.writeFileSync(file,source);}
for(const name of fs.readdirSync('.'))if(name.endsWith('.js'))stamp(name);
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())walk(path);else if(item.name.endsWith('.js'))stamp(path);}}
walk('decoder/browser');
let html=fs.readFileSync('index.html','utf8').replace(/<html lang="en"(?: data-po33-install="[^"]*")?>/,'<html lang="en" data-po33-install="web-sampler-20261126">').replace(/\?v=[^"\s]+/g,'?v='+revision);
fs.writeFileSync('index.html',html);
fs.writeFileSync('app-release.json',JSON.stringify({version:revision,entry:edition+'.html',storageSchema:2})+'\n');
html=html.replace('<html lang="en">','<html lang="en" data-po33-install="flowers-20261120">').replace(/src="\.\/presets\.js[^"]*"/,'src="./install/presets-flowers-20261120.js?v='+edition+'"');
const bootScript='<script>window.PO33_BUILD='+JSON.stringify(edition)+'+(new URLSearchParams(location.search).has("refresh")?"-"+Date.now():"");window.PO33_RESOURCE=p=>{const u=new URL(p,document.baseURI);u.searchParams.set("v",window.PO33_BUILD);return u.href;};if(new URLSearchParams(location.search).has("boot")){history.replaceState(null,"","./creation.html");document.addEventListener("DOMContentLoaded",()=>{document.querySelector("link[rel=manifest]").href="./manifest.webmanifest?v="+window.PO33_BUILD;});}</script>';
html=html.replace('</head>',bootScript+'</head>');
if(!html.includes('src="./backup-audio.js'))throw Error('Missing M4A decoder');
html=html.replace(/href="\.\/manifest.webmanifest[^"]*"/,'href="./install/'+edition+'.webmanifest"');
fs.writeFileSync(edition+'.html',html);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
manifest.id='../';manifest.scope='../';manifest.start_url='../'+edition+'.html';manifest.icons=manifest.icons.map(i=>({...i,src:'.'+i.src}));
fs.writeFileSync('install/'+edition+'.webmanifest',JSON.stringify(manifest,null,2)+'\n');
