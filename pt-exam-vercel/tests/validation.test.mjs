import test from 'node:test';
import assert from 'node:assert/strict';
import {submission,safeFilePath,emailFor,link} from '../lib/validation.mjs';
import handler from '../server/app.js';
const body={week:1,title:'계획',summary:'검증한 결과',revision:0,attachments:[]};
test('submission rejects another team’s attachments and invalid revisions',()=>{
 assert.equal(submission(body,'A1').p_expected_revision,0);
 assert.throws(()=>submission({...body,revision:-1},'A1'));
 assert.throws(()=>submission({...body,attachments:[{path:'B1/1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf',name:'결과.pdf',size:100}]},'A1'));
 assert.throws(()=>submission({...body,week:16},'A1'));
});
test('links and file paths cannot contain scripts or traversal',()=>{
 for(const v of ['javascript:alert(1)','https://user:password@example.com','bad url'])assert.throws(()=>link(v),e=>e.status===400);
 assert.throws(()=>safeFilePath('A1/../secret.pdf'));
 assert.equal(emailFor('B5','202600001'),'b5.202600001@students.aidx.invalid');
 assert.throws(()=>emailFor('B6','202600001'));
});
test('protected routes fail before any database request without credentials',async()=>{
 for(const action of ['dashboard','history','member','feedback']){
  let status,payload;const res={setHeader(){},status(n){status=n;return this;},json(v){payload=v;}};
  await handler({url:'/?action='+action,method:'GET',headers:{}},res);
  assert.equal(status,401);assert.match(payload.error,/로그인/);
 }
});
test('cross-origin writes are rejected',async()=>{
 let status;const res={setHeader(){},status(n){status=n;return this;},json(){}};
 await handler({url:'/?action=login',method:'POST',headers:{origin:'https://evil.example',host:'ptmanagement.vercel.app','content-type':'application/json'},body:{}},res);
 assert.equal(status,403);
});

