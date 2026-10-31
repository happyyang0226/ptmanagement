import {fail} from './validation.mjs';
export const env=name=>globalThis.Deno?.env?.get(name)??globalThis.process?.env?.[name];
export function config(){const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');if(!url||!key||url.includes('YOUR_PROJECT')||key.startsWith('YOUR_'))fail('Supabase 연결 설정이 필요합니다.',503);const parsed=new URL(url);if(parsed.protocol!=='https:')fail('Supabase 주소는 https여야 합니다.',503);return {url:parsed.origin,key};}
export async function sb(path,{token,service=false,method='GET',body,headers={}}={}){
 const {url,key}=config();const apiKey=service?env('SUPABASE_SERVICE_ROLE_KEY'):key;if(!apiKey)fail('교수 계정 관리 연결 설정이 필요합니다.',503);
 const auth=token||(service?apiKey:key);const response=await fetch(url+path,{method,headers:{apikey:apiKey,Authorization:`Bearer ${auth}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const result=await response.text();let data;try{data=result?JSON.parse(result):null;}catch{data=null;}
 if(!response.ok){const code=data?.code;if(code==='23505'||code==='40001'||data?.message?.includes('STALE_REVISION'))fail('다른 조원이 먼저 수정했습니다. 내용을 복사한 뒤 새로고침해 주세요.',409);if(data?.message?.includes('TEAM_FULL'))fail('한 조에는 최대 3명까지 등록할 수 있습니다.',409);if(response.status===429)fail('요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);if(response.status===401)fail('로그인이 만료되었습니다. 다시 로그인해 주세요.',401);if(response.status===403||code==='42501')fail('이 자료에 접근할 권한이 없습니다.',403);fail('요청을 처리하지 못했습니다. 입력 내용과 서버 연결을 확인해 주세요.',502);}
 return data;
}
export async function identity(req){const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token||token===req.headers.authorization)fail('로그인이 필요합니다.',401);const user=await sb('/auth/v1/user',{token});const rows=await sb(`/rest/v1/aidx_profiles?id=eq.${encodeURIComponent(user.id)}&select=*`,{token});if(!rows?.[0])fail('등록된 수강생 또는 교수 계정이 아닙니다.',403);return {token,profile:rows[0]};}
export function admin(profile){if(profile.role!=='professor')fail('교수 관리자만 사용할 수 있습니다.',403);}

