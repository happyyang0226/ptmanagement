import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handler from '../server/app.js';
const root=resolve('public'),port=Number(process.env.PORT||4325);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/classroom-api'){
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>100000){res.writeHead(413);return res.end();}}
   req.body=raw;res.status=n=>(res.statusCode=n,res);res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));return res;};return await handler(req,res);
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\')){res.writeHead(403);return res.end();}
  res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`AIDX preview: http://127.0.0.1:${port}/`));

