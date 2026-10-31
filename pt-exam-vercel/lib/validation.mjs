export const TEAM_IDS=['A1','A2','A3','A4','B1','B2','B3','B4','B5'];
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function text(value,label,max=20000,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`${label}을(를) 확인해 주세요.`);return value.trim();}
export function team(value){if(!TEAM_IDS.includes(value))fail('조를 확인해 주세요.');return value;}
export function student(value){if(typeof value!=='string'||!/^\d{5,15}$/.test(value))fail('학번은 5~15자리 숫자로 입력해 주세요.');return value;}
export function week(value){if(!Number.isInteger(Number(value))||Number(value)<1||Number(value)>15)fail('주차를 확인해 주세요.');return Number(value);}
export function emailFor(teamId,studentId){return `${team(teamId).toLowerCase()}.${student(studentId)}@students.aidx.invalid`;}
export function link(value){if(!value)return '';let url;try{url=new URL(text(value,'결과물 링크',2000));}catch{fail('올바른 결과물 링크를 입력해 주세요.');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail('http 또는 https 링크를 입력해 주세요.');return url.href;}
export function attachments(value,teamId,weekId){if(!Array.isArray(value)||value.length>5)fail('첨부파일은 최대 5개입니다.');return value.map(a=>{if(!a||typeof a.path!=='string'||!new RegExp(`^${teamId}/${weekId}/[a-f0-9-]{36}\\.(pdf|docx|pptx|xlsx|png|jpg|jpeg|hwp|hwpx|zip|txt)$`,'i').test(a.path))fail('첨부파일 경로를 확인해 주세요.');if(!Number.isInteger(a.size)||a.size<1||a.size>10485760)fail('파일당 최대 10MB까지 첨부할 수 있습니다.');return {path:a.path,name:text(a.name,'파일 이름',200),size:a.size};});}
export function submission(body,teamId){const w=week(body.week);return {p_week:w,p_title:text(body.title,'제목',200),p_summary:text(body.summary,'결과 요약'),p_reflection:text(body.reflection||'','성찰',10000,false),p_link:link(body.link),p_attachments:attachments(body.attachments||[],teamId,w),p_expected_revision:Number.isInteger(body.revision)&&body.revision>=0?body.revision:fail('제출 버전을 확인해 주세요.')};}
export function safeFilePath(value){if(typeof value!=='string'||!/^(A[1-4]|B[1-5])\/(?:[1-9]|1[0-5])\/[a-f0-9-]{36}\.(pdf|docx|pptx|xlsx|png|jpg|jpeg|hwp|hwpx|zip|txt)$/i.test(value))fail('파일 경로를 확인해 주세요.');return value;}

