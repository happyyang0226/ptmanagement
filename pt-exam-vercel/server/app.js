import {config,sb,identity,admin} from '../lib/supabase.mjs';
import {fail,text,team,student,emailFor,week,submission,safeFilePath} from '../lib/validation.mjs';

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const action=new URL(req.url,'http://localhost').searchParams.get('action');
  if(!['GET','POST'].includes(req.method))fail('지원하지 않는 요청입니다.',405);
  if(req.method==='POST'){
   const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host&&origin!==globalThis.AIDX_ALLOWED_ORIGIN)fail('허용하지 않은 요청입니다.',403);
   if(!req.headers['content-type']?.startsWith('application/json'))fail('JSON 요청이 필요합니다.',415);
  }
  let b=req.body||{};if(typeof b==='string'){if(b.length>100000)fail('내용이 너무 깁니다.',413);b=JSON.parse(b);}if(!b||typeof b!=='object'||Array.isArray(b))fail('잘못된 요청입니다.');
  if(action==='config'&&req.method==='GET'){try{const c=config();return res.status(200).json({configured:true,url:c.url,key:c.key});}catch{return res.status(200).json({configured:false});}}
  if(action==='login'&&req.method==='POST'){
   const isAdmin=b.role==='professor';const email=isAdmin?text(b.email,'이메일',254):emailFor(b.teamId,b.studentId);const password=text(b.code,'접속 코드',256);
   let session;try{session=await sb('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});}catch(e){if([429,503].includes(e.status))throw e;fail('로그인 정보를 확인해 주세요.',401);}
   const profiles=await sb(`/rest/v1/aidx_profiles?id=eq.${encodeURIComponent(session.user.id)}&select=*`,{token:session.access_token});const p=profiles?.[0];
   if(!p||(isAdmin?p.role!=='professor':p.role!=='student'||p.team_id!==b.teamId||p.student_id!==b.studentId))fail('로그인 정보를 확인해 주세요.',401);
   return res.status(200).json({access_token:session.access_token,refresh_token:session.refresh_token,expires_at:Math.floor(Date.now()/1000)+session.expires_in,profile:p});
  }
  if(action==='refresh'&&req.method==='POST'){const s=await sb('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:text(b.refresh_token,'세션',4096)}});return res.status(200).json({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Math.floor(Date.now()/1000)+s.expires_in});}
  const {token,profile}=await identity(req);
  if(action==='password'&&req.method==='POST'){const password=text(b.password,'새 비밀번호',128);if(password.length<12)fail('비밀번호는 12자 이상으로 설정해 주세요.');const user=await sb('/auth/v1/user',{token});try{await sb('/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password:text(b.current,'현재 비밀번호',256)}});}catch{fail('현재 비밀번호를 확인해 주세요.',401);}await sb('/auth/v1/user',{token,method:'PUT',body:{password}});return res.status(200).json({ok:true});}
  if(action==='logout'&&req.method==='POST'){await sb('/auth/v1/logout',{method:'POST',token});return res.status(200).json({ok:true});}
  if(action==='dashboard'&&req.method==='GET'){
   const [teams,weeks,submissions,feedback,members]=await Promise.all([
    sb('/rest/v1/aidx_teams?select=*&order=id',{token}),sb('/rest/v1/aidx_weeks?select=*&order=number',{token}),sb('/rest/v1/aidx_submissions?select=*&order=week',{token}),sb('/rest/v1/aidx_feedback?select=*&order=created_at.desc',{token}),sb('/rest/v1/aidx_profiles?select=id,team_id,student_id,display_name,role&order=student_id',{token})]);
   return res.status(200).json({profile,teams,weeks,submissions,feedback,members});
  }
  if(action==='submit'&&req.method==='POST'){if(profile.role!=='student')fail('학생 계정으로 제출해 주세요.',403);const result=await sb('/rest/v1/rpc/aidx_submit',{method:'POST',token,body:submission(b,profile.team_id)});return res.status(200).json(result);}
  if(action==='feedback'&&req.method==='POST'){
   admin(profile);if(!Number.isInteger(b.revision)||b.revision<1)fail('제출 버전을 확인해 주세요.');const id=text(b.submissionId,'제출물',50);if(!/^[a-f0-9-]{36}$/i.test(id))fail('제출물을 확인해 주세요.');
   const result=await sb('/rest/v1/aidx_feedback',{method:'POST',token,headers:{Prefer:'return=representation'},body:{submission_id:id,submission_revision:b.revision,professor_id:profile.id,strengths:text(b.strengths||'','잘한 점',10000,false),improvements:text(b.improvements,'보완할 점',10000),next_steps:text(b.nextSteps||'','다음 주 제안',10000,false)}});return res.status(200).json(result);
  }
  if(action==='history'&&req.method==='GET'){const url=new URL(req.url,'http://localhost');const t=team(url.searchParams.get('team')),w=week(url.searchParams.get('week'));return res.status(200).json(await sb(`/rest/v1/aidx_submission_versions?team_id=eq.${t}&week=eq.${w}&select=*&order=revision.desc`,{token}));}
  if(action==='file'&&req.method==='POST'){const path=safeFilePath(b.path);const signed=await sb(`/storage/v1/object/sign/aidx-submissions/${path}`,{method:'POST',token,body:{expiresIn:120}});const url=signed.signedURL||signed.signedUrl;return res.status(200).json({url:url.startsWith('http')?url:config().url+'/storage/v1'+url});}
  if(action==='week'&&req.method==='POST'){admin(profile);const w=week(b.number);let deadline=null;if(b.deadline){const date=new Date(b.deadline);if(!Number.isFinite(date.getTime()))fail('마감일을 확인해 주세요.');deadline=date.toISOString();}await sb(`/rest/v1/aidx_weeks?number=eq.${w}`,{method:'PATCH',token,body:{title:text(b.title,'주차 제목',150),instructions:text(b.instructions||'','과제 안내',10000,false),deadline}});return res.status(200).json({ok:true});}
  if(action==='team'&&req.method==='POST'){admin(profile);await sb(`/rest/v1/aidx_teams?id=eq.${team(b.id)}`,{method:'PATCH',token,body:{name:text(b.name,'조 이름',60),disease:text(b.disease||'','질환',100,false)}});return res.status(200).json({ok:true});}
  if(action==='member'&&req.method==='POST'){
   admin(profile);const teamId=team(b.teamId),studentId=student(b.studentId),name=text(b.name,'이름',60),code=text(b.code,'접속 코드',128);if(code.length<12)fail('접속 코드는 12자 이상으로 설정해 주세요.');
   const members=await sb(`/rest/v1/aidx_profiles?team_id=eq.${teamId}&role=eq.student&select=id`,{token});if(members.length>=3)fail('한 조에는 최대 3명까지 등록할 수 있습니다.',409);
   const user=await sb('/auth/v1/admin/users',{service:true,method:'POST',body:{email:emailFor(teamId,studentId),password:code,email_confirm:true}});const userId=user.id||user.user?.id;
   try{await sb('/rest/v1/aidx_profiles',{service:true,method:'POST',body:{id:userId,role:'student',team_id:teamId,student_id:studentId,display_name:name}});}catch(e){try{await sb(`/auth/v1/admin/users/${userId}`,{service:true,method:'DELETE'});}catch{}throw e;}
   return res.status(201).json({ok:true});
  }
  if(action==='reset-code'&&req.method==='POST'){admin(profile);const id=text(b.id,'학생',50);if(!/^[a-f0-9-]{36}$/i.test(id))fail('학생을 확인해 주세요.');const p=await sb(`/rest/v1/aidx_profiles?id=eq.${id}&role=eq.student&select=id`,{token});if(!p[0])fail('학생 계정이 없습니다.',404);const code=text(b.code,'접속 코드',128);if(code.length<12)fail('접속 코드는 12자 이상으로 설정해 주세요.');await sb(`/auth/v1/admin/users/${id}`,{service:true,method:'PUT',body:{password:code}});return res.status(200).json({ok:true});}
  fail('요청을 찾을 수 없습니다.',404);
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'});}
}

