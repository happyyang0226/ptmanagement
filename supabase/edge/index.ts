import handler from './server/app.js';
globalThis.AIDX_ALLOWED_ORIGIN = 'https://ptmanagement.vercel.app';
Deno.serve(async(request:Request)=>{
 const headers=Object.fromEntries(request.headers.entries());headers.host=new URL(request.url).host;
 let body;
 if(request.method==='POST'){
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let length=0;
  if(reader){while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>100000){await reader.cancel();return Response.json({error:'내용이 너무 깁니다.'},{status:413});}chunks.push(next.value);}}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}catch{return Response.json({error:'잘못된 요청입니다.'},{status:400});}
 }
 let code=200,payload:any={};const outputHeaders=new Headers({'Content-Type':'application/json; charset=utf-8'});
 const response={setHeader:(k:string,v:string)=>outputHeaders.set(k,v),status:(value:number)=>{code=value;return response;},json:(value:unknown)=>{payload=value;return response;}};
 await handler({method:request.method,url:request.url,headers,body},response);
 return new Response(JSON.stringify(payload),{status:code,headers:outputHeaders});
});

