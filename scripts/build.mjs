import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const version=process.argv[2] || 'web-sampler-'+pkg.version;
if(!/^web-sampler-\d+\.\d+\.\d+$/.test(version))throw Error('Expected web-sampler-X.Y.Z');
function stamp(file){const original=fs.readFileSync(file,'utf8'),source=original.replace(/((?:from|import)\s*['"])(\.[^'"?]+\.js)(?:\?[^'"]*)?(['"])/g,(_,a,b,c)=>a+b+'?v='+version+c).replace(/(importScripts\(['"])(\.[^'"?]+\.js)(?:\?[^'"]*)?(['"]\))/g,(_,a,b,c)=>a+b+'?v='+version+c);if(source!==original)fs.writeFileSync(file,source);}
for(const name of fs.readdirSync('.'))if(name.endsWith('.js'))stamp(name);
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+item.name;if(item.isDirectory())walk(file);else if(item.name.endsWith('.js'))stamp(file);}}
walk('decoder/browser');
let html=fs.readFileSync('index.html','utf8').replace(/<script id="runtime-version">[\s\S]*?<\/script>\s*/,'').replace(/\?v=[^"\s]+/g,'?v='+version);
const boot=`<script id="runtime-version">window.PO33_BUILD=${JSON.stringify(version)}+(new URLSearchParams(location.search).has('refresh')?'-'+Date.now():'');window.PO33_RESOURCE=p=>{const u=new URL(p,document.baseURI);u.searchParams.set('v',window.PO33_BUILD);return u.href;};if(new URLSearchParams(location.search).has('boot')||new URLSearchParams(location.search).has('refresh'))history.replaceState(null,'','./index.html');</script>\n`;
html=html.replace(/((?:src|href)=")(\.\/[^"?]+\.(?:js|css|svg|png|webmanifest))(?:\?[^"]*)?(")/g,(_,a,b,c)=>a+b+'?v='+version+c);
html=html.replace('</head>',boot+'</head>');fs.writeFileSync('index.html',html);
fs.writeFileSync('app-release.json',JSON.stringify({version,entry:'index.html',storageSchema:2})+'\n');
