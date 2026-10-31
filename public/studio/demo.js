export const teams=['A1','A2','A3','A4','B1','B2','B3','B4','B5'];
export const titles=['팀 구성과 프로젝트 계획','근골격계 질환 선정','관련 해부학 정리','질환의 발생 기전','증상과 기능 문제 탐색','근거 자료 검색','AI 활용 과정 점검','중간 결과 정리','평가와 측정 이해','중재 근거 탐색','환자 교육 자료 기획','교육 자료 제작','동료 검토와 개선','최종 발표 준비','최종 결과와 성찰'];
export function demo(role){
 const allTeams=teams.map((id,i)=>({id,class_name:id[0],name:`${id[0]}반 ${id.slice(1)}조`,disease:['회전근개 손상','무릎 골관절염','발목 염좌','허리 통증','외측 팔꿈치 통증','앞십자인대 손상','손목터널증후군','목 통증','발바닥근막 통증'][i]}));
 const submissions=teams.flatMap((t,i)=>Array.from({length:i===3?2:3},(_,w)=>({id:`demo-${t}-${w+1}`,team_id:t,week:w+1,title:w===2?'질환과 관련된 관절·근육 기능 분석':'프로젝트 조사 결과',summary:'이 내용은 화면 확인을 위한 예시입니다.\n\n선정한 질환과 관련된 뼈, 관절, 근육의 구조를 조사하고 일상생활의 기능 문제와 연결했습니다. AI가 제시한 설명은 교재와 대조해 확인했습니다.',reflection:'각 팀원이 자료 조사, 내용 검증, 발표 자료 정리를 나누어 수행했습니다. 다음 주에는 근거 자료의 출처를 더 구체적으로 정리하겠습니다.',link:'',attachments:[],revision:1,submitted_at:'2026-10-28T05:30:00Z',is_late:false})));
 const feedback=submissions.filter(s=>s.week<3||['A1','B1','B3'].includes(s.team_id)).map(s=>({id:`feedback-${s.id}`,submission_id:s.id,submission_revision:1,strengths:'관절 구조와 기능을 연결한 점이 좋습니다.',improvements:'AI가 제시한 설명과 교재에서 확인한 사실을 구분하고, 근거의 정확한 출처를 남겨 주세요.',next_steps:'일상생활 동작 한 가지를 선택해 관련 근육의 역할을 설명해 보세요.',created_at:'2026-10-29T01:00:00Z'}));
 const profile={id:'demo-user',role,team_id:role==='student'?'A1':null,display_name:role==='student'?'체험 학생':'담당 교수'};
 const members=teams.flatMap(t=>[1,2,3].map((n)=>({id:`${t}-${n}`,role:'student',team_id:t,student_id:`예시 학번 ${n}`,display_name:`팀원 ${n}`})));
 const allowed=role==='professor'?allTeams:allTeams.filter(t=>t.id==='A1');
 return {profile,teams:allowed,weeks:titles.map((title,i)=>({number:i+1,title,instructions:'진행 내용, 근거 자료, AI 활용 및 검증 과정, 팀원별 기여를 정리해 주세요.',deadline:null})),submissions:submissions.filter(s=>role==='professor'||s.team_id==='A1'),feedback:feedback.filter(f=>role==='professor'||f.submission_id.includes('A1')),members:members.filter(m=>role==='professor'||m.team_id==='A1')};
}

