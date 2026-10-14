/*
 * VitalVET 영업 CRM 화면
 * 프로토타입(v11)의 화면·동작을 그대로 쓰고, 데이터 저장만 서버(Laravel API)로 바꿨다.
 *   - 처음 열 때 /api/state 에서 볼 수 있는 데이터를 받아 S 에 담는다
 *   - 바뀔 때마다 save() → 바뀐 레코드만 /api/sync 로 보내고, 서버가 권한을 다시 확인해 저장한다
 */
/* ============ 설정 ============ */
/* 카카오 JavaScript 키: 서버 .env 의 KAKAO_JS_KEY 가 있으면 그 값을, 없으면 설정 메뉴에 저장한 키를 씁니다. */
const CONFIG={KAKAO_JS_KEY:(window.__CRM&&window.__CRM.kakaoKey)||''};
/* ============ 상수 ============ */
const DSTAGES=['미접촉(예정)','접촉/리드','1차 방문','2차 방문','회원가입','VitalVet 사용','활성 고객','보류','Lost'];
let STAGES=[...DSTAGES];
let MAIN_N=7;
function defaultStages(){const trg={'접촉/리드':'contact','1차 방문':'visit1','2차 방문':'visit2','회원가입':'signup','VitalVet 사용':'use'};return DSTAGES.map((n,i)=>({id:'st'+i,name:n,kind:i<7?'main':'exit',trigger:trg[n]||'',color:`var(--s${i})`}))}
function syncStages(){const L=S.stages;STAGES=[...L.filter(x=>x.kind==='main'),...L.filter(x=>x.kind==='exit')].map(x=>x.name);MAIN_N=L.filter(x=>x.kind==='main').length;S.stages=[...L.filter(x=>x.kind==='main'),...L.filter(x=>x.kind==='exit')];try{ui.map.stages=new Set(STAGES)}catch(e){}}
const initialStage=()=>STAGES[0];
const sc=s=>{const st=S&&S.stages&&S.stages.find(x=>x.name===s);return st?st.color:'var(--s0)'};
const ACT_TYPES=['방문','전화','문자/카톡','이메일','세미나/행사','기타'];
const CAT_COLORS=['#0B6E63','#2E90FA','#9460E0','#D16A06','#D92D20','#C11574','#4E5BA6','#6E7F2E'];
const OPS=[['view','표시'],['read','읽기'],['create','입력'],['update','수정'],['delete','삭제']];
const ALL5=['view','read','create','update','delete'];
const FEATURES=[
 ['myday','오늘 할 일',['view','read'],'내 담당 병원 기준 오늘 갈 곳·지연 팔로우업·내 메모'],
 ['dash','대시보드',['view','read'],'영업 현황 요약'],
 ['hospital','병원 기본 정보',ALL5,'병원 등록·수정·삭제(복원), 단계·카테고리 지정'],
 ['eval','리드 평가',ALL5,'수용도·호감도·수술 건수'],
 ['activity','영업 활동',ALL5,'방문·전화 기록, 다음 액션'],
 ['conv','전환·사용',ALL5,'회원가입일·사용 건수·비고'],
 ['map','지도·동선',['view','read'],'카테고리별 지도, 동선 짜기'],
 ['attendance','근태 일정',ALL5,'연차·반차·교육 등 일정 신청·승인, 회사 휴일 (수정 범위가 담당만이면 본인 일정만)'],
 ['report','영업 보고',ALL5,'일일 보고서 작성·검토·분석 (수정 범위가 담당만이면 본인 보고서만)'],
 ['category','카테고리',ALL5,'카테고리 추가·변경·삭제'],
 ['team','팀 성과',ALL5,'영업사원 역량 비교와 코칭 메모 (입력·수정·삭제는 코칭 메모)'],
 ['competitor','경쟁사',ALL5,'경쟁사·경쟁 제품 정보 등록·수정·삭제'],
 ['history','변경 이력',['view','read'],'병원 타임라인, 전체 변경 이력'],
 ['users','사용자·권한',ALL5,'가입 승인, 사용자·역할 관리'],
 ['settings','설정',['view','read','update'],'지도 연동, 등급 기준, 선택 목록']
];
const FNAME=Object.fromEntries(FEATURES.map(f=>[f[0],f[1]]));
const SCOPED=['hospital','eval','activity','conv'];
const ACTION_LABEL={create:'등록',update:'수정',delete:'삭제',restore:'복원'};
const ENTITY_LABEL={hospital:'병원',category:'카테고리',user:'사용자',role:'역할',settings:'설정',report:'영업 보고',attendance:'근태',competitor:'경쟁사'};
const ACT_PURPOSES=['첫 소개','제품 소개·시연','추가 시연','가입 상담','가입 지원','사용 교육','정기 관리','불만 대응','후속 연락','일정 조율','사용 현황 확인','자료 발송','자료 안내'];
const ACT_CONTACTS=['원장','봉직의','실장','테크니션','기타'];
const ACT_REACTIONS=['긍정','보통','부정','부재'];
const VOC_TYPES=['기능 요청','불만/개선','가격','교육 요청','칭찬'];
const ISSUE_TYPES=['자료 요청','시연 장비','기술 지원','가격 승인','기타'];
const EXP_TYPES=['주유·교통','주차','식대','기타'];
const WORK_TYPES=['외근','내근','교육','출장'];
const LEAD_SOURCES=['전시회','광고','세미나','지인추천','고객추천','방문영업','행사영업'];
const PRE_TYPES={call:['연락 예정','var(--info)'],visit:['방문 예정','var(--ok)'],send:['자료전송 예정','var(--s4)']};
const EVAL_MAX=5;const EVAL_TOTAL=EVAL_MAX*3;
const ptTxt=v=>hasEval(v)?`${v}점`:'';
const EVAL_ITEMS=[['adoption','디지털 수용도','태블릿·전자차트·온라인 서비스 활용 정도. 근거 화면을 캡처해 올려 두세요'],['favor','서비스 호감도','VitalVET 서비스에 대한 관심과 호의'],['surgeries','월 마취 건수','월 평균 마취·수술 규모']];
const MAX_SHOTS=4;
/* 예시 공휴일: 추석 연휴, 개천절 대체공휴일, 한글날 */
const HOLIDAYS={'2026-09-24':'추석 연휴','2026-09-25':'추석','2026-10-05':'대체공휴일','2026-10-09':'한글날'};
function holMap(){return (S&&S.holidays)||HOLIDAYS}
function holName(ds){return holMap()[ds]||''}
const isBiz=ds=>{const d=new Date(ds+'T00:00:00').getDay();return d!==0&&d!==6&&!holName(ds)};

const I={
 dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 21V8l8-5 8 5v13"/><path d="M10 21v-5h4v5M12 8v4M10 10h4"/></svg>',
 map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>',
 cat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
 today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
 team:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
 comp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l5-3v14M9 20V4l6 3v13M15 20v-9l5 2v7M2 20h20"/></svg>',
 cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/></svg>',
 report:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
 hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
 users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
 set:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
 more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
 route:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/></svg>',
 edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
 trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
 logo:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13h4l2-5 4 10 3-7 2 2h5"/></svg>'
};

/* ============ 유틸 ============ */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const pad=n=>String(n).padStart(2,'0');
const pad4=n=>String(n).padStart(4,'0');
const fmtD=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const WD=['일','월','화','수','목','금','토'];
const fd=ds=>ds?`${ds} (${WD[new Date(ds+'T00:00:00').getDay()]})`:'';
const fmtTs=iso=>{const d=new Date(iso);return `${fmtD(d)} (${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`};
const today=()=>fmtD(new Date());
const addDays=(n,base)=>{const d=base?new Date(base+'T00:00:00'):new Date();d.setDate(d.getDate()+n);return fmtD(d)};
const dday=ds=>Math.round((new Date(ds+'T00:00:00')-new Date(today()+'T00:00:00'))/864e5);
const clone=o=>JSON.parse(JSON.stringify(o));
function fmtPhone(v){const d=String(v||'').replace(/\D/g,'');if(!d)return '';
 if(d.startsWith('02')){if(d.length<=9)return d.replace(/^(02)(\d{3})(\d{0,4}).*/,'$1-$2-$3').replace(/-$/,'');return d.replace(/^(02)(\d{4})(\d{0,4}).*/,'$1-$2-$3')}
 if(d.length<=10)return d.replace(/^(\d{3})(\d{3})(\d{0,4}).*/,'$1-$2-$3').replace(/-$/,'');return d.replace(/^(\d{3})(\d{4})(\d{0,4}).*/,'$1-$2-$3')}
function distKm(a,b){const R=6371,t=Math.PI/180,dLat=(b.lat-a.lat)*t,dLng=(b.lng-a.lng)*t;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
const kmTxt=k=>k<1?`${Math.round(k*1000)}m`:`${k.toFixed(1)}km`;
const hashColor=s=>CAT_COLORS[[...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0)%CAT_COLORS.length];

function permsOf(spec){const p={};FEATURES.forEach(([k,,ops])=>{p[k]={};ops.forEach(o=>p[k][o]=!!(spec[k]||'').includes(o[0]))});return p}
function seedRoles(){
 const full=Object.fromEntries(FEATURES.map(f=>[f[0],'vrcud']));
 return [
  {id:'r_admin',name:'관리자',desc:'모든 기능과 권한 관리',scope:'all',locked:true,perms:permsOf(full)},
  {id:'r_lead',name:'영업팀장',desc:'전체 병원 관리, 사용자 조회',scope:'all',perms:permsOf({...full,users:'vr',settings:'vr'})},
  {id:'r_sales',name:'영업사원',desc:'담당 병원만 수정, 삭제 불가',scope:'own',perms:permsOf({myday:'vr',dash:'vr',hospital:'vrcu',eval:'vrcud',activity:'vrcud',conv:'vrcu',report:'vrcud',attendance:'vrcd',competitor:'vrc',map:'vr',category:'vr',history:'vr'})},
  {id:'r_viewer',name:'조회 전용',desc:'마케팅·경영지원용, 전환·사용 숨김',scope:'all',perms:permsOf({dash:'vr',hospital:'vr',eval:'vr',activity:'vr',map:'vr',category:'vr',attendance:'vrcd',competitor:'vr'})}
 ]}
/* ============ 상태 ============ */
/* ============ 상태 (서버 저장) ============ */
let S=null;
/* 서버 API: 세션 로그인 + CSRF(XSRF-TOKEN 쿠키) */
function xsrf(){const m=document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);return m?decodeURIComponent(m[1]):''}
async function api(method,url,body){let r;
 try{r=await fetch(url,{method,credentials:'same-origin',headers:{'Accept':'application/json','Content-Type':'application/json','X-Requested-With':'XMLHttpRequest','X-XSRF-TOKEN':xsrf()},body:body===undefined?undefined:JSON.stringify(body)})}
 catch(e){const err=new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');err.status=0;throw err}
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){const err=new Error(j?.message||`서버 오류가 발생했습니다 (${r.status})`);err.status=r.status;err.code=j?.code;throw err}
 return j}

/* 바뀐 내용 찾기: 마지막으로 서버와 맞춘 상태(BASE)와 지금 상태(S)를 레코드 단위로 비교 */
const SYNC_COLS=['hospitals','categories','stages','roles','users','competitors','reports','attendance','todos','coaching'];
const SYNC_ORDERED=['stages','categories','roles'];
const SYNC_APP=['settings','codes','holidays'];
let BASE=null;
function makeBase(){const b={col:{},order:{},app:{},audit:new Set((S.audit||[]).map(e=>e.id))};
 SYNC_COLS.forEach(c=>{b.col[c]=new Map((S[c]||[]).map(x=>[x.id,JSON.stringify(x)]))});
 SYNC_ORDERED.forEach(c=>{b.order[c]=(S[c]||[]).map(x=>x.id)});
 SYNC_APP.forEach(k=>{b.app[k]=JSON.stringify(S[k]??{})});return b}
function collectChanges(){const changes=[],order={},app={};
 SYNC_COLS.forEach(c=>{const old=BASE.col[c];const seen=new Set();
  (S[c]||[]).forEach(x=>{seen.add(x.id);const j=JSON.stringify(x);const o=old.get(x.id);if(o!==j)changes.push({c,id:x.id,b:o?JSON.parse(o):null,a:JSON.parse(j)})});
  old.forEach((o,id)=>{if(!seen.has(id))changes.push({c,id,b:JSON.parse(o),a:null})})});
 SYNC_ORDERED.forEach(c=>{const now=(S[c]||[]).map(x=>x.id),old=BASE.order[c];
  const kn=now.filter(id=>old.includes(id)).join('|'),ko=old.filter(id=>now.includes(id)).join('|');const fi=now.findIndex(id=>!old.includes(id));
  if(kn!==ko||(fi>=0&&now.slice(fi).some(id=>old.includes(id))))order[c]=now});
 SYNC_APP.forEach(k=>{const j=JSON.stringify(S[k]??{});if(j!==BASE.app[k])app[k]={b:JSON.parse(BASE.app[k]),a:JSON.parse(j)}});
 const audit=(S.audit||[]).filter(e=>!BASE.audit.has(e.id));
 return {changes,order,app,audit,empty:!changes.length&&!Object.keys(order).length&&!Object.keys(app).length&&!audit.length}}

/* 저장 큐: 화면은 바로 바뀌고, 서버 저장은 순서대로 뒤에서 진행. 실패하면 서버 상태로 되돌린다 */
let syncChain=Promise.resolve(true),syncBusy=0,syncFail='';
function syncLabel(){return syncBusy?'저장 중…':syncFail?'저장 실패':'저장됨'}
function paintSync(){const el=document.getElementById('syncState');if(el){el.textContent=syncLabel();el.className=syncFail?'sync-err':syncBusy?'sync-busy':''}}
async function pushChanges(){if(!S||!BASE)return true;const body=collectChanges();if(body.empty)return true;const next=makeBase();delete body.empty;
 syncBusy++;paintSync();
 try{const r=await api('POST','/api/sync',body);BASE=next;syncFail='';if(r&&r.seq!=null)S.seq=Math.max(S.seq||0,r.seq);return true}
 catch(e){syncFail=e.message;if(e.status===401){sessionLost();return false}toast(e.message+' · 서버에 저장된 내용으로 되돌립니다');await reloadState(true);return false}
 finally{syncBusy--;paintSync()}}
function saveNow(){syncChain=syncChain.then(pushChanges,pushChanges);return syncChain}
function save(){saveNow();return true}

/* 서버에서 전체 상태 다시 받기 */
let lastLoad=0;
async function loadState(){const st=await api('GET','/api/state');S=st;syncStages();BASE=makeBase();lastLoad=Date.now();syncFail='';
 if(!S.roles.some(r=>r.id===ui.roleSel))ui.roleSel=S.roles.find(r=>r.id==='r_sales')?.id||S.roles[0]?.id;return S}
async function reloadState(force){if(!S)return;try{await loadState();ui.roleDraft=null;
  if(ui.detailId&&!getH(ui.detailId))closeDetail();if(ui.view==='map')mapMounted=false;render()}catch(e){if(e.status===401)sessionLost();else if(force)toast(e.message)}}
function sessionLost(){S=null;BASE=null;ui.detailId=null;ui.modal=null;ui.loginTab='login';ui.loginMsg='로그인이 끝났습니다. 다시 로그인하세요.';mapMounted=false;render()}
// 다른 사람이 바꾼 내용: 창으로 돌아올 때 1분이 지났으면 새로 받는다
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S&&Date.now()-lastLoad>60000&&!syncBusy&&!ui.modal&&!document.getElementById('confirmLayer')?.innerHTML)syncChain.then(()=>reloadState(false))});
window.addEventListener('beforeunload',e=>{if(syncBusy){e.preventDefault();e.returnValue=''}});

const ui={view:'dash',detailId:null,tab:'info',form:null,formErr:'',modal:null,addr:null,
 list:{q:'',cat:'',stage:'',grade:'',follow:'',owner:'',sort:'id',deleted:false},
 map:{cats:new Set(),stages:new Set(STAGES),sel:null,route:[],labels:true},
 hist:{entity:'',user:'',action:'',q:'',limit:60},histTab:{user:'',section:''},
 catEdit:null,evalDraft:null,actDraft:null,nextDraft:null,convDraft:null,
 stEdit:null,navApp:'',team:{weeks:4},
 att:{month:today().slice(0,7),user:''},
 rep:{tab:'',date:today(),draft:null,preset:'2w',from:'',to:'',user:'',status:'',review:'',err:''},
 usersTab:'users',roleSel:'r_sales',roleDraft:null,loginTab:'login',loginUser:'',signup:{name:'',username:'',team:'',phone:''},loginMsg:''};
let kakaoReady=false,postcodeReady=false,mapAdapter=null,mapMounted=false;

/* ============ 사용자·권한 ============ */
const cur=()=>S?S.users.find(u=>u.id===S.session&&u.status==='active'):null;
const roleOf=u=>S.roles.find(r=>r.id===u?.roleId);
const userById=id=>S.users.find(u=>u.id===id);
const userName=id=>userById(id)?.name||'';
function can(f,op,h){const u=cur(),r=roleOf(u);if(!u||!r)return false;if(!r.perms[f]?.[op])return false;
 if(h&&op!=='view'&&op!=='read'){if(h.deletedAt&&!(f==='hospital'&&op==='delete'))return false;if(r.scope==='own'&&SCOPED.includes(f)&&h.ownerId!==u.id)return false}
 return true}
const canSee=f=>can(f,'view');
const canRead=f=>can(f,'view')&&can(f,'read');
function need(f,op,h){if(can(f,op,h))return true;const r=roleOf(cur());
 toast(h&&r?.scope==='own'&&SCOPED.includes(f)&&h.ownerId!==cur()?.id&&r.perms[f]?.[op]?'담당 병원만 수정할 수 있습니다':`${FNAME[f]} ${OPS.find(o=>o[0]===op)?.[1]} 권한이 없습니다`);return false}
function roNote(f,h){const r=roleOf(cur());if(h?.deletedAt)return '삭제된 병원은 복원 전까지 수정할 수 없습니다';
 if(r?.scope==='own'&&h&&h.ownerId!==cur()?.id&&(r.perms[f]?.update||r.perms[f]?.create))return `담당 병원만 수정할 수 있습니다 · 담당 ${userName(h.ownerId)||'미지정'}`;return `읽기 전용 · ${r?.name||''} 역할에는 ${FNAME[f]} 수정 권한이 없습니다`}
const roHTML=(f,h)=>`<div class="ro-note">${I.lock}${esc(roNote(f,h))}</div>`;
const lockedHTML=f=>`<div class="lock">${I.lock}<b>${esc(FNAME[f])} 열람 권한이 없습니다</b><span>관리자에게 권한을 요청하세요.</span></div>`;
const av=(u,cls='')=>{const n=u?.name||u?.userName||'?';const id=u?.id||u?.userId;const sl=userById(id)?.slot;const k=sl?(sl-1)%8+1:0;return `<span class="av ${cls}" style="--av:${k?`var(--v${k})`:hashColor(id||n)};${[3,4,5].includes(k)?'color:#10201c':''}">${esc(n[0])}</span>`};

/* ============ 계산 필드 ============ */
const hasEval=v=>v!==''&&v!=null;
function evalSum(e){e=e||{};if(!hasEval(e.adoption)||!hasEval(e.favor)||!hasEval(e.surgeries))return null;return +e.adoption + +e.favor + +e.surgeries}
function scoreOf(h){return evalSum(h.eval)}
// 항목별 0~5점 합산(0~15) → 11~15 상 / 6~10 중 / 0~5 하
const gradeFromSum=s=>s==null?'미평가':s>=11?'상':s>=6?'중':'하';
function gradeOf(h){return gradeFromSum(scoreOf(h))}
function evalStageIdx(){const s=(S.stages||[]).find(x=>x.trigger==='visit1'&&x.kind==='main');return s?STAGES.indexOf(s.name):2}
// 리드 평가는 1차 방문 이후 단계에서만 (이탈 단계는 방문 기록이 있으면 허용)
function canEvalStage(h){const i=STAGES.indexOf(h.stage);if(i<0)return false;if(i<MAIN_N)return i>=evalStageIdx();return (h.activities||[]).some(a=>a.type==='방문')}
const preBadge=h=>h.stage===initialStage()&&PRE_TYPES[h.pre]?`<span class="badge pre" style="--c:${PRE_TYPES[h.pre][1]}">${PRE_TYPES[h.pre][0]}</span>`:'';
function evalN(h){const e=h.eval||{};return (hasEval(e.adoption)?1:0)+(hasEval(e.favor)?1:0)+(hasEval(e.surgeries)?1:0)}
function followOf(h){const n=h.next||{};if(!n.date)return '없음';if(n.done)return '완료';const d=dday(n.date);return d<0?'지연':d===0?'오늘':'예정'}
const sortedActs=h=>[...(h.activities||[])].sort((a,b)=>a.date.localeCompare(b.date));
function contactInfo(h){const a=sortedActs(h);const v=a.filter(x=>x.type==='방문');return{first:a[0]?.date||'',last:a.at(-1)?.date||'',v1:v[0]?.date||'',v2:v[1]?.date||''}}
const catById=id=>S.categories.find(c=>c.id===id);
const inCat=(h,key)=>key==='__none'?!(h.categoryIds||[]).length:(h.categoryIds||[]).includes(key);
const getH=id=>S.hospitals.find(h=>h.id===id);
const liveH=()=>S.hospitals.filter(h=>!h.deletedAt);
function setStage(h,to){if(h.stage===to)return;(h.stageHistory||=[]).push({date:today(),from:h.stage,to});h.stage=to}
function autoAdvance(h){let moved='';const go=t=>{const c=STAGES.indexOf(h.stage),ti=STAGES.indexOf(t);if(c>=MAIN_N)return;if(ti>c){setStage(h,t);moved=t}};
 const T=k=>S.stages.find(x=>x.trigger===k&&x.kind==='main')?.name;const g2=k=>{const t=T(k);if(t)go(t)};const a=h.activities||[];if(a.length)g2('contact');const v=a.filter(x=>x.type==='방문').length;if(v>=1)g2('visit1');if(v>=2)g2('visit2');if(h.signupDate)g2('signup');if(+h.usageCount>0)g2('use');return moved}

/* ============ 변경 이력 (감사 로그) ============ */
const H_FIELDS=[
 ['name','병원명','기본 정보'],['address','주소','기본 정보',h=>h.address?`(${h.zip||'-'}) ${h.address}`:''],['addressDetail','상세주소','기본 정보'],['grade','병원 등급','기본 정보'],
 ['specialty','전문과','기본 정보'],['phone','대표 전화','기본 정보'],['director','원장님 이름','기본 정보'],['directorPhone','원장님 연락처','기본 정보'],['vetCount','봉직수의사 수','기본 정보'],
 ['ownerId','담당 영업사원','기본 정보',h=>userName(h.ownerId)],['compId','사용 중인 경쟁 제품','기본 정보',h=>compById(h.compId)?.name||''],['compUntil','경쟁 제품 계약 만료일','기본 정보',h=>fd(h.compUntil)],['categoryIds','카테고리','카테고리',h=>(h.categoryIds||[]).map(id=>catById(id)?.name).filter(Boolean).join(', ')||'미분류'],
 ['stage','현재 단계','영업 단계'],
 ['pre','미접촉 예정 구분','기본 정보',h=>h.stage===initialStage()?(PRE_TYPES[h.pre]?.[0]||''):''],['sources','접촉 경로','기본 정보',h=>(h.sources||[]).join(', ')],
 ['e.adoption','디지털 수용도','리드 평가',h=>ptTxt(h.eval?.adoption)],['e.shots','디지털 수용도 근거 이미지','리드 평가',h=>(h.eval?.shots||[]).length?`${h.eval.shots.length}장`:''],['e.favor','서비스 호감도','리드 평가',h=>ptTxt(h.eval?.favor)],['e.surgeries','월 마취 건수','리드 평가',h=>ptTxt(h.eval?.surgeries)],
 ['score','리드 종합 등급','리드 평가',h=>{const s=scoreOf(h);return s==null?'미평가':`${gradeOf(h)} (${s}/${EVAL_TOTAL}점)`}],
 ['n.date','다음 액션일','영업 활동',h=>h.next?.date||''],['n.todo','팔로우업 할 사항','영업 활동',h=>h.next?.todo||''],['n.done','팔로우업 처리','영업 활동',h=>h.next?.date?(h.next.done?'완료':'미완료'):''],
 ['signupDate','회원가입일','전환·사용'],['usageCount','VitalVET 누적 사용 건수','전환·사용',h=>+h.usageCount?String(h.usageCount):''],['lastUsedDate','최근 사용일','전환·사용'],['memo','비고','전환·사용'],
 ['status','상태','병원 상태',h=>h.deletedAt?'삭제됨':'정상']
];
function snapH(h){const o={};H_FIELDS.forEach(([k,l,,fn])=>{const v=fn?fn(h):h[k];o[k]={l,v:v==null?'':String(v)}});
 (h.activities||[]).forEach(a=>{o['act:'+a.id]={l:'활동 기록',v:[a.type,a.date,a.purpose,a.contact&&'면담 '+a.contact,a.reaction,a.note].filter(Boolean).join(' · ')}});return o}
function diffSnap(a,b,skip=[]){const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];const out=[];
 keys.forEach(k=>{if(skip.includes(k))return;const x=a[k]?.v??'',y=b[k]?.v??'';if(x!==y)out.push({field:(a[k]||b[k]).l,before:x,after:y})});return out}
function logEntry(o,ts,user){const u=user||cur();const r=roleOf(u);S.audit.push({id:uid(),ts:ts||new Date().toISOString(),userId:u?.id||'',userName:u?.name||'시스템',roleName:r?.name||(u?.status==='pending'?'가입 신청':''),...o})}
function mutateH(h,section,fn,opt={}){const b=snapH(h);const ret=fn(h);const a=snapH(h);const ch=diffSnap(b,a);
 if(ch.length||opt.force)logEntry({entity:'hospital',entityId:h.id,hospitalId:h.id,targetName:h.name,action:opt.action||'update',section,changes:ch,summary:opt.summary||''});save();return ret}
function sectionOf(ch){const secs=new Set(ch.map(c=>{const f=H_FIELDS.find(x=>x[1]===c.field);return f?f[2]:'영업 활동'}));return [...secs].join(' · ')}

/* ============ 공통 렌더 조각 ============ */
const stageBadge=s=>`<span class="badge stage" style="--c:${sc(s)}">${esc(s)}</span>`;
function gradeBadge(h){const g=gradeOf(h),s=scoreOf(h);return `<span class="badge g-${g}">${s!=null?'리드 ':''}${g}${s!=null?` <span class="mono">${s}/${EVAL_TOTAL}</span>`:''}</span>`}
function followBadge(h){const f=followOf(h);if(f==='없음')return '<span class="muted">—</span>';return `<span class="badge f-${f}">${f}</span>`}
function catChips(h,max=99){const ids=h.categoryIds||[];if(!ids.length)return '<span class="cat-chip none">미분류</span>';
 const cs=ids.map(catById).filter(Boolean);const show=cs.slice(0,max).map(c=>`<span class="cat-chip" style="--cc:${c.color}"><i></i>${esc(c.name)}</span>`).join('');return show+(cs.length>max?`<span class="cat-chip">+${cs.length-max}</span>`:'')}
function distBar(list){const n=list.length||1;return `<div class="dist-bar">${STAGES.map(s=>{const c=list.filter(h=>h.stage===s).length;return c?`<i style="--c:${sc(s)};width:${c/n*100}%" title="${s} ${c}"></i>`:''}).join('')}</div>`}
const region=h=>h.sigungu?`${h.sido} ${h.sigungu}`:'주소 없음';
function toast(msg){const el=$('#toastLayer');el.innerHTML=`<div class="toast" role="status">${esc(msg)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>el.innerHTML='',2600)}
const dis=ro=>ro?'disabled':'';

/* 감사 로그 항목 */
function auditItem(e,showTarget){const u=userById(e.userId);
 const target=showTarget?(e.entity==='hospital'?(canRead('hospital')&&getH(e.hospitalId)?`<button class="au-target" data-act="open" data-id="${e.hospitalId}">${esc(e.targetName)}</button>`:`<b>${esc(e.targetName)}</b>`):(e.entity==='report'&&S.reports.some(x=>x.id===e.entityId)&&canRep('read',S.reports.find(x=>x.id===e.entityId))?`<button class="au-target" data-act="repOpen" data-id="${e.entityId}">${esc(ENTITY_LABEL[e.entity])} · ${esc(e.targetName||'')}</button>`:`<b>${esc(ENTITY_LABEL[e.entity])} · ${esc(e.targetName||'')}</b>`)):'';
 const rows=e.changes||[];const cell=(v,cls)=>v===''?'<span class="nil">(없음)</span>':`<span class="${cls}">${esc(v)}</span>`;
 const tbl=list=>`<div class="chg-wrap"><table class="chg"><thead><tr><th>항목</th><th>수정 전</th><th>수정 후</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.field)}</td><td>${cell(c.before,'bf')}</td><td>${cell(c.after,'af')}</td></tr>`).join('')}</tbody></table></div>`;
 return `<li class="au"><div class="au-head">${av({id:e.userId,name:e.userName})}<div><div><b>${esc(e.userName)}</b><span class="au-role">${esc(e.roleName||'')}${u&&u.name!==e.userName?` · 현재 이름 ${esc(u.name)}`:''}</span></div>
 <div class="au-meta"><span class="mono">${fmtTs(e.ts)}</span><span class="badge a-${e.action}">${ACTION_LABEL[e.action]}</span><span>${esc(e.section||'')}</span>${target?'· '+target:''}</div></div></div>
 ${e.summary?`<p class="au-sum">${esc(e.summary)}</p>`:''}
 ${rows.length?(rows.length>6?tbl(rows.slice(0,5))+`<details><summary>나머지 ${rows.length-5}개 항목 보기</summary>${tbl(rows.slice(5))}</details>`:tbl(rows)):''}</li>`}
function auditList(items,showTarget){if(!items.length)return '<div class="panel empty">조건에 맞는 변경 이력이 없습니다</div>';let day='';
 return `<ul class="audit">${items.map(e=>{const d=fmtTs(e.ts).slice(0,10);const sep=d!==day?`<li class="day-sep">${fd(d)}</li>`:'';day=d;return sep+auditItem(e,showTarget)}).join('')}</ul>`}

/* ============ 내비 ============ */
const MENUS=[['today','오늘 할 일',I.today,'myday'],['dash','대시보드',I.dash,'dash'],['list','병원 관리',I.list,'hospital'],['map','지도',I.map,'map'],['report','영업 보고',I.report,'report'],['team','팀 성과',I.team,'team'],['attend','근태 일정',I.cal,'attendance'],['cat','카테고리',I.cat,'category'],['comp','경쟁사',I.comp,'competitor'],['history','변경 이력',I.hist,'history'],['users','사용자·권한',I.users,'users'],['settings','설정',I.set,'settings']];
const visMenus=()=>MENUS.filter(m=>canSee(m[3]));
function renderNav(){const u=cur();const r=roleOf(u);const vm=visMenus();
 $('#nav').innerHTML=`<div class="brand"><div class="brand-mark">${I.logo}</div><div><b>VitalVET</b><small>영업 CRM</small></div></div>
 ${vm.map(([k,l,ic])=>`<button class="nav-btn ${ui.view===k?'on':''}" data-act="go" data-v="${k}">${ic}${l}</button>`).join('')}
 <div class="user-box">${av(u)}<div><b>${esc(u?.name)}</b><small>${esc(r?.name)} · ${esc(u?.team)}</small></div><button class="btn sm" data-act="logout">로그아웃</button></div>
 <div class="nav-foot"><div><span class="dot" style="background:${kakaoReady?'var(--ok)':'var(--warn)'}"></span>${kakaoReady?'카카오맵 연결됨':'미리보기 지도'} · <span id="syncState">${syncLabel()}</span></div><button class="link-btn" data-act="pwOpen">비밀번호 변경</button></div>`;
 const tb=vm.length>5?[...vm.slice(0,4),['more','더보기',I.more]]:vm;
 $('#tabbar').style.gridTemplateColumns=`repeat(${tb.length},1fr)`;
 $('#tabbar').innerHTML=tb.map(([k,l,ic])=>`<button class="${ui.view===k||(k==='more'&&!vm.slice(0,4).some(m=>m[0]===ui.view))?'on':''}" data-act="${k==='more'?'moreMenu':'go'}" data-v="${k}">${ic}${l}</button>`).join('');
}

function render(){
 if(!cur()){renderLogin();return}$('#loginLayer').innerHTML='';
 if(!visMenus().some(m=>m[0]===ui.view))ui.view=visMenus()[0]?.[0]||'none';
 renderNav();
 const m=$('#main');
 if(ui.view==='map'){if(mapMounted){refreshMap();}else{m.className='main map-mode';renderMapView()}}
 else{mapMounted=false;mapAdapter=null;m.className='main';
  const V={today:[todayHTML,'myday'],team:[teamHTML,'team'],comp:[compHTML,'competitor'],attend:[attHTML,'attendance'],report:[repHTML,'report'],dash:[dashHTML,'dash'],list:[listHTML,'hospital'],cat:[catHTML,'category'],history:[histHTML,'history'],users:[usersHTML,'users'],settings:[settingsHTML,'settings']}[ui.view];
  m.innerHTML=!V?'<div class="lock"><b>볼 수 있는 메뉴가 없습니다</b><span>관리자에게 권한을 요청하세요.</span></div>':canRead(V[1])?V[0]():`<div class="page-head"><h1>${FNAME[V[1]]}</h1></div><section class="panel">${lockedHTML(V[1])}</section>`;
  if(ui.view==='list'&&canRead('hospital'))renderListBody();}
 renderDrawer();renderModal();requestAnimationFrame(drawCharts);
}

/* ============ 로그인·가입 ============ */
const USERNAME_RE=/^[a-z][a-z0-9._-]{3,29}$/;
function renderLogin(){const L=ui.loginTab;const f=ui.signup;
 $('#loginLayer').innerHTML=`<div class="login"><div class="login-card">
 <div class="login-intro"><div class="brand" style="padding:0"><div class="brand-mark">${I.logo}</div><div><b>VitalVET</b><small>영업 CRM</small></div></div>
  <h1>VitalVET 영업 CRM</h1><p>병원 리드 관리부터 방문 기록, 일일 영업 보고, 근태 일정까지 한곳에서 관리합니다. 역할마다 보이는 메뉴와 할 수 있는 작업이 다르고, 모든 등록·수정·삭제는 로그인한 사람 이름으로 변경 이력에 남습니다.</p>
  <ul><li><b>관리자</b> · 모든 기능, 사용자·권한 관리</li><li><b>영업팀장</b> · 전체 병원 관리, 사용자는 조회만</li><li><b>영업사원</b> · 담당 병원만 수정, 삭제 불가</li><li><b>조회 전용</b> · 읽기만, 전환·사용 숨김</li></ul>
  <p style="margin-top:12px" class="hint">계정이 없으면 회원가입을 신청하세요. 관리자가 승인하고 역할을 지정하면 로그인할 수 있습니다.</p></div>
 <section class="panel"><div class="sub-tabs"><button class="tab ${L==='login'?'on':''}" data-act="loginTab" data-v="login">로그인</button><button class="tab ${L==='signup'?'on':''}" data-act="loginTab" data-v="signup">회원가입 신청</button></div>
 ${L==='login'?`<div class="form-grid login-form">
   <label class="fld span2"><span>아이디</span><input id="li-user" value="${esc(ui.loginUser)}" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="아이디"></label>
   <label class="fld span2"><span>비밀번호</span><input id="li-pw" type="password" autocomplete="current-password" placeholder="비밀번호"></label>
   ${ui.loginMsg?`<p class="err span2">${esc(ui.loginMsg)}</p>`:''}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="doLogin">로그인</button></div>`
 :`<div class="form-grid"><label class="fld"><span>이름 <em>*</em></span><input id="su-name" data-su="name" value="${esc(f.name)}"></label>
  <label class="fld"><span>아이디 <em>*</em> <small>영문 소문자로 시작, 4~30자</small></span><input id="su-username" data-su="username" value="${esc(f.username)}" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="예: sumin.lee"></label>
  <label class="fld"><span>비밀번호 <em>*</em> <small>8자 이상</small></span><input id="su-pw" type="password" autocomplete="new-password"></label>
  <label class="fld"><span>비밀번호 확인 <em>*</em></span><input id="su-pw2" type="password" autocomplete="new-password"></label>
  <label class="fld"><span>소속</span><input id="su-team" data-su="team" value="${esc(f.team)}" placeholder="예: 영업1팀"></label><label class="fld"><span>연락처</span><input id="su-phone" data-su="phone" value="${esc(f.phone)}" inputmode="tel"></label>
  ${ui.loginMsg?`<p class="err span2">${esc(ui.loginMsg)}</p>`:''}<p class="hint span2">신청하면 관리자가 승인하고 역할을 지정할 때까지 로그인할 수 없습니다.</p></div>
  <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="doSignup">가입 신청</button></div>`}
 </section></div></div>`;
 $('#nav').innerHTML='';$('#main').innerHTML='';$('#tabbar').innerHTML='';$('#drawerLayer').innerHTML='';$('#modalLayer').innerHTML='';
 if(L==='login')setTimeout(()=>{const i=ui.loginUser?$('#li-pw'):$('#li-user');i?.focus()},20)}
let loginBusy=false;
async function doLogin(){if(loginBusy)return;const u=($('#li-user')?.value||'').trim().toLowerCase(),p=$('#li-pw')?.value||'';ui.loginUser=u;
 if(!u||!p){ui.loginMsg='아이디와 비밀번호를 입력하세요.';renderLogin();return}
 loginBusy=true;try{await api('POST','/api/auth/login',{username:u,password:p});await loadState();
  ui.loginMsg='';ui.view=can('myday','view')?'today':'dash';ui.list.owner='';ui.detailId=null;ui.modal=null;mapMounted=false;render();startExternal();
  toast(`${cur().name}님(${roleOf(cur()).name})으로 로그인했습니다`)}
 catch(e){ui.loginMsg=e.message;renderLogin()}finally{loginBusy=false}}
async function doSignup(){const f=ui.signup;const pw=$('#su-pw')?.value||'',pw2=$('#su-pw2')?.value||'';f.username=f.username.trim().toLowerCase();
 if(!f.name.trim()){ui.loginMsg='이름을 입력하세요.';renderLogin();return}
 if(!USERNAME_RE.test(f.username)){ui.loginMsg='아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.';renderLogin();return}
 if(pw.length<8){ui.loginMsg='비밀번호는 8자 이상이어야 합니다.';renderLogin();return}
 if(pw!==pw2){ui.loginMsg='비밀번호 확인이 일치하지 않습니다.';renderLogin();return}
 try{await api('POST','/api/auth/signup',{name:f.name.trim(),username:f.username,password:pw,team:f.team.trim(),phone:fmtPhone(f.phone)})}
 catch(e){ui.loginMsg=e.message;renderLogin();return}
 ui.loginUser=f.username;ui.signup={name:'',username:'',team:'',phone:''};ui.loginTab='login';ui.loginMsg='';renderLogin();toast('가입 신청 완료 · 관리자 승인 후 로그인할 수 있습니다')}
async function doLogout(){try{await syncChain}catch(e){}try{await api('POST','/api/auth/logout')}catch(e){}
 ui.loginUser=cur()?.username||'';S=null;BASE=null;ui.detailId=null;ui.modal=null;ui.loginMsg='';ui.loginTab='login';mapMounted=false;render()}
function pwFormHTML(m){const f=m.f;return `<div class="form-grid"><label class="fld span2"><span>현재 비밀번호</span><input type="password" id="pw-cur" data-pw="current" value="${esc(f.current)}" autocomplete="current-password"></label>
 <label class="fld"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" id="pw-new" data-pw="password" value="${esc(f.password)}" autocomplete="new-password"></label>
 <label class="fld"><span>새 비밀번호 확인</span><input type="password" id="pw-new2" data-pw="password2" value="${esc(f.password2)}" autocomplete="new-password"></label>
 ${m.err?`<p class="err span2">${esc(m.err)}</p>`:''}</div>`}
async function savePassword(){const m=ui.modal,f=m.f;
 if(!f.current){m.err='현재 비밀번호를 입력하세요.';renderModal();return}if((f.password||'').length<8){m.err='새 비밀번호는 8자 이상이어야 합니다.';renderModal();return}
 if(f.password!==f.password2){m.err='새 비밀번호 확인이 일치하지 않습니다.';renderModal();return}
 try{await api('POST','/api/auth/password',{current:f.current,password:f.password});ui.modal=null;renderModal();toast('비밀번호를 바꿨습니다')}catch(e){m.err=e.message;renderModal()}}
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing)return;const id=e.target?.id;
 if(id==='li-user'||id==='li-pw'){e.preventDefault();doLogin()}else if(id==='su-pw2'){e.preventDefault();doSignup()}else if(id==='pw-new2'){e.preventDefault();savePassword()}});

/* ============ 대시보드 ============ */
function dashHTML(){
 const H=liveH();const cnt=f=>H.filter(f).length;const fl=H.map(h=>followOf(h));const conv=canRead('conv');const act=canRead('activity');
 const k=[['전체 병원',H.length,`${initialStage()} ${cnt(h=>h.stage===initialStage())}곳`],['미평가',cnt(h=>gradeOf(h)==='미평가'),'리드 평가 입력 필요'],
  ['리드 상',cnt(h=>gradeOf(h)==='상'),`중 ${cnt(h=>gradeOf(h)==='중')} · 하 ${cnt(h=>gradeOf(h)==='하')}`],
  ...(conv?[['회원가입 병원',cnt(h=>h.signupDate),'가입일 입력 기준'],['VitalVET 사용 병원',cnt(h=>+h.usageCount>0),'누적 사용 1건 이상'],['누적 사용 건수',H.reduce((a,h)=>a+(+h.usageCount||0),0).toLocaleString(),'전체 병원 합계']]:[]),
  ...(act?[['팔로우업 지연',fl.filter(f=>f==='지연').length,'다음 액션일 경과',true],['오늘 할 일',fl.filter(f=>f==='오늘').length,'다음 액션일 = 오늘']]:[])];
 const max=Math.max(...STAGES.map(s=>cnt(h=>h.stage===s)),1);
 const me=cur();const todo=H.filter(h=>['지연','오늘'].includes(followOf(h))||(followOf(h)==='예정'&&dday(h.next.date)<=3)).sort((a,b)=>(b.ownerId===me.id)-(a.ownerId===me.id)||a.next.date.localeCompare(b.next.date));
 const rows=[...S.categories.map(c=>({key:c.id,name:c.name,color:c.color})),{key:'__none',name:'미분류',color:'var(--none)'}];
 const mx=Math.max(1,...rows.flatMap(rw=>STAGES.map(s=>H.filter(h=>inCat(h,rw.key)&&h.stage===s).length)));
 return `<div class="page-head"><div><h1>영업 현황</h1><p>${fd(today())} 기준 · ${esc(me.name)}님(${esc(roleOf(me).name)})으로 보는 중</p></div>
  ${can('hospital','create')?`<button class="btn primary" data-act="newH">${I.plus}병원 등록</button>`:''}</div>
 ${dashNotice()}
 <div class="kpis">${k.map(([l,v,s,al])=>`<div class="kpi ${al&&v>0?'alert':''}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('')}</div>
 <div class="dash-grid">
  <section class="panel"><h2>영업 단계별 병원 <small>단계를 누르면 목록으로 이동</small></h2><div class="funnel">
   ${STAGES.map(s=>{const c=cnt(h=>h.stage===s);return `<div class="funnel-row" style="--c:${sc(s)};cursor:pointer" data-act="listStage" data-v="${s}"><span>${s}</span><div class="bar"><i style="width:${c/max*100}%"></i></div><b>${c}</b></div>`}).join('')}
  </div></section>
  ${act?`<section class="panel"><h2>팔로우업 <small>내 담당 먼저 · 지연 · 오늘 · 3일 이내</small></h2>
   ${todo.length?`<ul class="todo">${todo.map(h=>`<li data-act="open" data-id="${h.id}">${followBadge(h)}<div style="min-width:0"><div class="t-name">${esc(h.name)}${h.ownerId===me.id?' <span class="badge f-예정" style="padding:0 6px">내 담당</span>':''}</div><div class="t-sub">${esc(h.next.todo||'할 일 미입력')} · ${esc(userName(h.ownerId)||'담당 미지정')}</div></div><span class="mono muted" style="font-size:12px;white-space:nowrap">${fd(h.next.date)}</span></li>`).join('')}</ul>`:'<div class="empty">예정된 팔로우업이 없습니다</div>'}
  </section>`:`<section class="panel">${lockedHTML('activity')}</section>`}
 </div>
 ${dashChartsHTML()}
 <section class="panel"><h2>카테고리 × 영업 단계 <small>${canRead('map')?'행을 누르면 지도에서 해당 카테고리를 봅니다':''}</small></h2>
  <div class="tbl-wrap" style="border:0"><table class="matrix"><thead><tr><th>카테고리</th>${STAGES.map(s=>`<th><span class="badge stage" style="--c:${sc(s)};padding:0 6px">${s}</span></th>`).join('')}<th>합계</th></tr></thead><tbody>
  ${rows.map(rw=>{const inR=H.filter(h=>inCat(h,rw.key));return `<tr class="row" ${canRead('map')?`data-act="mapCat" data-v="${rw.key}"`:''}><td><span class="cat-chip ${rw.key==='__none'?'none':''}" style="--cc:${rw.color}">${rw.key==='__none'?'':'<i></i>'}${esc(rw.name)}</span></td>
   ${STAGES.map(s=>{const c=inR.filter(h=>h.stage===s).length;return `<td><span class="cell" style="background:${c?`color-mix(in srgb,${sc(s)} ${Math.round(12+c/mx*50)}%,transparent)`:'none'}">${c||'<span class="muted">·</span>'}</span></td>`}).join('')}<td><b>${inR.length}</b></td></tr>`}).join('')}
  </tbody></table></div><p class="hint" style="margin-top:8px">한 병원이 여러 카테고리에 속하면 각 행에 모두 집계됩니다.</p></section>`;
}

/* ============ 병원 목록 ============ */
function listHTML(){const L=ui.list;const opt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>Array.isArray(x)?`<option value="${esc(x[0])}" ${v===x[0]?'selected':''}>${esc(x[1])}</option>`:`<option ${v===x?'selected':''}>${esc(x)}</option>`).join('');
 const delN=S.hospitals.filter(h=>h.deletedAt).length;const r=roleOf(cur());
 return `<div class="page-head"><div><h1>병원 관리</h1><p>병원을 눌러 평가·방문 기록·전환 정보와 변경 이력을 확인하세요${r.scope==='own'?' · 수정은 내 담당 병원만 가능':''}</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">${can('hospital','delete')&&delN?`<button class="btn ${L.deleted?'primary':''}" data-act="toggleDeleted">${L.deleted?'병원 목록으로':`삭제된 병원 ${delN}`}</button>`:''}${can('hospital','create')&&!L.deleted?`<button class="btn primary" data-act="newH">${I.plus}병원 등록</button>`:''}</div></div>
 <div class="toolbar"><label class="search">${I.search}<input type="search" id="lq" placeholder="병원명, 원장님, 주소, Lead # 검색" value="${esc(L.q)}" data-lf="q"></label>
  <select id="lcat" data-lf="cat" aria-label="카테고리">${opt([...S.categories.map(c=>[c.id,c.name]),['__none','미분류']],L.cat,'카테고리 전체')}</select>
  <select id="lstage" data-lf="stage" aria-label="단계">${opt(STAGES,L.stage,'단계 전체')}</select>
  <select id="lpre" data-lf="pre" aria-label="${esc(initialStage())} 구분">${opt(Object.entries(PRE_TYPES).map(([k,[l]])=>[k,l]),L.pre,'예정 구분 전체')}</select>
  <select id="lsrc" data-lf="src" aria-label="접촉 경로">${opt(LEAD_SOURCES,L.src,'접촉 경로 전체')}</select>
  ${canRead('eval')?`<select id="lgrade" data-lf="grade" aria-label="리드 등급">${opt(['상','중','하','미평가'],L.grade,'리드 등급 전체')}</select>`:''}
  ${canRead('activity')?`<select id="lfollow" data-lf="follow" aria-label="팔로우업">${opt(['지연','오늘','예정','완료','없음'],L.follow,'팔로우업 전체')}</select>`:''}
  <select id="lowner" data-lf="owner" aria-label="담당자">${opt([['__me','내 담당'],...S.users.filter(u=>u.status==='active').map(u=>[u.id,u.name])],L.owner,'담당자 전체')}</select>
  <select id="lsort" data-lf="sort" aria-label="정렬">${[['id','등록순'],['name','병원명순'],['score','리드 등급 높은순'],['next','다음 액션일 빠른순']].map(([v,l])=>`<option value="${v}" ${L.sort===v?'selected':''}>${l}</option>`).join('')}</select>
 </div><div id="listBody"></div>`}
function filteredList(){const L=ui.list;const q=L.q.trim().toLowerCase();const me=cur().id;
 let r=S.hospitals.filter(h=>!!h.deletedAt===L.deleted&&(!q||[h.name,h.director,h.address,h.jibun,h.id,h.phone].join(' ').toLowerCase().includes(q))&&(!L.cat||inCat(h,L.cat))&&(!L.stage||h.stage===L.stage)&&(!L.pre||(h.stage===initialStage()&&h.pre===L.pre))&&(!L.src||(h.sources||[]).includes(L.src))&&(!L.grade||gradeOf(h)===L.grade)&&(!L.follow||followOf(h)===L.follow)&&(!L.owner||h.ownerId===(L.owner==='__me'?me:L.owner)));
 const s=L.sort;const nx=h=>h.next?.date&&!h.next.done?h.next.date:'9999';r.sort((a,b)=>s==='name'?a.name.localeCompare(b.name,'ko'):s==='score'?(scoreOf(b)??-1)-(scoreOf(a)??-1):s==='next'?nx(a).localeCompare(nx(b)):a.id.localeCompare(b.id));return r}
function renderListBody(){const el=$('#listBody');if(!el)return;const r=filteredList();const narrow=window.innerWidth<=860;const L=ui.list;const ev=canRead('eval'),ac=canRead('activity');
 if(!r.length){el.innerHTML=`<div class="panel empty">${L.deleted?'삭제된 병원이 없습니다':'조건에 맞는 병원이 없습니다. 필터를 바꾸거나 새 병원을 등록하세요.'}</div>`;return}
 const head=`<p class="count-line">${r.length}곳${L.deleted?' · 삭제된 병원은 복원 전까지 다른 화면에 나오지 않습니다':''}</p>`;
 if(narrow){el.innerHTML=head+`<div class="cards">${r.map(h=>`<button class="hcard" data-act="open" data-id="${h.id}"><div class="hcard-top"><div style="min-width:0"><div class="h-name">${esc(h.name)}</div><div class="h-sub"><span class="mono">${h.id}</span> · ${esc(region(h))} · ${esc(userName(h.ownerId)||'담당 미지정')}</div></div><div style="display:grid;gap:4px;justify-items:end">${stageBadge(h.stage)}${preBadge(h)}</div></div><div class="hcard-meta">${ev?gradeBadge(h):''} ${ac&&followOf(h)!=='없음'?followBadge(h)+`<span class="h-sub mono">${fd(h.next.date)}</span>`:''}${L.deleted?`<span class="badge a-delete">삭제 ${fd(h.deletedAt)}</span>`:''}</div><div class="chips">${catChips(h,3)}</div></button>`).join('')}</div>`;return}
 el.innerHTML=head+`<div class="tbl-wrap"><table><thead><tr><th>Lead #</th><th>병원</th><th>지역</th><th>카테고리</th><th>단계</th>${ev?'<th>리드</th>':''}${L.deleted?'<th>삭제</th>':ac?'<th>다음 액션</th>':''}<th>담당</th></tr></thead><tbody>
 ${r.map(h=>`<tr class="row" data-act="open" data-id="${h.id}"><td class="mono muted" style="white-space:nowrap">${h.id}</td><td><div class="h-name">${esc(h.name)}</div><div class="h-sub">${esc([h.grade,h.specialty,h.director&&h.director+' 원장'].filter(Boolean).join(' · '))}</div></td>
 <td class="h-sub" style="white-space:nowrap">${esc(region(h))}</td><td><div class="chips">${catChips(h,2)}</div></td><td><div style="display:flex;flex-wrap:wrap;gap:4px">${stageBadge(h.stage)}${preBadge(h)}</div></td>${ev?`<td>${gradeBadge(h)}</td>`:''}
 ${L.deleted?`<td style="white-space:nowrap" class="h-sub">${fd(h.deletedAt)} · ${esc(userName(h.deletedBy))}</td>`:ac?`<td style="white-space:nowrap">${followBadge(h)} ${h.next?.date?`<span class="mono h-sub">${fd(h.next.date)}</span>`:''}</td>`:''}
 <td class="h-sub" style="white-space:nowrap">${esc(userName(h.ownerId)||'—')}${h.ownerId===cur().id?' <span class="badge f-예정" style="padding:0 6px">나</span>':''}</td></tr>`).join('')}</tbody></table></div>`}

/* ============ 병원 폼 ============ */
function blankForm(){return{name:'',zip:'',address:'',jibun:'',addressDetail:'',sido:'',sigungu:'',lat:null,lng:null,grade:'',specialty:'',phone:'',director:'',directorPhone:'',vetCount:'',ownerId:'',categoryIds:[],compId:'',compUntil:'',pre:'call',sources:[]}}
function formFromH(h){const f=blankForm();for(const k in f)if(k in h)f[k]=clone(h[k]);f.sources=f.sources||[];f._stage=h.stage;return f}
function ownerOptions(sel,ro){const r=roleOf(cur());const list=S.users.filter(u=>u.status==='active');
 return `<select id="f-owner" data-f="ownerId" ${dis(ro)}><option value="">미지정</option>${list.map(u=>`<option value="${u.id}" ${sel===u.id?'selected':''}>${esc(u.name)} (${esc(roleOf(u)?.name||'')})</option>`).join('')}</select>`}
function formHTML(f,mode,ro){
 const addr=f.address?`<div><div class="addr-main"><span class="zip">${esc(f.zip)}</span>${esc(f.address)}</div>${f.jibun?`<div class="addr-sub">지번 ${esc(f.jibun)}</div>`:''}<div class="addr-geo ${f.lat?'ok':'warn'}">${f.lat?`지도 좌표 확인됨 · <span class="mono">${(+f.lat).toFixed(4)}, ${(+f.lng).toFixed(4)}</span>`:'지도 좌표 없음 · 지도에 표시되지 않아요'}</div></div>`:'<div class="addr-empty">주소 검색으로 도로명 주소를 선택하세요</div>';
 const dup=mode==='new'&&findDup(f);const ownLock=roleOf(cur()).scope==='own';
 return `<div class="form-grid">
 <label class="fld span2"><span>병원명 <em>*</em></span><input id="f-name" data-f="name" value="${esc(f.name)}" placeholder="예: 온누리 동물병원" autocomplete="off" ${dis(ro)}></label>
 <div class="fld span2"><span>주소 <em>*</em></span><div class="addr-row"><input id="f-zip" class="zip-in" value="${esc(f.zip)}" placeholder="우편번호" readonly aria-label="우편번호" ${ro?'disabled':'data-act="openAddr"'}>${ro?'':`<button type="button" class="btn" data-act="openAddr">${I.search}${f.address?'다시 검색':'주소 검색'}</button>`}</div>
  <input id="f-addr" value="${esc(f.address)}" placeholder="주소 검색을 눌러 도로명 주소를 선택하세요" readonly aria-label="도로명 주소" ${ro?'disabled':'data-act="openAddr"'} class="addr-in">
  ${f.address?`<div class="addr-sub">${f.jibun?`지번 ${esc(f.jibun)} · `:''}<span class="addr-geo ${f.lat?'ok':'warn'}">${f.lat?`지도 좌표 확인됨 · <span class="mono">${(+f.lat).toFixed(4)}, ${(+f.lng).toFixed(4)}</span>`:'지도 좌표 없음 · 지도에 표시되지 않아요'}</span></div>`:''}</div>
 <label class="fld span2"><span>상세주소</span><input id="f-detail" data-f="addressDetail" value="${esc(f.addressDetail)}" placeholder="층, 호수 (예: 2층 201호)" ${dis(ro)}></label>
 <div class="fld"><span>병원 등급</span><div class="seg">${S.codes.grades.map(g=>`<button type="button" class="${f.grade===g?'on':''}" data-act="setF" data-k="grade" data-v="${esc(g)}" ${dis(ro)}>${esc(g)}</button>`).join('')}</div></div>
 <label class="fld"><span>전문과</span><select id="f-spec" data-f="specialty" ${dis(ro)}><option value="">선택</option>${S.codes.specialties.map(s=>`<option ${f.specialty===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
 <label class="fld"><span>병원 대표 전화</span><input id="f-phone" data-f="phone" inputmode="tel" value="${esc(f.phone)}" placeholder="02-000-0000" ${dis(ro)}></label>
 <label class="fld"><span>봉직수의사 수</span><input id="f-vets" type="number" min="0" data-f="vetCount" value="${esc(f.vetCount)}" placeholder="0" ${dis(ro)}></label>
 <label class="fld"><span>원장님 이름</span><input id="f-dir" data-f="director" value="${esc(f.director)}" ${dis(ro)}></label>
 <label class="fld"><span>원장님 연락처</span><input id="f-dirp" data-f="directorPhone" inputmode="tel" value="${esc(f.directorPhone)}" placeholder="010-0000-0000" ${dis(ro)}></label>
 <label class="fld"><span>담당 영업사원${ownLock?' <small>담당 병원만 관리하는 역할은 변경 불가</small>':''}</span>${ownerOptions(f.ownerId,ro||ownLock)}</label><div></div>
 <label class="fld"><span>사용 중인 경쟁 제품</span><select data-f="compId" ${dis(ro)}><option value="">없음·모름</option>${(S.competitors||[]).map(c=>`<option value="${c.id}" ${f.compId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
 <label class="fld"><span>경쟁 제품 계약 만료일 <small>재접촉 시점</small></span><input type="date" data-f="compUntil" value="${esc(f.compUntil||'')}" ${dis(ro)}></label>
 <div class="fld span2"><span>카테고리 <small>여러 개 선택 가능</small></span><div class="chips">${S.categories.map(c=>`<button type="button" class="chip-toggle ${f.categoryIds.includes(c.id)?'on':''}" style="--cc:${c.color}" data-act="toggleFCat" data-v="${c.id}" ${dis(ro)}><i></i>${esc(c.name)}</button>`).join('')}</div>
  <p class="hint">${f.categoryIds.length?`${f.categoryIds.length}개 선택됨`:'선택하지 않으면 <b>미분류</b>로 등록됩니다'}</p></div>
 ${mode==='new'||f._stage===initialStage()?`<div class="fld span2"><span>${esc(initialStage())} 구분 <small>아직 접촉 전 · 다음에 할 일</small></span><div class="seg">${Object.entries(PRE_TYPES).map(([k,[l]])=>`<button type="button" class="${f.pre===k?'on':''}" data-act="setF" data-k="pre" data-v="${k}" ${dis(ro)}>${l}</button>`).join('')}</div></div>`:''}
 <div class="fld span2"><span>접촉 경로 <small>병원을 알게 된·만나게 된 경로 · 여러 개 선택 가능</small></span><div class="chips">${LEAD_SOURCES.map(x=>`<button type="button" class="chip-toggle src ${(f.sources||[]).includes(x)?'on':''}" data-act="toggleSrc" data-v="${x}" ${dis(ro)}><i></i>${x}</button>`).join('')}</div></div>
 ${mode==='new'?`<div class="stage-note span2">등록 시 단계 ${stageBadge(initialStage())} 리드 평가와 방문 기록은 등록 후 병원 상세에서 입력합니다. 등록자는 <b>${esc(cur().name)}</b>으로 기록됩니다.</div>`:''}
 ${dup?`<div class="warnbox span2">이미 등록된 병원과 겹칩니다: <b>${esc(dup.name)}</b> (${dup.id}, ${esc(dup.address)})${dup.deletedAt?' · 삭제된 병원':''}. 같은 병원이 아니면 한 번 더 저장하세요.</div>`:''}
 ${ui.formErr?`<p class="err span2">${esc(ui.formErr)}</p>`:''}
 </div>`}
function findDup(f,selfId){const n=f.name.replace(/\s/g,'');return S.hospitals.find(h=>h.id!==selfId&&((n&&h.name.replace(/\s/g,'')===n)||(f.address&&h.address===f.address&&(h.addressDetail||'')===(f.addressDetail||''))||(f.phone&&h.phone===fmtPhone(f.phone))))}
function validateForm(f){if(!f.name.trim())return '병원명을 입력하세요.';if(!f.address)return '주소 검색으로 주소를 선택하세요.';return ''}

function renderModal(){const el=$('#modalLayer');const m=ui.modal;if(!m||!cur()){el.innerHTML='';return}
 const shell=(title,body,foot,sm)=>`<div class="backdrop" data-act="bd"><div class="modal ${sm?'sm':''}" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="닫기">${I.x}</button></header><div class="body">${body}</div>${foot?`<footer>${foot}</footer>`:''}</div></div>`;
 if(m.type==='register')el.innerHTML=shell('병원 등록',formHTML(ui.form,'new'),`<button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="saveNew">${ui.form._dupWarned?'그래도 등록':'등록'}</button>`);
 else if(m.type==='img')el.innerHTML=shell(esc(m.title||'이미지'),`<img src="${m.src}" alt="${esc(m.title||'')}" style="width:100%;height:auto;border-radius:8px;display:block">`,'<button class="btn" data-act="closeModal">닫기</button>');
 else if(m.type==='user'){const f=m.f;const isSelf=f.id===cur().id;
  el.innerHTML=shell(f.id?'사용자 정보 수정':'사용자 추가',`<div class="form-grid"><label class="fld"><span>이름 <em>*</em></span><input id="uf-name" data-uf="name" value="${esc(f.name)}"></label><label class="fld"><span>아이디 <em>*</em> <small>로그인용 · 영문 소문자</small></span><input id="uf-username" data-uf="username" value="${esc(f.username||'')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
  <label class="fld"><span>소속</span><input id="uf-team" data-uf="team" value="${esc(f.team)}"></label><label class="fld"><span>연락처</span><input id="uf-phone" data-uf="phone" value="${esc(f.phone)}"></label>
  <label class="fld"><span>역할 <em>*</em></span><select id="uf-role" data-uf="roleId" ${isSelf?'disabled':''}><option value="">선택</option>${S.roles.map(r=>`<option value="${r.id}" ${f.roleId===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label>
  <label class="fld"><span>연간 연차 (일)</span><input type="number" min="0" max="40" step="0.5" id="uf-leave" data-uf="annualLeave" value="${esc(f.annualLeave??15)}"></label>
  <label class="fld"><span>${f.id?'새 비밀번호 <small>바꿀 때만 입력</small>':'초기 비밀번호 <em>*</em> <small>8자 이상</small>'}</span><input type="password" id="uf-pw" data-uf="password" value="${esc(f.password||'')}" autocomplete="new-password"></label>
  <label class="fld"><span>상태</span><select id="uf-status" data-uf="status" ${isSelf?'disabled':''}>${[['active','활성'],['inactive','비활성'],['pending','승인 대기']].map(([v,l])=>`<option value="${v}" ${f.status===v?'selected':''}>${l}</option>`).join('')}</select></label>
  ${isSelf?'<p class="hint span2">본인의 역할과 상태는 바꿀 수 없습니다.</p>':''}${m.err?`<p class="err span2">${esc(m.err)}</p>`:''}</div>`,`<button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="saveUser">${f.id?'저장':'추가'}</button>`)}
 else if(m.type==='repView'){const r=S.reports.find(x=>x.id===m.id);if(!r){ui.modal=null;el.innerHTML='';return}el.innerHTML=`<div class="backdrop" data-act="bd"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">일일 보고서</h2><div style="display:flex;gap:6px">${r.authorId===cur().id&&r.status!=='confirmed'&&canRep('update',r)?'<button class="btn sm" data-act="repEdit" data-v="'+r.date+'">수정하기</button>':''}<button class="icon-btn" data-act="closeModal" aria-label="닫기">${I.x}</button></div></header><div class="body">${repViewHTML(r)}</div></div></div>`}
 else if(m.type==='quickAct'){el.innerHTML=shell(`방문·접촉 기록 · ${dayLabel(m.f.date)}`,quickActHTML(m),`<button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="qaSave">기록</button>`)}
 else if(m.type==='att'){el.innerHTML=shell(m.self?(attManager()?'내 일정 등록':'근태 일정 신청'):'직원 일정 등록',attFormHTML(m),`<button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="attSave">${attManager()?'등록':'신청'}</button>`)}
 else if(m.type==='attView'){const a=S.attendance.find(x=>x.id===m.id);if(!a){ui.modal=null;el.innerHTML='';return}el.innerHTML=shell('근태 일정',`<div class="rv-head">${av(userById(a.userId)||{name:'?'})}<div><b>${esc(userName(a.userId))}</b><div class="au-meta"><span class="att-dot" style="--ac:${ATT[a.type]?.color}"></span><span>${esc(a.type)}</span><span>${attPeriod(a)}</span><span>${attDays(a)}일</span><span class="badge ${ATT_ST[a.status][1]}">${ATT_ST[a.status][0]}</span></div></div></div>
  <dl class="mc-grid"><dt>사유</dt><dd>${esc(a.reason||'—')}</dd><dt>신청</dt><dd>${esc(userName(a.requestedBy))} · ${fmtTs(a.requestedAt)}</dd><dt>처리</dt><dd>${a.approverId?`${esc(userName(a.approverId))} · ${fmtTs(a.approvedAt)}`:'—'}</dd>${a.comment?`<dt>의견</dt><dd>${esc(a.comment)}</dd>`:''}</dl>`,attActions(a)||'<button class="btn" data-act="closeModal">닫기</button>',true)}
 else if(m.type==='stDel'){el.innerHTML=shell('영업 단계 삭제',stageDelHTML(m),`<button class="btn" data-act="closeModal">취소</button><button class="btn danger solid" data-act="seDelGo" data-v="${m.id}">삭제</button>`,true)}
 else if(m.type==='comp'){el.innerHTML=`<div class="backdrop" data-act="bd"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">${ui.form.id?'경쟁사 수정':'경쟁사 등록'}</h2><button class="icon-btn" data-act="closeModal" aria-label="닫기">${I.x}</button></header><div class="body">${compFormHTML(ui.form,m.err)}</div><footer><button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="compSave">${ui.form.id?'저장':'등록'}</button></footer></div></div>`}
 else if(m.type==='compView'){const c=compById(m.id);if(!c){ui.modal=null;el.innerHTML='';return}el.innerHTML=`<div class="backdrop" data-act="bd"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">경쟁사 정보</h2><div style="display:flex;gap:6px">${canComp('update')?`<button class="btn sm" data-act="compEdit" data-id="${c.id}">${I.edit}수정</button>`:''}${canComp('delete')?`<button class="btn sm danger" data-act="compDel" data-id="${c.id}">${I.trash}삭제</button>`:''}<button class="icon-btn" data-act="closeModal" aria-label="닫기">${I.x}</button></div></header><div class="body">${compViewHTML(c)}</div></div></div>`}
 else if(m.type==='teamView'){el.innerHTML=`<div class="backdrop" data-act="bd"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">영업사원 상세</h2><button class="icon-btn" data-act="closeModal" aria-label="닫기">${I.x}</button></header><div class="body">${teamDetailHTML(m.id)}</div></div></div>`;requestAnimationFrame(drawCharts)}
 else if(m.type==='pw'){el.innerHTML=shell('비밀번호 변경',pwFormHTML(m),'<button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="pwSave">변경</button>',true)}
 else if(m.type==='more'){el.innerHTML=shell('메뉴',`<div class="more-list">${visMenus().slice(4).map(([k,l,ic])=>`<button class="nav-btn ${ui.view===k?'on':''}" data-act="go" data-v="${k}">${ic}${l}</button>`).join('')}</div>
  <div class="user-box" style="margin-top:12px">${av(cur())}<div><b>${esc(cur().name)}</b><small>${esc(roleOf(cur()).name)} · ${esc(cur().username)}</small></div><button class="icon-btn" data-act="pwOpen" aria-label="비밀번호 변경">${I.lock}</button><button class="btn sm" data-act="logout">로그아웃</button></div>`,'',true)}
}
function openRegister(){if(!need('hospital','create'))return;ui.form=blankForm();ui.form.ownerId=cur().id;ui.formErr='';ui.modal={type:'register'};renderModal();setTimeout(()=>$('#f-name')?.focus(),30)}
function saveNew(){if(!need('hospital','create'))return;const f=ui.form;ui.formErr=validateForm(f);if(ui.formErr){renderModal();return}
 const dup=findDup(f);if(dup&&!f._dupWarned){f._dupWarned=true;renderModal();return}
 S.seq++;const id=`VV-${pad4(S.seq)}`;const h={id,...clone(f),phone:fmtPhone(f.phone),directorPhone:fmtPhone(f.directorPhone),vetCount:f.vetCount===''?'':+f.vetCount,stage:initialStage(),stageHistory:[],eval:{},activities:[],next:{},signupDate:'',usageCount:0,lastUsedDate:'',memo:'',createdAt:today(),createdBy:cur().id};
 delete h._dupWarned;delete h._stage;if(roleOf(cur()).scope==='own')h.ownerId=cur().id;S.hospitals.push(h);
 logEntry({entity:'hospital',entityId:id,hospitalId:id,targetName:h.name,action:'create',section:'병원 등록',changes:diffSnap({},snapH(h),['status','score','n.done'])});
 save();ui.modal=null;ui.form=null;toast(`${id} ${h.name} 등록됨 · ${initialStage()}`);openDetail(id);render()}

/* ============ 주소 검색 ============ */
function openAddr(){ui.addr={q:''};renderAddr()}
/* 주소 검색: 카카오 우편번호 서비스(레이어/embed). 선택 결과는 location.host 기준으로 전달되므로 http(s)에서만 동작 */
const WEB_ORIGIN=/^https?:$/.test(location.protocol)&&!!location.host;
const PostcodeCls=()=>window.kakao?.Postcode||window.daum?.Postcode;
function manualAddrHTML(open){return `<details ${open?'open':''}><summary class="hint" style="cursor:pointer">직접 입력</summary><div style="display:grid;gap:8px;margin-top:8px">
 <div class="addr-row"><input id="manualZip" class="zip-in" placeholder="우편번호" inputmode="numeric" maxlength="5"><input id="manualAddr" placeholder="도로명 주소" style="flex:1;min-width:0"></div>
 <p class="hint">직접 입력한 주소는 좌표가 없어 지도에 표시되지 않을 수 있습니다.</p><button class="btn" data-act="manualAddr">이 주소 사용</button></div></details>`}
function fillAddrInputs(zip,addr){const z=$('#f-zip'),a=$('#f-addr');if(z)z.value=zip||'';if(a)a.value=addr||''}
function renderAddr(){const el=$('#addrLayer');if(!ui.addr){el.innerHTML='';return}const PC=PostcodeCls();
 const shell=body=>`<div class="backdrop addr-backdrop" data-act="bdAddr"><div class="modal sm addr-modal" role="dialog" aria-modal="true"><header><h2>주소 검색</h2><button class="icon-btn" data-act="closeAddr" aria-label="닫기">${I.x}</button></header>${body}</div></div>`;
 if(postcodeReady&&PC&&WEB_ORIGIN){el.innerHTML=shell(`<div id="postcodeWrap" class="postcode-wrap"></div>`);
  new PC({width:'100%',height:'100%',
   oncomplete:d=>{const road=d.userSelectedType==='J'?'':(d.roadAddress||d.autoRoadAddress||'');const jibun=d.jibunAddress||d.autoJibunAddress||'';
    let extra='';if(road){if(d.bname&&/[동로가]$/.test(d.bname))extra+=d.bname;if(d.buildingName&&d.apartment==='Y')extra+=(extra?', ':'')+d.buildingName}
    const addr=road?road+(extra?` (${extra})`:''):jibun;
    fillAddrInputs(d.zonecode,addr);
    applyAddr({zip:d.zonecode,address:addr,jibun:road?jibun:'',sido:d.sido,sigungu:d.sigungu,lat:null,lng:null})}}).embed($('#postcodeWrap'),{autoClose:true});return}
 const note=`<div class="warnbox">카카오 우편번호 서비스를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 창을 닫고 다시 열거나, 아래에 주소를 직접 입력하세요.</div>`;
 if(!postcodeReady)initPostcode();
 el.innerHTML=shell(`<div class="body" style="display:grid;gap:12px">${note}
 ${manualAddrHTML(true)}</div>`);
 if(window.innerWidth>860)setTimeout(()=>$('#manualAddr')?.focus(),20)}
function applyAddr(a){if(!ui.form)return;Object.assign(ui.form,a);ui.formErr='';ui.addr=null;
 setTimeout(()=>{renderAddr();refreshFormHost();fillAddrInputs(ui.form?.zip,ui.form?.address);const d=$('#f-detail');if(d&&window.innerWidth>860){d.focus();d.select()}},0);
 try{if(!a.lat&&kakaoReady&&window.kakao?.maps?.services){new kakao.maps.services.Geocoder().addressSearch(a.address,(r,st)=>{if(st===kakao.maps.services.Status.OK&&r[0]&&ui.form){ui.form.lat=+r[0].y;ui.form.lng=+r[0].x;refreshFormHost()}})}}catch(e){}}
function refreshFormHost(){if(ui.modal?.type==='register'||ui.modal?.type==='comp')renderModal();else renderDrawer()}

/* ============ 병원 상세 드로어 ============ */
const DTABS=[['info','기본 정보','hospital'],['eval','리드 평가','eval'],['act','영업 활동','activity'],['conv','전환·사용','conv'],['hist','변경 이력','history']];
function openDetail(id,tab){if(!canRead('hospital')){toast('병원 열람 권한이 없습니다');return}ui.detailId=id;const h=getH(id);const tabs=DTABS.filter(t=>canSee(t[2]));ui.tab=tab&&tabs.some(t=>t[0]===tab)?tab:tabs[0]?.[0];
 ui.form=formFromH(h);ui.formErr='';ui.evalDraft=clone(h.eval||{});ui.actDraft={type:'방문',date:today(),note:''};ui.nextDraft=clone(h.next||{});ui.convDraft={signupDate:h.signupDate,usageCount:h.usageCount,lastUsedDate:h.lastUsedDate,memo:h.memo};ui.histTab={user:'',section:''};renderDrawer()}
function closeDetail(){ui.detailId=null;ui.form=null;renderDrawer()}
let lastDrawer=null;function renderDrawer(){const el=$('#drawerLayer');const h=ui.detailId&&getH(ui.detailId);if(!h||!cur()){el.innerHTML='';lastDrawer=null;return}const enter=lastDrawer!==h.id;const sameTab=renderDrawer.tab===ui.tab;lastDrawer=h.id;renderDrawer.tab=ui.tab;const keepScroll=enter||!sameTab?0:($('#drawerLayer .d-body')?.scrollTop||0);
 const si=STAGES.indexOf(h.stage);const up=can('hospital','update',h);const hcount=S.audit.filter(e=>e.hospitalId===h.id).length;
 const tabs=DTABS.filter(t=>canSee(t[2]));const badge={eval:canRead('eval')&&evalN(h)<3?`${evalN(h)}/3`:'',act:canRead('activity')?h.activities.length:'',hist:canRead('history')?hcount:''};
 el.innerHTML=`<div class="drawer-wrap" data-act="bdDrawer"><aside class="drawer ${enter?'enter':''}" role="dialog" aria-modal="true" aria-labelledby="dt">
 ${h.deletedAt?`<div class="del-banner"><span>${fd(h.deletedAt)} ${esc(userName(h.deletedBy)||'')}님이 삭제한 병원입니다</span>${can('hospital','delete',h)?'<button class="btn sm" data-act="restoreH">복원</button>':''}</div>`:''}
 <header><div style="min-width:0"><div class="d-id">${h.id} · 등록 ${fd(h.createdAt)} ${esc(userName(h.createdBy))} · 담당 ${esc(userName(h.ownerId)||'미지정')}</div><h2 id="dt">${esc(h.name)}</h2><div class="d-sub">${esc([h.grade,h.specialty,region(h)].filter(Boolean).join(' · '))}</div></div>
  <div style="display:flex;gap:4px">${h.lat&&canRead('map')&&!h.deletedAt?`<button class="btn sm" data-act="showOnMap" data-id="${h.id}">${I.pin}지도</button>`:''}<button class="icon-btn" data-act="closeDetail" aria-label="닫기">${I.x}</button></div></header>
 <div class="d-meta">
  <div><div class="stepper">${STAGES.slice(0,MAIN_N).map((s,i)=>`<button class="step ${i===si?'cur':si<MAIN_N&&i<si?'done':''}" style="--c:${sc(s)}" data-act="setStage" data-v="${s}" ${dis(!up)}>${s}</button>`).join('')}</div>
  <div class="step-side" style="margin-top:8px">${preBadge(h)}${canRead('eval')&&canEvalStage(h)?gradeBadge(h):''} ${canRead('activity')?followBadge(h):''} <span style="margin-left:auto">이탈 처리</span>${STAGES.slice(MAIN_N).map(s=>`<button class="step ${h.stage===s?'cur':''}" style="--c:${sc(s)};flex:none" data-act="setStage" data-v="${s}" ${dis(!up)}>${s}</button>`).join('')}</div></div>
  <div class="chips">${S.categories.map(c=>`<button class="chip-toggle ${h.categoryIds.includes(c.id)?'on':''}" style="--cc:${c.color}" data-act="toggleHCat" data-v="${c.id}" ${dis(!up)}><i></i>${esc(c.name)}</button>`).join('')}${h.categoryIds.length?'':'<span class="cat-chip none">미분류</span>'}</div>
 </div>
 <nav class="tabs">${tabs.map(([k,l])=>`<button class="tab ${ui.tab===k?'on':''}" data-act="tab" data-v="${k}">${l}${badge[k]!==''&&badge[k]!=null&&badge[k]!==0?`<span class="n">${badge[k]}</span>`:''}</button>`).join('')}</nav>
 <div class="d-body">${!ui.tab?lockedHTML('hospital'):(()=>{const f=DTABS.find(t=>t[0]===ui.tab)[2];if(!can(f,'read'))return `<section class="panel">${lockedHTML(f)}</section>`;
   return ui.tab==='info'?infoTab(h):ui.tab==='eval'?evalTab(h):ui.tab==='act'?actTab(h):ui.tab==='conv'?convTab(h):histTab(h)})()}</div>
 </aside></div>`;if(keepScroll){const b=$('#drawerLayer .d-body');if(b)b.scrollTop=keepScroll}}
function infoTab(h){const ro=!can('hospital','update',h);return `${ro?roHTML('hospital',h):''}<section class="panel">${formHTML(ui.form,'edit',ro)}</section>
 <div class="d-foot">${can('hospital','delete',h)&&!h.deletedAt?`<button class="btn danger" data-act="delH">${I.trash}병원 삭제</button>`:'<span></span>'}${ro?'':`<div style="display:flex;gap:8px"><button class="btn" data-act="resetInfo">되돌리기</button><button class="btn primary" data-act="saveInfo">기본 정보 저장</button></div>`}</div>`}
function evalTab(h){const e=ui.evalDraft;const has=evalN(h)>0||(h.eval?.shots||[]).length>0;const ro=!(has?can('eval','update',h):can('eval','create',h));
 if(!canEvalStage(h)&&!has)return `<section class="panel ev-lock"><h2>리드 평가 <small>1차 방문 이후에 평가할 수 있습니다</small></h2>
  <p>현재 단계는 ${stageBadge(h.stage)}입니다. 병원을 직접 방문해 본 뒤 수용도·호감도·마취 규모를 판단할 수 있도록, 리드 평가는 <b>1차 방문 이후</b>에 열립니다.</p>
  <p class="hint">영업 활동 탭에서 ‘방문’을 기록하면 자동으로 1차 방문 단계가 되고 평가가 열립니다.</p>
  ${can('activity','create',h)?'<button class="btn primary" data-act="tab" data-v="act">영업 활동 기록하러 가기</button>':''}</section>`;
 const seg=(k)=>`<div class="seg lv-seg">${[0,1,2,3,4,5].map(v=>`<button type="button" class="${String(e[k]??'')===String(v)?'on':''}" data-act="setEval" data-k="${k}" data-v="${v}" ${dis(ro)}>${v}</button>`).join('')}<button type="button" class="${hasEval(e[k])?'':'on'}" data-act="setEval" data-k="${k}" data-v="" ${dis(ro)} title="값 비우기">미입력</button></div>`;
 const shots=e.shots||[];
 const shotHTML=`<div class="shots" id="ev-shots">${shots.map((x,i)=>`<div class="shot" role="button" tabindex="0" data-act="shotView" data-i="${i}" aria-label="근거 이미지 ${i+1} 크게 보기"><img src="${x.data}" alt="${esc(x.name||'근거 이미지')}">${ro?'':`<button type="button" class="shot-del" data-act="shotDel" data-i="${i}" aria-label="이미지 삭제">${I.x}</button>`}</div>`).join('')}
  ${!ro&&shots.length<MAX_SHOTS?`<label class="shot-add" tabindex="0">${I.plus}<span>이미지 추가<br><small>또는 캡처 후 Ctrl+V</small></span><input type="file" accept="image/*" multiple data-evfile></label>`:''}</div>`;
 return `${ro?roHTML('eval',h):''}<section class="panel"><h2>리드 평가 <small>${h.eval?.date?`최근 평가 ${fd(h.eval.date)}`:'아직 평가 전'}</small></h2><div style="display:grid;gap:18px">
  ${EVAL_ITEMS.map(([k,l,d])=>`<div class="ev-item"><span><b>${l}</b> <small>${d}</small></span>${seg(k)}${k==='adoption'?`<div class="fld"><span style="font-size:12.5px;color:var(--muted)">근거 화면 (캡처·업로드, 최대 ${MAX_SHOTS}장)</span>${shotHTML}</div>`:''}${k==='surgeries'?`<label class="fld" style="max-width:240px"><span style="font-size:12.5px;color:var(--muted)">실제 건수 (참고, 선택)</span><input type="number" min="0" data-ev="surgeryCount" value="${esc(e.surgeryCount??'')}" placeholder="예: 24" ${dis(ro)}></label>`:''}</div>`).join('')}
 </div></section>
 <section class="panel score-card" id="scorePreview">${scoreHTML(e)}</section>
 <div class="d-foot">${has&&can('eval','delete',h)?'<button class="btn danger" data-act="delEval">평가 삭제</button>':'<span class="hint" style="align-self:center">세 항목을 모두 고르면 종합 등급이 정해집니다.</span>'}${ro?'':`<button class="btn primary" data-act="saveEval">${has?'평가 수정':'평가 저장'}</button>`}</div>`}
function scoreHTML(e){const sum=evalSum(e);const g=gradeFromSum(sum);const pt=k=>hasEval(e[k])?+e[k]:0;
 return `<div class="score-top"><span class="badge g-${g}" style="font-size:15px;padding:4px 12px">${sum!=null?'리드 ':''}${g}</span><b>${sum??'—'}</b><small>/ ${EVAL_TOTAL}점</small></div>
 <div class="sum-bar">${EVAL_ITEMS.map(([k,l])=>`<div><span>${l}</span><b>${hasEval(e[k])?`${pt(k)}점`:'미입력'}</b></div>`).join('')}</div>
 <p class="hint">세 항목을 각각 <b>0~5점</b>으로 평가해 더한 뒤(최대 15점) <b>11~15점 상</b> / <b>6~10점 중</b> / <b>0~5점 하</b>로 분류합니다. 세 항목 중 하나라도 비어 있으면 ‘미평가’입니다.</p>`}
function extrasHTML(a,attr){const v=k=>esc(a[k]||'');const any=a.vocText||a.compId||a.compText||a.issText;
 return `<details class="act-extra" ${any?'open':''}><summary>보고서 항목 (선택) <small>여기 적으면 그날 영업 보고서에 자동으로 들어갑니다</small></summary><div class="ax-grid">
  <b>고객의 소리</b><select ${attr}="vocType">${VOC_TYPES.map(t=>`<option ${a.vocType===t?'selected':''}>${t}</option>`).join('')}</select><input ${attr}="vocText" value="${v('vocText')}" placeholder="고객이 한 말, 요청 내용">
  <b>경쟁사 언급</b><select ${attr}="compId"><option value="">경쟁사 선택</option>${(S.competitors||[]).map(c=>`<option value="${c.id}" ${a.compId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><input ${attr}="compText" value="${v('compText')}" placeholder="제안 조건, 병원 반응">
  <b>지원 요청</b><select ${attr}="issType">${ISSUE_TYPES.map(t=>`<option ${a.issType===t?'selected':''}>${t}</option>`).join('')}</select><input ${attr}="issText" value="${v('issText')}" placeholder="필요한 지원과 이유">
 </div></details>`}
function extrasOf(a){const o={voc:null,comp:null,issue:null};const t=k=>String(a[k]||'').trim();
 if(t('vocText'))o.voc={type:a.vocType||VOC_TYPES[0],text:t('vocText')};
 if(a.compId||t('compText'))o.comp={competitorId:a.compId||'',text:t('compText')};
 if(t('issText'))o.issue={type:a.issType||ISSUE_TYPES[0],text:t('issText')};
 Object.keys(o).forEach(k=>{if(!o[k])delete o[k]});return o}
const extrasDraft=x=>({vocType:x.voc?.type||VOC_TYPES[0],vocText:x.voc?.text||'',compId:x.comp?.competitorId||'',compText:x.comp?.text||'',issType:x.issue?.type||ISSUE_TYPES[0],issText:x.issue?.text||''});
const extrasChips=x=>`${x.voc?`<span class="cat-chip">VOC · ${esc(x.voc.type)}</span>`:''}${x.comp?`<span class="cat-chip">경쟁사 · ${esc(compById(x.comp.competitorId)?.name||'미지정')}</span>`:''}${x.issue?`<span class="cat-chip">지원 요청 · ${esc(x.issue.type)}</span>`:''}`;
function actTab(h){const n=ui.nextDraft,a=ui.actDraft;const fs=followOf(h);const ci=contactInfo(h);
 const hasNext=!!(h.next?.date||h.next?.todo);const nro=!(hasNext?can('activity','update',h):can('activity','create',h));const cC=can('activity','create',h),cU=can('activity','update',h),cD=can('activity','delete',h);
 const sys=(h.stageHistory||[]).map(x=>({date:x.date,sys:true,type:`단계 변경 · ${x.from} → ${x.to}`}));
 const items=[...h.activities.map(x=>({...x})),...sys].sort((p,q)=>q.date.localeCompare(p.date)||(p.sys?1:-1));const editing=!!a.id;
 return `<div class="stats"><div><span>최초 접촉일</span><b>${fd(ci.first)||'—'}</b></div><div><span>최근 접촉일</span><b>${fd(ci.last)||'—'}</b></div><div><span>1차 방문일</span><b>${fd(ci.v1)||'—'}</b></div><div><span>2차 방문일</span><b>${fd(ci.v2)||'—'}</b></div></div>
 ${!cC&&!cU?roHTML('activity',h):''}
 <section class="panel"><h2>다음 액션 ${fs!=='없음'?`<span class="badge f-${fs}">${fs}</span>`:''}</h2><div style="display:grid;gap:10px">
  <div class="row-2"><label class="fld"><span>다음 액션일</span><input type="date" id="nx-date" data-nx="date" value="${esc(n.date||'')}" ${dis(nro)}></label>
  <div class="fld"><span>처리</span><label class="check" style="padding-top:6px"><input type="checkbox" id="nx-done" data-nx="done" ${n.done?'checked':''} ${dis(nro)}>완료함</label></div></div>
  <label class="fld"><span>팔로우업 할 사항</span><textarea id="nx-todo" data-nx="todo" rows="2" placeholder="예: 2차 방문 때 태블릿 시연" ${dis(nro)}>${esc(n.todo||'')}</textarea></label>
  ${nro?'':`<div style="display:flex;justify-content:flex-end;gap:8px">${hasNext&&cD?'<button class="btn ghost" data-act="clearNext">다음 액션 지우기</button>':''}<button class="btn primary" data-act="saveNext">다음 액션 저장</button></div>`}</div></section>
 ${cC||editing?`<section class="panel"><h2>${editing?'활동 기록 수정':'활동 기록 추가'} <small>작성자 ${esc(cur().name)} · 방문을 기록하면 1차·2차 방문일이 자동으로 채워집니다</small></h2><div style="display:grid;gap:10px">
  <div class="act-fields"><label class="fld"><span>유형</span><select id="ac-type" data-ac="type">${ACT_TYPES.map(t=>`<option ${a.type===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="fld"><span>날짜</span><input type="date" id="ac-date" data-ac="date" value="${esc(a.date)}" max="${today()}"></label>
  <label class="fld"><span>목적</span><select id="ac-purpose" data-ac="purpose"><option value="">선택</option>${ACT_PURPOSES.map(t=>`<option ${a.purpose===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="fld"><span>면담자</span><select id="ac-contact" data-ac="contact"><option value="">선택</option>${ACT_CONTACTS.map(t=>`<option ${a.contact===t?'selected':''}>${t}</option>`).join('')}</select></label></div>
  <div class="fld"><span>반응</span><div class="seg">${ACT_REACTIONS.map(t=>`<button type="button" class="${a.reaction===t?'on':''}" data-act="acReact" data-v="${t}">${t}</button>`).join('')}</div></div>
  <textarea id="ac-note" data-ac="note" rows="3" placeholder="주요 코멘트/피드백">${esc(a.note)}</textarea>
  ${extrasHTML(a,'data-ac')}
  <div style="display:flex;justify-content:flex-end;gap:8px">${editing?'<button class="btn" data-act="cancelAct">취소</button><button class="btn primary" data-act="saveAct">수정 저장</button>':`<button class="btn primary" data-act="addAct">${I.plus}기록 추가</button>`}</div></div></section>`:''}
 <section class="panel"><h2>활동 이력 <small>${h.activities.length}건</small></h2>${items.length?`<ul class="timeline">${items.map(x=>`<li class="${x.sys?'sys':''}"><span class="tl-date">${fd(x.date)}</span><span class="tl-dot"></span><div><div class="tl-type">${esc(x.type)}${x.purpose?` · ${esc(x.purpose)}`:''}${x.authorId?` <span class="muted" style="font-weight:400;font-size:12px">· ${esc(userName(x.authorId)||'탈퇴 사용자')}</span>`:''}</div>${x.contact||x.reaction||x.voc||x.comp||x.issue?`<div class="tl-meta">${x.contact?`<span class="cat-chip">면담 ${esc(x.contact)}</span>`:''}${x.reaction?`<span class="badge re-${x.reaction}">${x.reaction}</span>`:''}${extrasChips(x)}</div>`:''}${x.note?`<div class="tl-note">${esc(x.note)}</div>`:''}</div>
  ${x.sys?'<span></span>':`<span style="display:flex">${cU?`<button class="icon-btn" data-act="editAct" data-v="${x.id}" aria-label="기록 수정">${I.edit}</button>`:''}${cD?`<button class="icon-btn" data-act="delAct" data-v="${x.id}" aria-label="기록 삭제">${I.trash}</button>`:''}</span>`}</li>`).join('')}</ul>`:'<div class="empty">아직 접촉 기록이 없습니다</div>'}</section>`}
function convTab(h){const c=ui.convDraft;const has=!!(h.signupDate||+h.usageCount||h.lastUsedDate||h.memo);const ro=!(has?can('conv','update',h):can('conv','create',h));
 return `${ro?roHTML('conv',h):''}<section class="panel"><h2>회원가입 · 사용 <small>실서비스에서는 VitalVET 플랫폼에서 자동 연동 권장</small></h2><div class="form-grid">
 <label class="fld"><span>회원가입일</span><input type="date" id="cv-sign" data-cv="signupDate" value="${esc(c.signupDate||'')}" ${dis(ro)}></label>
 <label class="fld"><span>VitalVET 누적 사용 건수</span><input type="number" min="0" id="cv-use" data-cv="usageCount" value="${esc(c.usageCount??0)}" ${dis(ro)}></label>
 <label class="fld"><span>최근 사용일</span><input type="date" id="cv-last" data-cv="lastUsedDate" value="${esc(c.lastUsedDate||'')}" ${dis(ro)}></label><div></div>
 <label class="fld span2"><span>비고</span><textarea id="cv-memo" data-cv="memo" rows="4" ${dis(ro)}>${esc(c.memo||'')}</textarea></label></div></section>
 <div class="d-foot">${has&&can('conv','delete',h)?'<button class="btn danger" data-act="delConv">전환 정보 삭제</button>':'<span class="hint" style="align-self:center">가입일이나 사용 건수를 넣으면 단계가 자동으로 올라갑니다.</span>'}${ro?'':'<button class="btn primary" data-act="saveConv">저장</button>'}</div>`}
function histTab(h){const F=ui.histTab;const all=S.audit.filter(e=>e.hospitalId===h.id);const users=[...new Map(all.map(e=>[e.userId,e.userName])).entries()];const secs=[...new Set(all.map(e=>e.section))];
 const items=all.filter(e=>(!F.user||e.userId===F.user)&&(!F.section||e.section===F.section)).sort((a,b)=>b.ts.localeCompare(a.ts));
 return `<div class="toolbar" style="margin:0"><select id="ht-user" data-ht="user" aria-label="작성자"><option value="">작성자 전체</option>${users.map(([id,n])=>`<option value="${id}" ${F.user===id?'selected':''}>${esc(n)}</option>`).join('')}</select>
 <select id="ht-sec" data-ht="section" aria-label="구분"><option value="">구분 전체</option>${secs.map(s=>`<option ${F.section===s?'selected':''}>${esc(s)}</option>`).join('')}</select><span class="hint">${items.length}건 · 최신순</span></div>
 ${auditList(items,false)}`}

/* ============ 전체 변경 이력 ============ */
function histHTML(){const F=ui.hist;const q=F.q.trim();const users=S.users;
 const list=S.audit.filter(e=>(!F.entity||e.entity===F.entity)&&(!F.user||e.userId===F.user)&&(!F.action||e.action===F.action)&&(!q||(e.targetName||'').includes(q)||(e.changes||[]).some(c=>(c.before+c.after).includes(q)))).sort((a,b)=>b.ts.localeCompare(a.ts));
 return `<div class="page-head"><div><h1>변경 이력</h1><p>누가, 언제, 무엇을, 어떻게 바꿨는지 모든 등록·수정·삭제·복원을 기록합니다. 이력은 수정하거나 지울 수 없습니다.</p></div></div>
 <div class="toolbar"><label class="search">${I.search}<input type="search" id="hq" data-hf="q" value="${esc(F.q)}" placeholder="병원명·내용 검색"></label>
 <select id="hf-ent" data-hf="entity" aria-label="대상">${[['','대상 전체'],...Object.entries(ENTITY_LABEL)].map(([v,l])=>`<option value="${v}" ${F.entity===v?'selected':''}>${l}</option>`).join('')}</select>
 <select id="hf-user" data-hf="user" aria-label="작성자"><option value="">작성자 전체</option>${users.map(u=>`<option value="${u.id}" ${F.user===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>
 <select id="hf-act" data-hf="action" aria-label="작업">${[['','작업 전체'],...Object.entries(ACTION_LABEL)].map(([v,l])=>`<option value="${v}" ${F.action===v?'selected':''}>${l}</option>`).join('')}</select></div>
 <p class="count-line">${list.length}건</p>${auditList(list.slice(0,F.limit),true)}${list.length>F.limit?`<div style="text-align:center;margin-top:12px"><button class="btn" data-act="histMore">더 보기 (${list.length-F.limit}건 남음)</button></div>`:''}`}

/* ============ 카테고리 ============ */
function catHTML(){const H=liveH();const ce=ui.catEdit;const cU=can('category','update'),cD=can('category','delete'),cC=can('category','create');
 const form=(c)=>`<div class="cat-form"><div class="form-grid"><label class="fld"><span>이름 <em>*</em></span><input id="ce-name" data-ce="name" value="${esc(c.name)}" placeholder="예: 11월 세미나 초청"></label>
  <label class="fld"><span>설명</span><input id="ce-desc" data-ce="desc" value="${esc(c.desc||'')}" placeholder="선택"></label>
  <div class="fld span2"><span>색상 <small>지도·목록에서 구분용</small></span><div class="swatches">${CAT_COLORS.map(col=>`<button type="button" class="sw ${c.color===col?'on':''}" style="--cc:${col}" data-act="ceColor" data-v="${col}" aria-label="색상 ${col}"></button>`).join('')}</div></div>
  ${ce.err?`<p class="err span2">${esc(ce.err)}</p>`:''}</div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-act="ceCancel">취소</button><button class="btn primary" data-act="ceSave">${c.id?'변경 저장':'추가'}</button></div></div>`;
 const row=(c,sys)=>{const list=H.filter(h=>inCat(h,sys?'__none':c.id));if(ce&&ce.id===c.id&&!sys)return form(ce);
  return `<div class="cat-row"><div class="cat-name" style="--cc:${sys?'var(--none)':c.color}"><i></i><div style="min-width:0"><b>${esc(c.name)}</b>${sys?'<span class="lock">기본</span>':''}<p>${esc(sys?'카테고리를 하나도 선택하지 않은 병원':c.desc||'설명 없음')}</p></div></div>
  <div class="dist">${distBar(list)}<div class="dist-cap"><span><b class="num">${list.length}</b>곳</span>${STAGES.map(s=>{const n=list.filter(h=>h.stage===s).length;return n?`<span>${s} ${n}</span>`:''}).join('')}</div></div>
  <div class="cat-actions">${canRead('map')?`<button class="btn sm" data-act="mapCat" data-v="${sys?'__none':c.id}">${I.map}지도</button>`:''}${sys?'':`${cU?`<button class="icon-btn" data-act="ceEdit" data-v="${c.id}" aria-label="수정">${I.edit}</button>`:''}${cD?`<button class="icon-btn" data-act="ceDel" data-v="${c.id}" aria-label="삭제">${I.trash}</button>`:''}`}</div></div>`};
 return `<div class="page-head"><div><h1>카테고리</h1><p>권역, 캠페인, 관심사 등으로 병원을 묶어 두면 지도에서 한 번에 볼 수 있습니다. 병원 하나에 여러 카테고리를 지정할 수 있어요.</p></div>
 ${ce&&!ce.id||!cC?'':`<button class="btn primary" data-act="ceNew">${I.plus}카테고리 추가</button>`}</div>
 ${!cC&&!cU&&!cD?`<div class="ro-note" style="margin-bottom:12px">${I.lock}읽기 전용 · ${esc(roleOf(cur()).name)} 역할에는 카테고리 편집 권한이 없습니다</div>`:''}
 <div class="cat-rows">${ce&&!ce.id?form(ce):''}${S.categories.map(c=>row(c)).join('')}${row({name:'미분류'},true)}</div>`}

/* ============ 사용자·권한 ============ */
function usersHTML(){const T=ui.usersTab;
 return `<div class="page-head"><div><h1>사용자·권한</h1><p>가입 신청을 승인하고, 역할마다 메뉴별 표시·읽기·입력·수정·삭제 권한을 정합니다.</p></div>
 ${T==='users'&&can('users','create')?`<button class="btn primary" data-act="newUser">${I.plus}사용자 추가</button>`:''}${T==='roles'&&can('users','create')?`<button class="btn primary" data-act="newRole">${I.plus}역할 추가</button>`:''}</div>
 <div class="sub-tabs"><button class="tab ${T==='users'?'on':''}" data-act="usersTab" data-v="users">사용자 <span class="n">${S.users.length}</span></button><button class="tab ${T==='roles'?'on':''}" data-act="usersTab" data-v="roles">역할별 권한 <span class="n">${S.roles.length}</span></button></div>
 ${T==='users'?usersTable():rolesPanel()}`}
function usersTable(){const pend=S.users.filter(u=>u.status==='pending');const cU=can('users','update'),cD=can('users','delete');
 const lastAct=id=>{const e=[...S.audit].reverse().find(x=>x.userId===id);return e?fmtTs(e.ts):'—'};
 const stL={active:['활성','st-active'],inactive:['비활성','st-inactive'],pending:['승인 대기','st-pending']};
 return `${pend.length?`<div class="pending-box"><b>가입 승인 대기 ${pend.length}명</b>${pend.map(u=>`<div class="pending-row"><div class="u-cell">${av(u)}<div><b>${esc(u.name)}</b><small>${esc(u.username)} · ${esc(u.team||'소속 미입력')} · 신청 ${fd(u.joinedAt)}</small></div></div>
  ${cU?`<select id="ap-${u.id}" aria-label="역할">${S.roles.map(r=>`<option value="${r.id}" ${r.id==='r_sales'?'selected':''}>${esc(r.name)}</option>`).join('')}</select><button class="btn primary sm" data-act="approve" data-v="${u.id}">승인</button>`:''}${cD?`<button class="btn sm danger" data-act="reject" data-v="${u.id}">거절</button>`:''}</div>`).join('')}</div>`:''}
 <div class="tbl-wrap"><table class="stack"><thead><tr><th>사용자</th><th>소속</th><th>역할</th><th>상태</th><th>담당 병원</th><th>최근 작업</th><th></th></tr></thead><tbody>
 ${S.users.filter(u=>u.status!=='pending').map(u=>`<tr><td><div class="u-cell">${av(u)}<div><b>${esc(u.name)}${u.id===cur().id?' <span class="badge f-예정" style="padding:0 6px">나</span>':''}</b><small>${esc(u.username)}</small></div></div></td><td class="h-sub" data-label="소속">${esc(u.team||'—')}</td>
 <td data-label="역할">${esc(roleOf(u)?.name||'—')}</td><td data-label="상태"><span class="badge ${stL[u.status][1]}">${stL[u.status][0]}</span></td><td class="num" data-label="담당 병원">${liveH().filter(h=>h.ownerId===u.id).length}</td><td class="mono h-sub" data-label="최근 작업" style="white-space:nowrap">${lastAct(u.id)}</td>
 <td class="right" style="white-space:nowrap">${cU?`<button class="icon-btn" data-act="editUser" data-v="${u.id}" aria-label="수정">${I.edit}</button>`:''}${cD&&u.id!==cur().id?`<button class="icon-btn" data-act="delUser" data-v="${u.id}" aria-label="삭제">${I.trash}</button>`:''}</td></tr>`).join('')}</tbody></table></div>
 ${!cU&&!cD?`<div class="ro-note" style="margin-top:12px">${I.lock}읽기 전용 · ${esc(roleOf(cur()).name)} 역할은 사용자를 조회만 할 수 있습니다</div>`:''}`}
function rolesPanel(){if(!S.roles.some(r=>r.id===ui.roleSel))ui.roleSel=S.roles[0].id;const role=S.roles.find(r=>r.id===ui.roleSel);
 if(!ui.roleDraft||ui.roleDraft.id!==role.id)ui.roleDraft=clone(role);const d=ui.roleDraft;const ro=role.locked||!can('users','update');const n=S.users.filter(u=>u.roleId===role.id).length;
 return `<div class="two-col"><div class="role-list">${S.roles.map(r=>`<button class="role-btn ${r.id===role.id?'on':''}" data-act="roleSel" data-v="${r.id}"><b>${esc(r.name)}</b><span class="muted num" style="font-size:12px">${S.users.filter(u=>u.roleId===r.id).length}명</span><small>${esc(r.desc||'')}</small></button>`).join('')}</div>
 <section class="panel"><div class="form-grid" style="margin-bottom:14px"><label class="fld"><span>역할 이름</span><input id="rd-name" data-rd="name" value="${esc(d.name)}" ${dis(ro)}></label>
  <label class="fld"><span>수정 범위 <small>병원·평가·활동·전환에 적용</small></span><select id="rd-scope" data-rd="scope" ${dis(ro)}><option value="all" ${d.scope==='all'?'selected':''}>전체 병원</option><option value="own" ${d.scope==='own'?'selected':''}>내 담당 병원만</option></select></label>
  <label class="fld span2"><span>설명</span><input id="rd-desc" data-rd="desc" value="${esc(d.desc||'')}" ${dis(ro)}></label></div>
  ${role.locked?`<div class="ro-note" style="margin-bottom:12px">${I.lock}관리자 역할은 잠겨 있습니다. 권한 관리를 잃지 않도록 항상 모든 권한을 가집니다.</div>`:ro?roHTML('users'):''}
  <div class="tbl-wrap"><table class="perm"><thead><tr><th>기능</th>${OPS.map(o=>`<th>${o[1]}</th>`).join('')}</tr></thead><tbody>
  ${FEATURES.map(([k,l,ops,desc])=>`<tr><td><b>${l}</b><span class="fdesc">${esc(desc)}</span></td>${OPS.map(([o])=>`<td>${ops.includes(o)?`<input type="checkbox" data-perm="${k}" data-op="${o}" ${d.perms[k]?.[o]?'checked':''} ${dis(ro)} aria-label="${l} ${o}">`:'<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="hint" style="margin-top:8px">표시를 끄면 메뉴·탭이 아예 보이지 않습니다. 표시만 켜고 읽기를 끄면 메뉴는 보이지만 내용은 잠깁니다. 입력·수정·삭제를 켜면 읽기와 표시가 함께 켜집니다.</p>
  ${ro?'':`<div class="d-foot" style="margin-top:12px">${can('users','delete')?`<button class="btn danger" data-act="delRole" ${n?'disabled title="사용 중인 역할은 삭제할 수 없습니다"':''}>${I.trash}역할 삭제${n?` (사용자 ${n}명)`:''}</button>`:'<span></span>'}<div style="display:flex;gap:8px"><button class="btn" data-act="roleReset">되돌리기</button><button class="btn primary" data-act="roleSave">권한 저장</button></div></div>`}
 </section></div>`}

/* ============ 설정 ============ */
function settingsHTML(){const st=S.settings;const ro=!can('settings','update');const codeBox=(key,title,usedBy)=>`<section class="panel"><h2>${title}</h2><ul class="code-list">${S.codes[key].map((v,i)=>{const n=liveH().filter(h=>h[usedBy]===v).length;return `<li><span>${esc(v)}</span><small>${n}곳</small>${ro?'':`<button class="icon-btn" data-act="codeRen" data-k="${key}" data-i="${i}" aria-label="이름 변경">${I.edit}</button><button class="icon-btn" data-act="codeDel" data-k="${key}" data-i="${i}" aria-label="삭제">${I.trash}</button>`}</li>`}).join('')}</ul>
 ${ro?'':`<div class="inline-add"><input id="add-${key}" placeholder="새 항목"><button class="btn" data-act="codeAdd" data-k="${key}">추가</button></div>`}</section>`;
 return `<div class="page-head"><div><h1>설정</h1><p>지도 연동, 리드 등급 기준, 선택 목록을 관리합니다. 담당 영업사원 목록은 사용자·권한에서 관리합니다.</p></div></div>
 ${ro?`<div style="margin-bottom:12px">${roHTML('settings')}</div>`:''}
 <div class="set-grid">
 <section class="panel"><h2>카카오맵 연동 <span class="badge ${kakaoReady?'f-완료':'f-오늘'}">${kakaoReady?'연결됨':'미리보기 모드'}</span></h2>${CONFIG.KAKAO_JS_KEY?'<div class="ro-note" style="margin-bottom:12px">서버 설정(.env 의 KAKAO_JS_KEY)에 키가 있어 그 키를 씁니다.</div>':''}
  <div style="display:grid;gap:12px"><label class="fld"><span>JavaScript 앱 키</span><input id="kakaoKey" value="${esc(st.kakaoKey)}" placeholder="카카오 디벨로퍼스 > 앱 키 > JavaScript 키" autocomplete="off" ${dis(ro)}></label>
  ${ro?'':`<div style="display:flex;gap:8px"><button class="btn primary" data-act="saveKey">저장 후 연결</button>${st.kakaoKey?'<button class="btn" data-act="clearKey">키 지우기</button>':''}</div>`}
  ${ui.keyMsg?`<p class="${kakaoReady?'hint':'err'}">${esc(ui.keyMsg)}</p>`:''}
  <ol class="steps-list"><li>developers.kakao.com에서 애플리케이션을 추가합니다.</li><li>앱 설정 › 플랫폼 › Web에 이 CRM 주소를 등록합니다. 예: <span class="mono">${esc(location.origin)}</span></li><li>콘솔에 카카오맵 사용 설정 항목이 있으면 켭니다.</li><li>JavaScript 키를 위에 넣고 저장합니다.</li></ol>
  <p class="hint">키가 없거나 연결에 실패하면 좌표 기반 미리보기 지도로 표시됩니다. 주소 검색(우편번호)은 키 없이도 동작합니다.</p></div></section>
 <section class="panel"><h2>리드 등급·영업 목표 <small>0~5점 3항목 합산</small></h2><div style="display:grid;gap:12px">
  <p class="hint">디지털 수용도 · 서비스 호감도 · 월 마취 건수를 각각 0~5점으로 평가해 더합니다(최대 15점). <b>11~15점 상 · 6~10점 중 · 0~5점 하</b>. 평가는 1차 방문 이후 단계에서만 할 수 있습니다.</p>
  <div class="row-2"><label class="fld"><span>일일 방문 목표 <small>영업 보고 기준</small></span><input type="number" id="set-goal" value="${st.visitGoal||4}" min="1" max="20" ${dis(ro)}></label><div></div></div>
  ${ro?'':'<div><button class="btn primary" data-act="saveGrade">기준 저장</button></div>'}
</div></section>
 ${stagesHTML(ro)}
 ${codeBox('grades','병원 등급','grade')}${codeBox('specialties','전문과','specialty')}
 </div>`}

/* ============ 지도 ============ */
function mapFiltered(){const M=ui.map;return liveH().filter(h=>h.lat&&(!M.cats.size||[...M.cats].some(k=>inCat(h,k)))&&M.stages.has(h.stage))}
function renderMapView(){const m=$('#main');
 m.innerHTML=`<div class="map-shell"><aside class="map-side"><div class="ms-sec cats" id="msCats"></div><div class="ms-sec stages" id="msStages"></div><div class="ms-sec listsec" style="border-bottom:0" id="msList"></div></aside>
 <div class="map-area" id="mapArea"><div class="map-canvas" id="mapCanvas"></div>
  <div class="map-top"><div class="map-pill" id="mapPill"></div><div class="map-tools"><button class="btn sm" data-act="fitMap">전체 보기</button><button class="btn sm" data-act="toggleLabels">${ui.map.labels?'이름 숨기기':'이름 표시'}</button></div></div>
  </div><div id="mapCardHost" class="mhost"></div><div id="routeHost" class="mhost"></div></div>`;
 mapMounted=true;const el=$('#mapCanvas');mapAdapter=kakaoReady?new KakaoMap(el):new PreviewMap(el);refreshMap(true)}
function refreshMap(fit){if(!mapMounted)return;const M=ui.map;const H=liveH();const ev=canRead('eval'),ac=canRead('activity');
 const allRows=[{key:'',name:'전체',color:'var(--accent)'},...S.categories.map(c=>({key:c.id,name:c.name,color:c.color})),{key:'__none',name:'미분류',color:'var(--none)'}];
 $('#msCats').innerHTML=`<h3>카테고리 ${M.cats.size?'<button data-act="mcatAll">선택 해제</button>':''}</h3><div class="mcat">${allRows.map(r=>{const list=r.key?H.filter(h=>inCat(h,r.key)):H;const on=r.key?M.cats.has(r.key):!M.cats.size;
  return `<button class="mcat-btn ${on?'on':''}" style="--cc:${r.color}" data-act="mcat" data-v="${r.key}"><span class="box">${I.check}</span><span class="nm">${esc(r.name)}</span><span class="ct">${list.length}</span>${distBar(list)}</button>`}).join('')}</div>`;
 const pool=H.filter(h=>h.lat&&(!M.cats.size||[...M.cats].some(k=>inCat(h,k))));
 $('#msStages').innerHTML=`<h3>영업 단계 <button data-act="mstageAll">${M.stages.size===STAGES.length?'모두 끄기':'모두 켜기'}</button></h3><div class="stage-filters">${STAGES.map(s=>`<button class="sf ${M.stages.has(s)?'on':''}" style="--c:${sc(s)}" data-act="mstage" data-v="${s}"><i></i>${s} <span class="num">${pool.filter(h=>h.stage===s).length}</span></button>`).join('')}</div>`;
 const list=mapFiltered();if(M.sel&&!list.some(h=>h.id===M.sel))M.sel=null;const selH=M.sel&&getH(M.sel);
 const sorted=[...list].sort((a,b)=>selH?distKm(selH,a)-distKm(selH,b):a.name.localeCompare(b.name,'ko'));const noGeo=H.filter(h=>!h.lat).length;
 $('#msList').innerHTML=`<h3><span>병원 ${list.length}곳 ${selH?'· 선택 병원에서 가까운 순':''}</span></h3>${noGeo?`<p class="hint" style="padding:0 16px 8px">좌표가 없는 병원 ${noGeo}곳은 지도에 나오지 않습니다</p>`:''}
 <ul class="mlist">${sorted.map(h=>{const ri=M.route.indexOf(h.id);const fo=followOf(h);return `<li class="${M.sel===h.id?'sel':''}" data-act="msel" data-id="${h.id}"><div style="min-width:0"><div class="nm"><span class="dot" style="--c:${sc(h.stage)}"></span><span>${esc(h.name)}</span></div>
 <div class="sub">${esc(h.stage)}${ev?` · ${gradeOf(h)}`:''}${ac&&(fo==='지연'||fo==='오늘')?` · <span class="badge f-${fo}" style="padding:0 6px">${fo}</span>`:''}${selH&&selH!==h?` · ${kmTxt(distKm(selH,h))}`:''}</div></div>
 <button class="route-btn ${ri>=0?'on':''}" data-act="routeToggle" data-id="${h.id}" aria-label="${ri>=0?'동선에서 빼기':'동선에 추가'}" title="${ri>=0?'동선에서 빼기':'동선에 추가'}">${ri>=0?ri+1:I.plus}</button></li>`}).join('')||'<li style="cursor:default"><span class="muted">조건에 맞는 병원이 없습니다</span></li>'}</ul>`;
 const catNames=M.cats.size?[...M.cats].map(k=>k==='__none'?'미분류':catById(k)?.name).join(', '):'전체 카테고리';
 $('#mapPill').innerHTML=`<b>${esc(catNames)}</b><span class="muted">조건에 맞는 병원 ${list.length}곳</span><span id="mapView" class="muted"></span>`;
 $('#mapCanvas').classList.toggle('hide-labels',!M.labels);
 renderMapCard();renderRoute();
 mapAdapter.setMarkers(list,{sel:M.sel,route:M.route},id=>selectOnMap(id));
 mapAdapter.drawRoute(M.route.map(getH).filter(h=>h&&h.lat&&!h.deletedAt));
 if(fit)mapAdapter.fit(list)}
function selectOnMap(id,focus){ui.map.sel=id;refreshMap();if(focus){const h=getH(id);h&&mapAdapter.focus(h)}}
function renderMapCard(){const host=$('#mapCardHost');const h=ui.map.sel&&getH(ui.map.sel);if(!h){host.innerHTML='';return}
 const ci=contactInfo(h);const ri=ui.map.route.indexOf(h.id);const ac=canRead('activity'),cv=canRead('conv');
 host.innerHTML=`<div class="map-card"><div class="mc-head"><div style="min-width:0"><div class="d-id">${h.id} · 담당 ${esc(userName(h.ownerId)||'미지정')}</div><h3>${esc(h.name)}</h3></div><button class="icon-btn" data-act="mclose" aria-label="닫기">${I.x}</button></div>
 <div class="chips">${stageBadge(h.stage)}${canRead('eval')?gradeBadge(h):''}${ac?followBadge(h):''}</div>
 <dl class="mc-grid"><dt>주소</dt><dd>${esc(h.address)}${h.addressDetail?`, ${esc(h.addressDetail)}`:''}</dd>
 <dt>원장님</dt><dd>${esc(h.director||'—')} ${h.directorPhone?`<a class="mono" href="tel:${esc(h.directorPhone)}" style="color:var(--accent)">${esc(h.directorPhone)}</a>`:''}</dd>
 <dt>대표 전화</dt><dd class="mono">${esc(h.phone||'—')}</dd>
 <dt>등급·전문과</dt><dd>${esc([h.grade,h.specialty].filter(Boolean).join(' · ')||'—')}</dd>
 ${ac?`<dt>다음 액션</dt><dd>${h.next?.date?`<span class="mono">${fd(h.next.date)}</span> ${esc(h.next.todo||'')}`:'—'}</dd><dt>최근 접촉</dt><dd class="mono">${fd(ci.last)||'—'}</dd>`:''}
 ${cv&&h.usageCount>0?`<dt>사용</dt><dd>누적 <b class="num">${h.usageCount}</b>건 · 최근 <span class="mono">${fd(h.lastUsedDate)||'—'}</span></dd>`:''}
 <dt>카테고리</dt><dd><div class="chips">${catChips(h)}</div></dd></dl>
 <div class="mc-actions"><button class="btn primary sm" data-act="open" data-id="${h.id}">상세 보기</button><button class="btn sm" data-act="routeToggle" data-id="${h.id}">${I.route}${ri>=0?'동선에서 빼기':'동선에 추가'}</button>
 <a class="btn sm" href="https://map.kakao.com/link/to/${encodeURIComponent(h.name)},${h.lat},${h.lng}" target="_blank" rel="noopener">카카오맵 길찾기</a></div></div>`}
function renderRoute(){const host=$('#routeHost');const R=ui.map.route.map(getH).filter(h=>h&&!h.deletedAt);if(!R.length){host.innerHTML='';return}
 let tot=0;R.forEach((h,i)=>{if(i)tot+=distKm(R[i-1],h)});
 host.innerHTML=`<div class="route-panel"><h3>오늘 동선 <span class="muted mono" style="font-size:12px;font-weight:500">${R.length}곳 · 직선 ${kmTxt(tot)}</span></h3>
 <ol>${R.map((h,i)=>`<li><span class="n">${i+1}</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" data-act="msel" data-id="${h.id}">${esc(h.name)}</span><button class="icon-btn" style="width:24px;height:24px" data-act="routeToggle" data-id="${h.id}" aria-label="빼기">${I.x}</button>
 ${i<R.length-1?`<span class="leg">↓ ${kmTxt(distKm(h,R[i+1]))} · <a href="https://map.kakao.com/link/from/${encodeURIComponent(h.name)},${h.lat},${h.lng}/to/${encodeURIComponent(R[i+1].name)},${R[i+1].lat},${R[i+1].lng}" target="_blank" rel="noopener">길찾기</a></span>`:''}</li>`).join('')}</ol>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="routeOpt" ${R.length<3?'disabled':''}>가까운 순으로 정렬</button><button class="btn sm ghost" data-act="routeClear">비우기</button></div>
 <p class="hint" style="margin:0">1번 병원에서 출발해 가장 가까운 병원을 차례로 잇습니다. 거리는 직선 기준입니다.</p>
 <h3 style="margin-top:4px">내비로 안내</h3>${navHTML(R)}</div>`}
function pinEl(h,o){const b=document.createElement('button');b.type='button';const ri=o.route.indexOf(h.id);b.className='pin'+(o.sel===h.id?' sel':'');b.style.setProperty('--c',sc(h.stage));
 b.title=`${h.name} · ${h.stage}`;b.innerHTML=`<span class="pin-label">${esc(h.name)}</span><span class="pin-dot"><b>${ri>=0?ri+1:''}</b></span>`;return b}
function nearestOrder(ids){const pts=ids.map(getH);const out=[pts.shift()];while(pts.length){const last=out.at(-1);let bi=0,bd=Infinity;pts.forEach((p,i)=>{const d=distKm(last,p);if(d<bd){bd=d;bi=i}});out.push(pts.splice(bi,1)[0])}return out.map(h=>h.id)}


/* ============ 차트 (SVG, 컨테이너 폭에 맞춰 그림) ============ */
const CHARTS={};let chartSeq=0;
function chartBox(spec){const id='ch'+(++chartSeq);CHARTS[id]=spec;return `<div class="chart" id="${id}" style="height:${spec.type==='hbar'?hbarHeight(spec):spec.h||220}px" role="img" aria-label="${esc(spec.title||'차트')}"></div>`}
function drawCharts(){for(const id in CHARTS){const el=document.getElementById(id);if(!el){delete CHARTS[id];continue}const w=el.clientWidth;if(!w)continue;const s=CHARTS[id];el.innerHTML=s.type==='line'?lineSVG(s,w):s.type==='col'?colSVG(s,w):hbarSVG(s,w)}}
function niceStep(max,count=4){if(max<=count)return 1;const raw=max/count;const p=10**Math.floor(Math.log10(raw));const m=raw/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p}
function niceMax(max){const s=niceStep(max);return Math.max(s,Math.ceil(max/s)*s)}
const fmtN=v=>Number(v).toLocaleString('ko-KR');
function tipAttr(lines){return `data-tip="${esc(lines.join('\n'))}"`}
function legendHTML(series){if(series.length<2)return '';return `<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`}
function tableHTML(head,rows){return `<details class="tview"><summary>표로 보기</summary><div class="tbl-wrap"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'num':''}">${esc(c??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`}
function yAxis(max,H,pt,pb,pl,W,pr){const st=niceStep(max);let g='';for(let v=0;v<=max+1e-9;v+=st){const y=pt+(H-pt-pb)*(1-v/max);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--grid)" stroke-width="1"/><text x="${pl-6}" y="${y+4}" text-anchor="end" class="ax">${fmtN(Math.round(v*10)/10)}</text>`}return g}
function xLabels(labels,x,H,pb,avail){const n=labels.length;const k=Math.max(1,Math.ceil(n*48/avail));return labels.map((l,i)=>i%k===0||i===n-1&&(n-1)%k>k/2?`<text x="${x(i)}" y="${H-pb+16}" text-anchor="middle" class="ax">${esc(l)}</text>`:'').join('')}
function topRounded(x,y,w,h,r){if(h<=0)return '';r=Math.min(r,h,w/2);return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`}
function rightRounded(x,y,w,h,r){if(w<=0)return '';r=Math.min(r,w,h/2);return `M${x},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x}Z`}
function lineSVG(s,W){const H=s.h||220,pl=36,pr=14,pt=14,pb=26;const n=s.labels.length;const vals=s.series.flatMap(x=>x.values).filter(v=>v!=null);
 const max=niceMax(Math.max(s.goal||0,...vals,1));const aw=W-pl-pr;const x=i=>pl+(n<=1?aw/2:i*aw/(n-1));const y=v=>pt+(H-pt-pb)*(1-v/max);
 let g=yAxis(max,H,pt,pb,pl,W,pr)+xLabels(s.labels,x,H,pb,aw);
 if(s.goal){const gy=y(s.goal);g+=`<line x1="${pl}" x2="${W-pr}" y1="${gy}" y2="${gy}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/><text x="${W-pr}" y="${gy-5}" text-anchor="end" class="ax">목표 ${s.goal}</text>`}
 s.series.forEach(se=>{let d='',pen=false;se.values.forEach((v,i)=>{if(v==null){pen=false;return}d+=`${pen?'L':'M'}${x(i)},${y(v)}`;pen=true});
  g+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  se.values.forEach((v,i)=>{if(v==null)return;const lone=(se.values[i-1]==null)&&(se.values[i+1]==null);const last=i===se.values.length-1||se.values.slice(i+1).every(z=>z==null);if(lone||last)g+=`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`})});
 g+=`<line class="xh" x1="0" x2="0" y1="${pt}" y2="${H-pb}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>`;
 const bw=n<=1?aw:aw/(n-1);s.labels.forEach((l,i)=>{const lines=[s.full?.[i]||l,...s.series.map(se=>`${se.name}: ${se.values[i]==null?'보고 없음':fmtN(se.values[i])+(s.unit||'')}`)];
  g+=`<rect x="${x(i)-bw/2}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent" ${tipAttr(lines)} data-cx="${x(i)}"/>`});
 return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`}
function colSVG(s,W){const H=s.h||220,pl=36,pr=10,pt=14,pb=26;const n=s.labels.length;const k=s.series.length;
 const tot=s.labels.map((_,i)=>s.stacked?s.series.reduce((a,se)=>a+(se.values[i]||0),0):Math.max(...s.series.map(se=>se.values[i]||0)));
 const max=niceMax(Math.max(...tot,1));const aw=W-pl-pr;const band=aw/n;const x=i=>pl+band*i+band/2;const y=v=>pt+(H-pt-pb)*(1-v/max);const base=y(0);
 let g=yAxis(max,H,pt,pb,pl,W,pr)+xLabels(s.labels,x,H,pb,aw);
 s.labels.forEach((l,i)=>{const tip=tipAttr([s.full?.[i]||l,...s.series.map(se=>`${se.name}: ${fmtN(se.values[i]||0)}${s.unit||''}`),...(s.stacked&&k>1?[`합계: ${fmtN(tot[i])}${s.unit||''}`]:[])]);
  if(s.stacked){const bwid=Math.min(24,band*.62);let acc=0;const segs=s.series.map(se=>({c:se.color,v:se.values[i]||0})).filter(z=>z.v>0);
   segs.forEach((z,j)=>{const y1=y(acc+z.v),y0=y(acc);const top=j===segs.length-1;const h=y0-y1-(j>0?2:0);if(h>0)g+=top?`<path d="${topRounded(x(i)-bwid/2,y1,bwid,h,4)}" fill="${z.c}"/>`:`<rect x="${x(i)-bwid/2}" y="${y1}" width="${bwid}" height="${h}" fill="${z.c}"/>`;acc+=z.v})}
  else{const gw=Math.min(16,band*.8/k);const start=x(i)-gw*k/2-(k-1);s.series.forEach((se,j)=>{const v=se.values[i]||0;const y1=y(v);g+=`<path d="${topRounded(start+j*(gw+2),y1,gw,base-y1,4)}" fill="${se.color}"/>`})}
  g+=`<rect x="${pl+band*i}" y="${pt}" width="${band}" height="${H-pt-pb}" fill="transparent" ${tip}/>`});
 return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`}
function hbarHeight(s){return s.rows.length*(s.rowH||30)+8}
function hbarSVG(s,W){const rh=s.rowH||30,bh=Math.min(16,rh-12);const H=hbarHeight(s);const lw=Math.min(s.labelW||110,W*.34);const vlab=r=>s.percent?(r.note??''):(r.valueLabel??`${fmtN(r.segs.reduce((a,z)=>a+z.value,0))}${s.unit||''}`);const vw=Math.min(W*.3,Math.max(36,...s.rows.map(r=>textW(vlab(r))+14)));const aw=Math.max(40,W-lw-vw-8);
 const tots=s.rows.map(r=>r.segs.reduce((a,z)=>a+z.value,0));const max=s.percent?1:(s.max||Math.max(...tots,1));let g='';
 s.rows.forEach((r,i)=>{const cy=4+i*rh+rh/2;const t=tots[i];let acc=lw;
  const mc=Math.max(3,Math.floor((lw-10)/11.5));const lab0=r.label.length>mc?r.label.slice(0,mc-1)+'…':r.label;g+=`<text x="${lw-8}" y="${cy+4}" text-anchor="end" class="lb"><title>${esc(r.label)}</title>${esc(lab0)}</text><rect x="${lw}" y="${cy-bh/2}" width="${aw}" height="${bh}" fill="var(--track)" rx="3"/>`;
  const segs=r.segs.filter(z=>z.value>0);segs.forEach((z,j)=>{const w=(s.percent?(t?z.value/t:0):z.value/max)*aw;const last=j===segs.length-1;const ww=w-(last?0:2);
   const tip=tipAttr([r.label,`${z.name||s.valueName||'값'}: ${fmtN(z.value)}${s.unit||''}${s.percent&&t?` (${Math.round(z.value/t*100)}%)`:''}`]);
   if(ww>0)g+=last?`<path d="${rightRounded(acc,cy-bh/2,ww,bh,4)}" fill="${z.color}" ${tip}/>`:`<rect x="${acc}" y="${cy-bh/2}" width="${ww}" height="${bh}" fill="${z.color}" ${tip}/>`;acc+=w});
  const lab=s.percent?(r.note??''):(r.valueLabel??`${fmtN(t)}${s.unit||''}`);g+=`<text x="${lw+aw+8}" y="${cy+4}" class="vl">${esc(lab)}</text>`});
 return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`}
(function(){const tip=document.createElement('div');tip.className='ctip';tip.hidden=true;document.body.appendChild(tip);let xh=null;
 const show=(e,t)=>{tip.textContent=t;tip.hidden=false;const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=Math.max(8,x)+'px';tip.style.top=Math.max(8,y)+'px'};
 const hideTip=()=>{tip.hidden=true;if(xh){xh.setAttribute('visibility','hidden');xh=null}};document.addEventListener('click',()=>setTimeout(hideTip,0),true);document.addEventListener('scroll',hideTip,true);document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('[data-tip]'))hideTip()});
 document.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(!t){if(!tip.hidden){tip.hidden=true;if(xh){xh.setAttribute('visibility','hidden');xh=null}}return}
  show(e,t.dataset.tip);if(t.dataset.cx){const l=t.ownerSVGElement?.querySelector('.xh');if(l){if(xh&&xh!==l)xh.setAttribute('visibility','hidden');xh=l;l.setAttribute('x1',t.dataset.cx);l.setAttribute('x2',t.dataset.cx);l.setAttribute('visibility','visible')}}});
})();

/* ============ 영업 보고 ============ */
const REP_ST={draft:['임시 저장','rs-draft'],submitted:['제출','rs-submitted'],confirmed:['확인','rs-confirmed'],returned:['반려','rs-returned']};
const WEEK=['일','월','화','수','목','금','토'];
const dayLabel=ds=>fd(ds);
const won=v=>`${fmtN(v)}원`;
const hName=id=>getH(id)?.name||'';
const userColor=id=>`var(--v${((userById(id)?.slot||1)-1)%8+1})`;
function nextBiz(ds){let d=addDays(1,ds);while(!isBiz(d))d=addDays(1,d);return d}
function prevBiz(ds){let d=addDays(-1,ds);while(!isBiz(d))d=addDays(-1,d);return d}
function bizDays(from,to){const out=[];for(let d=from;d<=to;d=addDays(1,d))if(isBiz(d))out.push(d);return out}
function canRep(op,rep){const u=cur(),r=roleOf(u);if(!u||!r?.perms.report?.[op])return false;if(rep&&r.scope==='own'&&rep.authorId!==u.id)return false;return true}
const canReview=rep=>!!rep&&rep.authorId!==cur()?.id&&roleOf(cur())?.scope==='all'&&canRep('update',rep);
const reporters=()=>{const me=cur();if(roleOf(me)?.scope==='own')return [me];return S.users.filter(u=>u.status==='active'&&roleOf(u)?.perms.report?.create&&u.roleId!=='r_admin')};
const expTotal=r=>(r.exp||[]).reduce((a,x)=>a+(+x.amount||0),0);
function repStats(author,date){const acts=[];S.hospitals.forEach(h=>(h.activities||[]).forEach(a=>{if(a.authorId===author&&a.date===date)acts.push({id:a.id,hospitalId:h.id,hospitalName:h.name,type:a.type,purpose:a.purpose||'',contact:a.contact||'',reaction:a.reaction||'',note:a.note||''})}));
 const t=x=>acts.filter(a=>a.type===x).length;const au=S.audit.filter(e=>e.userId===author&&e.entity==='hospital'&&fmtTs(e.ts).slice(0,10)===date);
 const evals=new Set(au.filter(e=>e.section==='리드 평가'&&e.action!=='delete').map(e=>e.hospitalId)).size;
 let ups=0;au.forEach(e=>(e.changes||[]).forEach(c=>{if(c.field==='현재 단계'){const a=STAGES.indexOf(c.before),b=STAGES.indexOf(c.after);if(b>a&&b<MAIN_N)ups++}}));
 const react={긍정:0,보통:0,부정:0,부재:0};acts.forEach(a=>{if(a.reaction in react)react[a.reaction]++});
 return {visits:t('방문'),calls:t('전화'),msgs:t('문자/카톡')+t('이메일'),events:t('세미나/행사'),newHosp:S.hospitals.filter(h=>h.createdBy===author&&h.createdAt===date).length,evals,stageUps:ups,
  signups:S.hospitals.filter(h=>h.ownerId===author&&h.signupDate===date).length,demos:acts.filter(a=>/시연/.test(a.purpose)).length,react,acts:acts.sort((a,b)=>(a.type==='방문'?0:1)-(b.type==='방문'?0:1))}}
function newReport(author,date){const mine=liveH().filter(h=>h.ownerId===author);const nb=nextBiz(date);
 const sug=mine.filter(h=>h.next?.date&&!h.next.done&&h.next.date<=nb).map(h=>h.id).slice(0,5);
 return {id:'rp_'+uid(),authorId:author,date,status:'draft',workType:'외근',region:'',mileage:'',highlights:'',voc:[],comp:[],issues:[],plan:{hospitalIds:sug,goal:goalFor(author,nb),note:''},exp:[],memo:''}}
function snapRep(r){const o={};const put=(k,l,v)=>o[k]={l,v:v==null?'':String(v)};
 put('status','상태',REP_ST[r.status]?.[0]);put('work','근무 형태',r.workType);put('region','방문 지역',r.region);put('mile','이동 거리(km)',r.mileage);
 put('visits','방문 수(자동 집계)',r.stats?.visits);put('calls','통화 수(자동 집계)',r.stats?.calls);put('hl','오늘 요약',r.highlights);
 (r.voc||[]).forEach((x,i)=>put('voc'+i,`고객의 소리 ${i+1}`,[x.type,hName(x.hospitalId),x.text].filter(Boolean).join(' · ')));
 (r.comp||[]).forEach((x,i)=>put('comp'+i,`경쟁사 동향 ${i+1}`,[x.name,hName(x.hospitalId),x.text].filter(Boolean).join(' · ')));
 (r.issues||[]).forEach((x,i)=>put('iss'+i,`지원 요청 ${i+1}`,[x.type,x.urgency,x.text].filter(Boolean).join(' · ')));
 put('plan','내일 방문 계획',(r.plan?.hospitalIds||[]).map(hName).join(', '));put('pgoal','내일 목표 방문',r.plan?.goal);put('pnote','내일 계획 메모',r.plan?.note);
 put('exp','경비 합계',expTotal(r)?won(expTotal(r)):'');put('memo','특이사항',r.memo);put('rc','검토 의견',r.reviewComment);return o}
function repRange(){const R=ui.rep;if(!R.from){R.to=today();R.from=addDays(-13)}return [R.from,R.to]}
function setPreset(p){const R=ui.rep;const t=today();const d=new Date(t+'T00:00:00');R.preset=p;R.to=t;
 if(p==='week'){const k=(d.getDay()+6)%7;R.from=addDays(-k)}else if(p==='2w')R.from=addDays(-13);else if(p==='month')R.from=t.slice(0,8)+'01';else if(p==='30')R.from=addDays(-29)}

function repHTML(){const R=ui.rep;const tabs=[canRep('create')&&['write','보고서 작성'],['status','제출 현황'],['anal','분석']].filter(Boolean);if(!tabs.some(t=>t[0]===R.tab))R.tab=tabs[0][0];
 const pend=S.reports.filter(r=>r.status==='submitted'&&canReview(r)).length;
 return `<div class="page-head"><div><h1>영업 보고</h1><p>하루 활동은 병원별 활동 기록에서 자동으로 모이고, 영업사원은 고객 반응·경쟁사·지원 요청·내일 계획을 더해 제출합니다.${pend?` 검토 대기 <b>${pend}건</b>.`:''}</p></div></div>
 <div class="sub-tabs">${tabs.map(([k,l])=>`<button class="tab ${R.tab===k?'on':''}" data-act="repTab" data-v="${k}">${l}${k==='status'&&pend?`<span class="n">${pend}</span>`:''}</button>`).join('')}</div>
 ${R.tab==='write'?repWriteHTML():R.tab==='status'?repStatusHTML():repAnalHTML()}`}

/* 작성 */
// 그날 영업 활동에 적은 고객의 소리·경쟁사 언급·지원 요청을 보고서에 자동으로 넣는다 (제출·확인된 보고서는 고정)
function syncAutoRows(d){const st=S.reports.find(r=>r.id===d.id)?.status;if(st==='submitted'||st==='confirmed')return;
 const add={voc:[],comp:[],issues:[]};S.hospitals.forEach(h=>{if(h.deletedAt)return;(h.activities||[]).forEach(a=>{if(a.authorId!==d.authorId||a.date!==d.date)return;
  if(a.voc)add.voc.push({src:a.id,type:a.voc.type,hospitalId:h.id,text:a.voc.text});
  if(a.comp)add.comp.push({src:a.id,competitorId:a.comp.competitorId||'',name:compById(a.comp.competitorId)?.name||'경쟁사 미지정',hospitalId:h.id,text:a.comp.text});
  if(a.issue)add.issues.push({src:a.id,type:a.issue.type,urgency:'보통',text:a.issue.text});})});
 ['voc','comp','issues'].forEach(k=>{const old=(d[k]||[]);const keep=old.filter(x=>!x.src);const prev=Object.fromEntries(old.filter(x=>x.src).map(x=>[x.src,x]));
  d[k]=[...add[k].map(x=>k==='issues'&&prev[x.src]?{...x,urgency:prev[x.src].urgency||'보통'}:x),...keep]})}
function loadDraft(){const R=ui.rep,me=cur();const ex=S.reports.find(r=>r.authorId===me.id&&r.date===R.date);R.draft=ex?clone(ex):newReport(me.id,R.date);R.err=''}
function hospOpts(sel,dayIds){const me=cur();const pool=roleOf(me).scope==='own'?liveH().filter(h=>h.ownerId===me.id):liveH();const first=dayIds.map(getH).filter(Boolean);const rest=pool.filter(h=>!dayIds.includes(h.id)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 return `<option value="">병원 선택 안 함</option>${first.length?`<optgroup label="오늘 접촉한 병원">${first.map(h=>`<option value="${h.id}" ${sel===h.id?'selected':''}>${esc(h.name)}</option>`).join('')}</optgroup>`:''}<optgroup label="${roleOf(me).scope==='own'?'내 담당 병원':'전체 병원'}">${rest.map(h=>`<option value="${h.id}" ${sel===h.id?'selected':''}>${esc(h.name)}</option>`).join('')}</optgroup>`}
function statTiles(st,goal){const pct=goal?Math.min(100,Math.round(st.visits/goal*100)):0;
 return `<div class="rep-kpis"><div class="rk wide"><span>방문</span><b>${st.visits}<small> / 목표 ${goal}</small></b><div class="meter"><i style="width:${pct}%;background:${st.visits>=goal?'var(--ok)':'var(--accent)'}"></i></div></div>
 ${[['통화',st.calls],['문자·메일',st.msgs],['시연',st.demos],['신규 등록',st.newHosp],['리드 평가',st.evals],['단계 진전',st.stageUps],['회원가입',st.signups]].map(([l,v])=>`<div class="rk"><span>${l}</span><b>${v}</b></div>`).join('')}</div>`}
function actsTable(acts,editable){if(!acts.length)return `<div class="empty">이날 기록된 방문·접촉이 없습니다${editable?'. 아래 버튼으로 바로 기록하세요':''}</div>`;
 return `<div class="tbl-wrap"><table class="acts"><thead><tr><th>병원</th><th>유형</th><th>목적</th><th>면담</th><th>반응</th><th>내용</th></tr></thead><tbody>${acts.map(a=>`<tr><td><button class="au-target" data-act="open" data-id="${a.hospitalId}">${esc(a.hospitalName)}</button></td><td>${esc(a.type)}</td><td>${esc(a.purpose||'—')}</td><td>${esc(a.contact||'—')}</td><td>${a.reaction?`<span class="badge re-${a.reaction}">${a.reaction}</span>`:'—'}</td><td class="h-sub" style="min-width:180px">${esc(a.note||'')}</td></tr>`).join('')}</tbody></table></div>`}
function rowsEditor(key,d,ro0,dayIds){const rows=d[key]||[];
 const mk=(ro)=>{const sel=(k,i,opts,v)=>`<select data-rr="${key}" data-i="${i}" data-k="${k}" ${dis(ro)}>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  const hs=(i,v)=>ro?`<input value="${esc(hName(v)||'—')}" disabled>`:hpHTML(`${key}:${i}`,v,'병원 검색 (선택)');const tx=(i,k,v,ph)=>`<input data-rr="${key}" data-i="${i}" data-k="${k}" value="${esc(v||'')}" placeholder="${ph}" ${dis(ro)}>`;
  return (x,i)=>key==='voc'?[sel('type',i,VOC_TYPES,x.type),hs(i,x.hospitalId),tx(i,'text',x.text,'고객이 한 말, 요청 내용')]:key==='comp'?[`<select data-rr="comp" data-i="${i}" data-k="competitorId" ${dis(ro)}><option value="">경쟁사 선택</option>${(S.competitors||[]).map(c=>`<option value="${c.id}" ${x.competitorId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}${x.name&&!x.competitorId?`<option value="" selected>${esc(x.name)} (미등록)</option>`:''}</select>`,hs(i,x.hospitalId),tx(i,'text',x.text,'제안 조건, 병원 반응')]
  :key==='issues'?[sel('type',i,ISSUE_TYPES,x.type),`<select data-rr="issues" data-i="${i}" data-k="urgency" ${dis(ro0)}>${['보통','긴급'].map(o=>`<option ${x.urgency===o?'selected':''}>${o}</option>`).join('')}</select>`,tx(i,'text',x.text,'필요한 지원과 이유')]:[sel('type',i,EXP_TYPES,x.type),`<input type="number" min="0" step="1000" data-rr="exp" data-i="${i}" data-k="amount" value="${esc(x.amount||'')}" placeholder="금액(원)" ${dis(ro)}>`,tx(i,'note',x.note,'메모 (선택)')]};
 const rowE=mk(ro0),rowR=mk(true);const autoN=rows.filter(x=>x.src).length;
 return `<div class="rr-list">${rows.map((x,i)=>x.src?`<div class="rr rr-${key} auto" title="영업 활동 기록에서 자동으로 들어온 내용입니다. 수정은 병원 상세 › 영업 활동에서 하세요.">${rowR(x,i).join('')}<span class="auto-tag">영업 활동</span></div>`:`<div class="rr rr-${key}">${rowE(x,i).join('')}${ro0?'':`<button class="icon-btn" data-act="rpDel" data-v="${key}" data-i="${i}" aria-label="행 삭제">${I.x}</button>`}</div>`).join('')}
 ${ro0?'':`<button class="btn sm" data-act="rpAdd" data-v="${key}">${I.plus}추가</button>`}${autoN&&!ro0?`<p class="hint">영업 활동에서 ${autoN}건이 자동으로 들어왔습니다. 수정은 병원 상세 › 영업 활동에서 하세요.</p>`:''}${ro0&&!rows.length?'<p class="hint">없음</p>':''}</div>`}
function repWriteHTML(){const R=ui.rep,me=cur();if(!R.draft||R.draft.authorId!==me.id||R.draft.date!==R.date)loadDraft();const d=R.draft;syncAutoRows(d);const saved=S.reports.find(r=>r.id===d.id);
 const status=saved?.status;const ro=status==='confirmed'||!(saved?canRep('update',saved):canRep('create'));
 const st=status==='confirmed'?{...saved.stats,acts:saved.acts}:repStats(me.id,d.date);const goal=saved?.goal??goalFor(me.id,d.date);
 const dayIds=[...new Set(st.acts.map(a=>a.hospitalId))];ui.hpDay=dayIds;const nb=nextBiz(d.date);
 const mine=liveH().filter(h=>h.ownerId===me.id);const sug=mine.filter(h=>h.next?.date&&!h.next.done&&h.next.date<=nb&&!d.plan.hospitalIds.includes(h.id));
 const comps=[...new Set(S.reports.flatMap(r=>(r.comp||[]).map(c=>c.name)).filter(Boolean))];
 return `<div class="rep-bar"><button class="icon-btn" data-act="rpDay" data-v="-1" aria-label="이전 근무일">‹</button><input type="date" id="rp-date" value="${d.date}" max="${today()}" data-rpdate="1"><button class="icon-btn" data-act="rpDay" data-v="1" aria-label="다음 근무일" ${d.date>=today()?'disabled':''}>›</button>
  <b class="rep-day">${dayLabel(d.date)}${holName(d.date)?` · ${holName(d.date)}`:''}</b><span class="badge ${status?REP_ST[status][1]:'f-없음'}">${status?REP_ST[status][0]:'작성 전'}</span>
  ${saved?.reviewerId?`<span class="hint">${status==='returned'?'반려':'검토'} ${esc(userName(saved.reviewerId))} · ${fmtTs(saved.reviewedAt)}</span>`:''}</div>
 ${(()=>{const at=attOn(me.id,d.date,['approved','requested']);return at?`<div class="notice ${at.status==='requested'?'warn':''}" style="margin-bottom:12px"><span>${esc(at.type)} · ${ATT_ST[at.status][0]}${ATT[at.type]?.off?' · 이 날은 보고서를 쓰지 않아도 됩니다':` · 방문 목표 ${goalFor(me.id,d.date)}곳`}</span></div>`:''})()}
 ${status==='returned'&&saved.reviewComment?`<div class="warnbox" style="margin-bottom:12px"><b>반려 사유</b> · ${esc(saved.reviewComment)}</div>`:''}
 ${status==='confirmed'?`<div class="ro-note" style="margin-bottom:12px">${I.lock}확인 완료된 보고서는 수정할 수 없습니다${saved.reviewComment?` · 검토 의견: ${esc(saved.reviewComment)}`:''}</div>`:''}
 <div class="rep-grid">
 <section class="panel span2"><h2>오늘 활동 요약 <small>${status==='confirmed'?'제출 시점 값':'병원별 활동 기록·변경 이력에서 자동 집계'}</small></h2>${statTiles(st,goal)}</section>
 <section class="panel span2"><h2>방문·접촉 내역 <small>${st.acts.length}건</small></h2>${actsTable(st.acts,!ro)}
  ${ro||d.date>today()?'':`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="quickAct">${I.plus}방문·접촉 기록 추가</button><span class="hint" style="align-self:center">여기서 기록해도 병원 상세의 영업 활동과 변경 이력에 함께 남습니다</span></div>`}</section>
 <section class="panel"><h2>근무 정보</h2><div style="display:grid;gap:12px"><div class="fld"><span>근무 형태</span><div class="seg">${WORK_TYPES.map(w=>`<button type="button" class="${d.workType===w?'on':''}" data-act="rpWork" data-v="${w}" ${dis(ro)}>${w}</button>`).join('')}</div></div>
  <div class="row-2"><label class="fld"><span>방문 지역</span><input data-rp="region" value="${esc(d.region)}" placeholder="${esc([...new Set(dayIds.map(id=>getH(id)?.sigungu).filter(Boolean))].join(', ')||'예: 강남구, 서초구')}" ${dis(ro)}></label><label class="fld"><span>이동 거리 (km)</span><input type="number" min="0" data-rp="mileage" value="${esc(d.mileage)}" ${dis(ro)}></label></div></div></section>
 <section class="panel"><h2><span>오늘 요약 <em class="req" title="제출 시 필수">*</em></span><small>성과·진척, 팀장에게 알릴 핵심</small></h2><textarea data-rp="highlights" rows="5" placeholder="예: 해솔 동물병원 2차 시연 후 원장님 가입 의사 확인. 다음 주 화요일 계약 예정." ${dis(ro)}>${esc(d.highlights)}</textarea></section>
 <section class="panel span2"><h2>고객의 소리 (VOC) <small>제품·가격·교육에 대한 병원 의견. 제품팀에 전달됩니다</small></h2>${rowsEditor('voc',d,ro,dayIds)}</section>
 <section class="panel"><h2>경쟁사 동향 ${canComp('read')?'<button class="link-btn" data-act="go" data-v="comp">경쟁사 목록</button>':''}</h2>${rowsEditor('comp',d,ro,dayIds)}<datalist id="compList">${comps.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></section>
 <section class="panel"><h2>지원 요청·이슈</h2>${rowsEditor('issues',d,ro,dayIds)}</section>
 <section class="panel"><h2>다음 근무일 계획 <small>${dayLabel(nb)}</small></h2><div style="display:grid;gap:10px">
  <div class="chips">${d.plan.hospitalIds.map(id=>`<span class="cat-chip plan-chip">${esc(hName(id))}${ro?'':`<button data-act="planDel" data-v="${id}" aria-label="빼기">${I.x}</button>`}</span>`).join('')||'<span class="hint">방문할 병원을 추가하세요</span>'}</div>
  ${ro?'':`${sug.length?`<div class="hint">추천 · 다음 액션일이 다가온 병원: ${sug.map(h=>`<button class="link-btn" data-act="planAdd" data-v="${h.id}">+ ${esc(h.name)}</button>`).join(' ')}</div>`:''}
  ${hpHTML('plan','','방문할 병원 검색해서 추가 (병원명·지역·원장)')}`}
  <div class="row-2"><label class="fld"><span>목표 방문 수</span><input type="number" min="0" data-rpplan="goal" value="${esc(d.plan.goal)}" ${dis(ro)}></label><div></div></div>
  <label class="fld"><span>메모</span><input data-rpplan="note" value="${esc(d.plan.note||'')}" placeholder="예: 오전 분당 권역, 오후 사무실 교육" ${dis(ro)}></label></div></section>
 <section class="panel"><h2>경비 <small>합계 ${won(expTotal(d))}</small></h2>${rowsEditor('exp',d,ro,dayIds)}</section>
 <section class="panel span2"><h2>특이사항</h2><textarea data-rp="memo" rows="2" placeholder="건의, 개인 일정, 기타" ${dis(ro)}>${esc(d.memo)}</textarea></section>
 </div>
 ${R.err?`<p class="err" style="margin-top:10px">${esc(R.err)}</p>`:''}
 ${ro?'':`<div class="d-foot rep-foot">${saved&&status==='draft'&&canRep('delete',saved)?'<button class="btn danger" data-act="rpDelete">임시 저장 삭제</button>':'<span></span>'}<div style="display:flex;gap:8px">${status==='submitted'?'<button class="btn primary" data-act="rpSave">수정 내용 저장</button>':`<button class="btn" data-act="rpSave">임시 저장</button><button class="btn primary" data-act="rpSubmit">${status==='returned'?'다시 제출':'제출'}</button>`}</div></div>`}`}

/* 현황 */
function repStatusHTML(){const R=ui.rep;const [from,to]=repRange();const days=bizDays(from,to);const users=reporters().filter(u=>!R.user||u.id===R.user);const me=cur();
 const cell=(u,d)=>{const r=S.reports.find(x=>x.authorId===u.id&&x.date===d);let cls,txt,tip;
  const at=attOn(u.id,d);if(at&&ATT[at.type]?.off&&!r){cls='rc-leave';txt=ATT[at.type].short;tip=at.type}else if(r){cls='rc-'+r.status;txt=r.stats?.visits??repStats(u.id,d).visits;tip=`${REP_ST[r.status][0]} · 방문 ${txt}`}else if(d===today()){cls='rc-todo';txt='·';tip='오늘 작성 전'}else{cls='rc-missing';txt='!';tip='미제출'}
  return `<td><button class="rc ${cls}" data-act="${r?'repOpen':u.id===me.id&&canRep('create')?'repWriteAt':'noop'}" data-id="${r?.id||''}" data-v="${d}" ${tipAttr([`${u.name} · ${dayLabel(d)}`,tip])}>${txt}</button></td>`};
 const rate=u=>{const rs=S.reports.filter(r=>r.authorId===u.id&&r.date>=from&&r.date<=to);const due=days.filter(d=>d<today()&&!isOffDay(u.id,d)).length;const ok=rs.filter(r=>r.workType!=='휴가'&&r.date<today()&&['submitted','confirmed'].includes(r.status)).length;return due>0?Math.round(ok/due*100):null};
 const list=S.reports.filter(r=>r.date>=from&&r.date<=to&&users.some(u=>u.id===r.authorId)&&(!R.status||r.status===R.status)&&r.workType!=='휴가').sort((a,b)=>b.date.localeCompare(a.date)||userName(a.authorId).localeCompare(userName(b.authorId),'ko'));
 return `${rangeBar(true)}
 <section class="panel"><h2>영업사원 × 날짜 <small>${fd(from)} ~ ${fd(to)} · 숫자는 방문 수 · 칸을 누르면 보고서가 열립니다</small></h2>
 <div class="rc-legend">${[['rc-confirmed','확인'],['rc-submitted','제출·검토 대기'],['rc-returned','반려'],['rc-draft','임시 저장'],['rc-missing','미제출'],['rc-leave','연차·병가 등']].map(([c,l])=>`<span><i class="rc ${c}"></i>${l}</span>`).join('')}</div>
 <div class="tbl-wrap"><table class="rc-table"><thead><tr><th>영업사원</th>${days.map(d=>`<th title="${fd(d)}">${+d.slice(5,7)}/${+d.slice(8)}<small>${WEEK[new Date(d+'T00:00:00').getDay()]}</small></th>`).join('')}<th>제출률</th></tr></thead>
 <tbody>${users.map(u=>{const rt=rate(u);return `<tr><td><div class="u-cell">${av(u,'sm')}<b>${esc(u.name)}</b></div></td>${days.map(d=>cell(u,d)).join('')}<td class="num"><b>${rt==null?'—':rt+'%'}</b></td></tr>`}).join('')}</tbody></table></div>
 ${Object.entries(holMap()).filter(([d])=>d>=from&&d<=to).length?`<p class="hint" style="margin-top:8px">공휴일 제외: ${Object.entries(holMap()).filter(([d])=>d>=from&&d<=to).map(([d,n])=>`${dayLabel(d)} ${n}`).join(', ')}</p>`:''}</section>
 <section class="panel" style="margin-top:16px"><h2>보고서 목록 <small>${list.length}건</small></h2>
 ${list.length?`<div class="tbl-wrap"><table class="stack"><thead><tr><th>날짜</th><th>작성자</th><th>근무</th><th>방문/목표</th><th>통화</th><th>신규</th><th>단계 진전</th><th>가입</th><th>VOC</th><th>경비</th><th>상태</th></tr></thead><tbody>
 ${list.map(r=>{const st=r.stats||repStats(r.authorId,r.date);const g=r.goal??S.settings.visitGoal;return `<tr class="row" data-act="repOpen" data-id="${r.id}"><td class="mono" style="white-space:nowrap">${dayLabel(r.date)}</td><td class="full"><div class="u-cell">${av(userById(r.authorId)||{name:'?'},'sm')}${esc(userName(r.authorId))}</div></td><td data-label="근무">${esc(r.workType)}</td>
 <td class="num" data-label="방문/목표" style="white-space:nowrap"><b class="${st.visits>=g?'ok-t':''}">${st.visits}</b> / ${g}</td><td class="num" data-label="통화">${st.calls}</td><td class="num" data-label="신규">${st.newHosp}</td><td class="num" data-label="단계 진전">${st.stageUps}</td><td class="num" data-label="가입">${st.signups}</td><td class="num" data-label="VOC">${(r.voc||[]).length}</td><td class="num" data-label="경비" style="white-space:nowrap">${expTotal(r)?won(expTotal(r)):'—'}</td><td class="right"><span class="badge ${REP_ST[r.status][1]}">${REP_ST[r.status][0]}</span></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">이 기간에 보고서가 없습니다</div>'}</section>`}
function rangeBar(withStatus){const R=ui.rep;const [from,to]=repRange();const own=roleOf(cur()).scope==='own';
 return `<div class="toolbar">${[['week','이번 주'],['2w','최근 2주'],['month','이번 달'],['30','최근 30일']].map(([k,l])=>`<button class="btn sm ${R.preset===k?'primary':''}" data-act="repPreset" data-v="${k}">${l}</button>`).join('')}
 <input type="date" data-rpr="from" value="${from}" max="${to}" aria-label="시작일"><span class="muted">~</span><input type="date" data-rpr="to" value="${to}" min="${from}" max="${today()}" aria-label="종료일">
 ${own?'':`<select data-rpr="user" aria-label="영업사원"><option value="">영업사원 전체</option>${reporters().map(u=>`<option value="${u.id}" ${R.user===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>`}
 ${withStatus?`<select data-rpr="status" aria-label="상태"><option value="">상태 전체</option>${Object.entries(REP_ST).map(([k,[l]])=>`<option value="${k}" ${R.status===k?'selected':''}>${l}</option>`).join('')}</select>`:''}</div>`}

/* 보기·검토 */
function repViewHTML(r){const st=r.stats||repStats(r.authorId,r.date);const acts=r.acts||st.acts;const u=userById(r.authorId);const g=r.goal??S.settings.visitGoal;
 const list=(arr,fn)=>arr?.length?`<ul class="plain">${arr.map(fn).join('')}</ul>`:'<p class="hint">없음</p>';const hist=S.audit.filter(e=>e.entity==='report'&&e.entityId===r.id).sort((a,b)=>b.ts.localeCompare(a.ts));
 return `<div class="rv-head">${av(u||{name:'?'})}<div><b>${esc(userName(r.authorId))}</b> <span class="muted">${esc(roleOf(u)?.name||'')}</span><div class="au-meta"><span class="mono">${dayLabel(r.date)}</span><span>${esc(r.workType)}</span>${r.region?`<span>${esc(r.region)}</span>`:''}${r.mileage?`<span>${r.mileage}km</span>`:''}<span class="badge ${REP_ST[r.status][1]}">${REP_ST[r.status][0]}</span>${r.submittedAt?`<span>제출 ${fmtTs(r.submittedAt)}</span>`:''}</div></div></div>
 ${r.workType==='휴가'?'<div class="empty">휴가</div>':`${statTiles(st,g)}
 <h3 class="rv-h">방문·접촉 내역</h3>${actsTable(acts,false)}
 <h3 class="rv-h">오늘 요약</h3><p class="rv-p">${esc(r.highlights||'—')}</p>
 <div class="rv-2"><div><h3 class="rv-h">고객의 소리</h3>${list(r.voc,x=>`<li><span class="badge f-없음">${esc(x.type)}</span> ${x.hospitalId?`<b>${esc(hName(x.hospitalId))}</b> · `:''}${esc(x.text)}</li>`)}</div>
 <div><h3 class="rv-h">경쟁사 동향</h3>${list(r.comp,x=>`<li><b>${esc(x.name)}</b>${x.hospitalId?` · ${esc(hName(x.hospitalId))}`:''} · ${esc(x.text)}</li>`)}</div>
 <div><h3 class="rv-h">지원 요청</h3>${list(r.issues,x=>`<li><span class="badge ${x.urgency==='긴급'?'a-delete':'f-없음'}">${esc(x.urgency)}</span> ${esc(x.type)} · ${esc(x.text)}</li>`)}</div>
 <div><h3 class="rv-h">다음 근무일 계획 · 목표 ${esc(r.plan?.goal??'')}곳</h3><div class="chips">${(r.plan?.hospitalIds||[]).map(id=>`<span class="cat-chip">${esc(hName(id))}</span>`).join('')||'<span class="hint">없음</span>'}</div>${r.plan?.note?`<p class="rv-p">${esc(r.plan.note)}</p>`:''}</div>
 <div><h3 class="rv-h">경비 · ${won(expTotal(r))}</h3>${list(r.exp,x=>`<li>${esc(x.type)} ${won(+x.amount||0)}${x.note?` · ${esc(x.note)}`:''}</li>`)}</div>
 <div><h3 class="rv-h">특이사항</h3><p class="rv-p">${esc(r.memo||'—')}</p></div></div>`}
 ${r.reviewComment?`<div class="ro-note" style="margin-top:12px"><b>${esc(userName(r.reviewerId))}</b> 검토 의견 · ${esc(r.reviewComment)}</div>`:''}
 ${canReview(r)&&r.status==='submitted'?`<div class="review-box"><label class="fld"><span>검토 의견</span><textarea id="rv-comment" data-rv="1" rows="2" placeholder="확인 시 선택, 반려 시 필수">${esc(ui.rep.review||'')}</textarea></label><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn danger" data-act="repReturn" data-id="${r.id}">반려</button><button class="btn primary" data-act="repConfirm" data-id="${r.id}">확인</button></div></div>`:''}
 ${hist.length&&canRead('history')?`<details style="margin-top:12px"><summary class="hint" style="cursor:pointer">이 보고서의 변경 이력 ${hist.length}건</summary>${auditList(hist,false)}</details>`:''}`}

/* 분석 */
function repAnalHTML(){const R=ui.rep;const [from,to]=repRange();const days=bizDays(from,to);const users=reporters().filter(u=>!R.user||u.id===R.user);const goal=S.settings.visitGoal||4;
 const reps=S.reports.filter(r=>r.date>=from&&r.date<=to&&users.some(u=>u.id===r.authorId)&&['submitted','confirmed'].includes(r.status)&&r.workType!=='휴가');
 const st=r=>r.stats||repStats(r.authorId,r.date);const sum=(arr,f)=>arr.reduce((a,r)=>a+f(st(r),r),0);
 const leave=users.reduce((a,u)=>a+days.filter(d=>d<today()&&isOffDay(u.id,d)).length,0);
 const due=users.length*days.filter(d=>d<today()).length-leave;const worked=reps.filter(r=>r.date<today()||true);
 const visits=sum(reps,s=>s.visits);const react=['긍정','보통','부정','부재'].map(k=>sum(reps,s=>s.react?.[k]||0));const answered=react[0]+react[1]+react[2];
 const k=[['보고서 제출률',due>0?Math.round(reps.filter(r=>r.date<today()).length/due*100)+'%':'—',`${reps.length}건 제출 · 휴가 ${leave}일 제외`],['총 방문',fmtN(visits),`통화 ${fmtN(sum(reps,s=>s.calls))} · 문자·메일 ${fmtN(sum(reps,s=>s.msgs))}`],
  ['1인 일평균 방문',reps.length?(visits/reps.length).toFixed(1):'—',`목표 ${goal}곳`],['목표 달성일',reps.length?Math.round(reps.filter(r=>st(r).visits>=(r.goal??goal)).length/reps.length*100)+'%':'—','방문 목표를 채운 날의 비율'],
  ['신규 등록',sum(reps,s=>s.newHosp),'새로 등록한 병원'],['단계 진전',sum(reps,s=>s.stageUps),`회원가입 전환 ${sum(reps,s=>s.signups)}건`],['긍정 반응률',answered?Math.round(react[0]/answered*100)+'%':'—','부재 제외 방문·통화 기준'],['경비 합계',won(reps.reduce((a,r)=>a+expTotal(r),0)),`VOC ${reps.reduce((a,r)=>a+(r.voc||[]).length,0)}건`]];
 const line={type:'line',h:240,title:'일별 방문 수',labels:days.map(d=>d.slice(5).replace('-','/')),full:days.map(dayLabel),goal,unit:'곳',series:users.map(u=>({name:u.name,color:userColor(u.id),values:days.map(d=>{const r=reps.find(x=>x.authorId===u.id&&x.date===d);return r?st(r).visits:null})}))};
 const AC=[['방문','visits','var(--v1)'],['통화','calls','var(--v2)'],['문자·메일','msgs','var(--v3)']];
 const act={type:'hbar',title:'영업사원별 활동량',rows:users.map(u=>{const rs=reps.filter(r=>r.authorId===u.id);return {label:u.name,segs:AC.map(([n,key,c])=>({name:n,color:c,value:sum(rs,s=>s[key])}))}}),unit:'건'};
 const RC=[['긍정','var(--ok)'],['보통','var(--s1)'],['부정','var(--danger)'],['부재','var(--none)']];
 const rea={type:'hbar',percent:true,title:'방문·통화 반응',rows:users.map(u=>{const rs=reps.filter(r=>r.authorId===u.id);const v=RC.map(([n])=>sum(rs,s=>s.react?.[n]||0));const a=v[0]+v[1]+v[2];return {label:u.name,note:a?`긍정 ${Math.round(v[0]/a*100)}%`:'',segs:RC.map(([n,c],i)=>({name:n,color:c,value:v[i]}))}}),unit:'건'};
 const vocAll=reps.flatMap(r=>(r.voc||[]).map(v=>({...v,date:r.date,author:r.authorId})));const vocT=VOC_TYPES.map(t=>({label:t,segs:[{name:'건수',color:'var(--v1)',value:vocAll.filter(v=>v.type===t).length}]}));
 const compAll=reps.flatMap(r=>(r.comp||[]).map(v=>({...v,name:compById(v.competitorId)?.name||v.name,date:r.date,author:r.authorId})));const cn=[...new Set(compAll.map(c=>c.name))].map(n=>({label:n,segs:[{name:'언급',color:'var(--v1)',value:compAll.filter(c=>c.name===n).length}]})).sort((a,b)=>b.segs[0].value-a.segs[0].value).slice(0,6);
 const issAll=reps.flatMap(r=>(r.issues||[]).map(v=>({...v,date:r.date,author:r.authorId}))).sort((a,b)=>(b.urgency==='긴급')-(a.urgency==='긴급')||b.date.localeCompare(a.date));
 const perf=users.map(u=>{const rs=reps.filter(r=>r.authorId===u.id);const v=sum(rs,s=>s.visits);const avg=rs.length?v/rs.length:0;return {u,rs,avg,hit:rs.length?Math.round(rs.filter(r=>st(r).visits>=(r.goal??goal)).length/rs.length*100):null,nh:sum(rs,s=>s.newHosp),up:sum(rs,s=>s.stageUps),sg:sum(rs,s=>s.signups),ev:sum(rs,s=>s.evals),exp:rs.reduce((a,r)=>a+expTotal(r),0)}});
 const vmax=Math.max(goal*1.5,...perf.map(p=>p.avg));
 return `${rangeBar(false)}
 <div class="kpis">${k.map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b>${v}</b><small>${esc(s)}</small></div>`).join('')}</div>
 <section class="panel"><h2>일별 방문 수 <small>제출·확인된 보고서 기준 · 점선은 목표</small></h2>${legendHTML(line.series)}${chartBox(line)}${tableHTML(['날짜',...users.map(u=>u.name)],days.map((d,i)=>[dayLabel(d),...line.series.map(s=>s.values[i]==null?'—':s.values[i])]))}</section>
 <div class="dash-grid" style="margin-top:16px">
 <section class="panel"><h2>영업사원별 활동량 <small>기간 합계</small></h2>${legendHTML(AC.map(([n,,c])=>({name:n,color:c})))}${chartBox(act)}${tableHTML(['영업사원',...AC.map(a=>a[0])],act.rows.map(r=>[r.label,...r.segs.map(s=>s.value)]))}</section>
 <section class="panel"><h2>방문·통화 반응 <small>비율</small></h2>${legendHTML(RC.map(([n,c])=>({name:n,color:c})))}${chartBox(rea)}${tableHTML(['영업사원',...RC.map(r=>r[0])],rea.rows.map(r=>[r.label,...r.segs.map(s=>s.value)]))}</section></div>
 <section class="panel" style="margin-top:16px"><h2>영업사원별 성과 <small>막대는 일평균 방문, 세로선은 목표 ${goal}곳</small></h2><div class="tbl-wrap"><table class="perf"><thead><tr><th>영업사원</th><th>보고</th><th style="min-width:180px">일평균 방문</th><th>목표 달성일</th><th>신규 등록</th><th>리드 평가</th><th>단계 진전</th><th>회원가입</th><th>경비</th></tr></thead><tbody>
 ${perf.map(p=>`<tr><td><div class="u-cell"><span class="sw-dot" style="background:${userColor(p.u.id)}"></span><b>${esc(p.u.name)}</b></div></td><td class="num">${p.rs.length}</td><td><div class="ibar"><div class="ibar-track"><i style="width:${p.avg/vmax*100}%;background:${userColor(p.u.id)}"></i><em style="left:${goal/vmax*100}%"></em></div><b class="num">${p.avg.toFixed(1)}</b></div></td>
 <td class="num">${p.hit==null?'—':p.hit+'%'}</td><td class="num">${p.nh}</td><td class="num">${p.ev}</td><td class="num">${p.up}</td><td class="num">${p.sg}</td><td class="num" style="white-space:nowrap">${won(p.exp)}</td></tr>`).join('')}</tbody></table></div></section>
 <div class="dash-grid" style="margin-top:16px">
 <section class="panel"><h2>고객의 소리 유형 <small>${vocAll.length}건</small></h2>${chartBox({type:'hbar',title:'VOC 유형',rows:vocT,unit:'건',labelW:80})}
  <ul class="feed">${vocAll.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(v=>`<li><span class="badge f-없음">${esc(v.type)}</span><div><div>${esc(v.text)}</div><div class="h-sub">${esc(hName(v.hospitalId)||'병원 미지정')} · ${esc(userName(v.author))} · ${dayLabel(v.date)}</div></div></li>`).join('')||'<li class="hint">없음</li>'}</ul></section>
 <section class="panel"><h2>경쟁사 언급 <small>${compAll.length}건</small></h2>${cn.length?chartBox({type:'hbar',title:'경쟁사 언급',rows:cn,unit:'회',labelW:150}):'<div class="empty">언급 없음</div>'}
  <ul class="feed">${compAll.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(v=>`<li><span class="badge f-없음">${esc(v.name.split(' ')[0]+' '+(v.name.split(' ')[1]||''))}</span><div><div>${esc(v.text)}</div><div class="h-sub">${esc(hName(v.hospitalId)||'병원 미지정')} · ${esc(userName(v.author))} · ${dayLabel(v.date)}</div></div></li>`).join('')}</ul></section></div>
 <section class="panel" style="margin-top:16px"><h2>지원 요청 <small>${issAll.length}건 · 긴급 먼저</small></h2>${issAll.length?`<ul class="feed">${issAll.slice(0,10).map(v=>`<li><span class="badge ${v.urgency==='긴급'?'a-delete':'f-없음'}">${esc(v.urgency)}</span><div><div><b>${esc(v.type)}</b> · ${esc(v.text)}</div><div class="h-sub">${esc(userName(v.author))} · ${dayLabel(v.date)}</div></div></li>`).join('')}</ul>`:'<div class="empty">요청 없음</div>'}</section>`}

/* 대시보드 차트 */
function dashChartsHTML(){const H=liveH();const out=[];
 if(canRead('activity')){const mon=d=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return fmtD(x)};const w0=mon(today());const weeks=[...Array(8)].map((_,i)=>addDays(-7*(7-i),w0));
  const AT=[['방문',a=>a.type==='방문','var(--v1)'],['통화',a=>a.type==='전화','var(--v2)'],['문자·메일·기타',a=>a.type!=='방문'&&a.type!=='전화','var(--v3)']];
  const acts=H.flatMap(h=>h.activities||[]);const sp={type:'col',stacked:true,h:220,title:'주간 영업 활동',labels:weeks.map(w=>w.slice(5).replace('-','/')),full:weeks.map((w,i)=>`${fd(w)} 시작 주${i===7?' (이번 주)':''}`),unit:'건',
   series:AT.map(([n,f,c])=>({name:n,color:c,values:weeks.map(w=>acts.filter(a=>mon(a.date)===w&&f(a)).length)}))};
  out.push(`<section class="panel"><h2>주간 영업 활동 <small>최근 8주 · 활동 기록 기준</small></h2>${legendHTML(sp.series)}${chartBox(sp)}${tableHTML(['주 시작',...sp.series.map(s=>s.name)],sp.labels.map((l,i)=>[l,...sp.series.map(s=>s.values[i])]))}</section>`)}
 if(canRead('eval')){const G=[['상','var(--hot)'],['중','var(--warm)'],['하','var(--cold)'],['미평가','var(--none)']];const rows=G.map(([g,c])=>({label:g,segs:[{name:'병원',color:c,value:H.filter(h=>gradeOf(h)===g).length}]}));
  out.push(`<section class="panel"><h2>리드 등급 분포 <small>상 11~15점 · 중 6~10점 · 하 0~5점</small></h2>${chartBox({type:'hbar',title:'리드 등급',rows,unit:'곳',labelW:64})}
   <p class="hint" style="margin-top:6px">평가를 마친 병원 ${H.filter(h=>gradeOf(h)!=='미평가').length}곳 · 평가 대상(1차 방문 이후) ${H.filter(canEvalStage).length}곳 · 평균 ${(()=>{const s=H.map(scoreOf).filter(v=>v!=null);return s.length?(s.reduce((a,b)=>a+b,0)/s.length).toFixed(1):'—'})()}/9점</p></section>`)}
 {const pre=Object.entries(PRE_TYPES).map(([k,[l,c]])=>({label:l,segs:[{name:'병원',color:c,value:H.filter(h=>h.stage===initialStage()&&h.pre===k).length}]}));
  const src=LEAD_SOURCES.map(x=>({label:x,segs:[{name:'병원',color:'var(--v1)',value:H.filter(h=>(h.sources||[]).includes(x)).length}]}));
  out.push(`<section class="panel"><h2>${esc(initialStage())} 구분 <small>접촉 전 병원의 다음 할 일</small></h2>${chartBox({type:'hbar',title:'예정 구분',rows:pre,unit:'곳',labelW:96})}
   <h2 style="margin-top:14px">접촉 경로 <small>복수 선택 · 병원 수</small></h2>${chartBox({type:'hbar',title:'접촉 경로',rows:src,unit:'곳',labelW:72})}</section>`)}
 const owners=S.users.filter(u=>H.some(h=>h.ownerId===u.id));const pipe={type:'hbar',title:'담당자별 파이프라인',rows:[...owners.map(u=>({label:u.name,segs:STAGES.map(s=>({name:s,color:sc(s),value:H.filter(h=>h.ownerId===u.id&&h.stage===s).length}))})),...(H.some(h=>!h.ownerId)?[{label:'담당 미지정',segs:STAGES.map(s=>({name:s,color:sc(s),value:H.filter(h=>!h.ownerId&&h.stage===s).length}))}]:[])],unit:'곳',labelW:80};
 out.push(`<section class="panel"><h2>담당자별 파이프라인 <small>영업 단계 구성</small></h2>${legendHTML(STAGES.map(s=>({name:s,color:sc(s)})))}${chartBox(pipe)}${tableHTML(['담당자',...STAGES],pipe.rows.map(r=>[r.label,...r.segs.map(s=>s.value)]))}</section>`);
 const months=[...Array(6)].map((_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+i);return fmtD(d).slice(0,7)});
 const ser=[{name:'신규 등록',color:'var(--v1)',values:months.map(m=>S.hospitals.filter(h=>h.createdAt?.startsWith(m)).length)}];if(canRead('conv'))ser.push({name:'회원가입',color:'var(--v2)',values:months.map(m=>H.filter(h=>h.signupDate?.startsWith(m)).length)});
 const mc={type:'col',stacked:false,h:220,title:'월별 신규 등록·회원가입',labels:months.map(m=>`${+m.slice(5)}월`),full:months.map(m=>`${m.slice(0,4)}년 ${+m.slice(5)}월`),unit:'곳',series:ser};
 out.push(`<section class="panel"><h2>월별 신규 등록${canRead('conv')?'·회원가입':''} <small>최근 6개월</small></h2>${legendHTML(ser)}${chartBox(mc)}${tableHTML(['월',...ser.map(s=>s.name)],mc.labels.map((l,i)=>[l,...ser.map(s=>s.values[i])]))}</section>`);
 return `<div class="dash-grid">${out.join('')}</div>`}

/* 빠른 활동 기록 모달 */
function quickActHTML(m){const me=cur();const pool=(roleOf(me).scope==='own'?liveH().filter(h=>h.ownerId===me.id):liveH()).sort((a,b)=>a.name.localeCompare(b.name,'ko'));const f=m.f;
 return `<div class="form-grid"><div class="fld span2"><span>병원 <em>*</em></span>${hpHTML('qa',f.hospitalId)}</div>
 <label class="fld"><span>유형</span><select data-qa="type">${ACT_TYPES.map(t=>`<option ${f.type===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="fld"><span>날짜</span><input type="date" value="${f.date}" disabled></label>
 <label class="fld"><span>목적</span><select data-qa="purpose"><option value="">선택</option>${ACT_PURPOSES.map(t=>`<option ${f.purpose===t?'selected':''}>${t}</option>`).join('')}</select></label>
 <label class="fld"><span>면담자</span><select data-qa="contact"><option value="">선택</option>${ACT_CONTACTS.map(t=>`<option ${f.contact===t?'selected':''}>${t}</option>`).join('')}</select></label>
 <div class="fld span2"><span>반응</span><div class="seg">${ACT_REACTIONS.map(t=>`<button type="button" class="${f.reaction===t?'on':''}" data-act="qaReact" data-v="${t}">${t}</button>`).join('')}</div></div>
 <label class="fld span2"><span>내용</span><textarea data-qa="note" rows="3" placeholder="주요 코멘트/피드백">${esc(f.note)}</textarea></label><div class="span2">${extrasHTML(f,'data-qa')}</div>${m.err?`<p class="err span2">${esc(m.err)}</p>`:''}</div>`}

/* 예시 보고서 */
function repSave(submit){const R=ui.rep,me=cur(),d=R.draft;const saved=S.reports.find(r=>r.id===d.id);
 if(saved?.status==='confirmed')return;if(!(saved?canRep('update',saved):canRep('create'))){toast('보고서 작성 권한이 없습니다');return}
 if(submit){if(d.workType!=='휴가'&&!String(d.highlights||'').trim()){R.err='오늘 요약을 입력해야 제출할 수 있습니다.';render();return}
  const bad=(d.voc||[]).some(x=>!String(x.text||'').trim())||(d.comp||[]).some(x=>!String(x.name||'').trim())||(d.issues||[]).some(x=>!String(x.text||'').trim());if(bad){R.err='내용이 빈 VOC·경쟁사·지원 요청 행이 있습니다. 채우거나 삭제하세요.';render();return}}
 R.err='';const st=repStats(me.id,d.date);d.stats=(({acts,...x})=>x)(st);d.acts=st.acts;d.goal=goalFor(me.id,d.date);
 d.exp=(d.exp||[]).map(x=>({...x,amount:+x.amount||0}));d.mileage=d.mileage===''?'':+d.mileage;d.plan.goal=d.plan.goal===''?'':+d.plan.goal;
 const prev=saved?snapRep(saved):{};const wasSt=saved?.status;
 if(submit){d.status='submitted';d.submittedAt=new Date().toISOString();d.reviewerId=saved?.reviewerId&&wasSt==='returned'?saved.reviewerId:'';}else if(!saved)d.status='draft';
 const ch=diffSnap(prev,snapRep(d));
 if(ch.length||!saved)logEntry({entity:'report',entityId:d.id,targetName:`${me.name} ${d.date} 일일 보고`,action:saved?'update':'create',section:submit?'보고서 제출':'영업 보고',changes:ch});
 if(saved)Object.assign(saved,clone(d));else S.reports.push(clone(d));save();toast(submit?(wasSt==='returned'?'다시 제출했습니다':'보고서를 제출했습니다'):'저장했습니다');R.draft=null;render()}
function repReview(id,ok){const r=S.reports.find(x=>x.id===id);if(!canReview(r)){toast('검토 권한이 없습니다');return}const c=(ui.rep.review||'').trim();if(!ok&&!c){toast('반려 사유를 입력하세요');$('#rv-comment')?.focus();return}
 const before=snapRep(r);r.status=ok?'confirmed':'returned';r.reviewerId=cur().id;r.reviewedAt=new Date().toISOString();r.reviewComment=c;
 logEntry({entity:'report',entityId:r.id,targetName:`${userName(r.authorId)} ${r.date} 일일 보고`,action:'update',section:'보고서 검토',changes:diffSnap(before,snapRep(r))});
 save();ui.rep.review='';ui.modal=null;toast(ok?'확인했습니다':'반려했습니다 · 작성자에게 사유가 표시됩니다');render()}
function dashNotice(){const out=[];const me=cur();
 if(attManager()){const ab=S.users.filter(u=>u.status==='active'&&attOn(u.id,today()));if(ab.length)out.push(`<div class="notice"><span>오늘 근태 · ${ab.map(u=>`${esc(u.name)} ${attOn(u.id,today()).type}`).join(', ')}</span><button class="btn sm" data-act="go" data-v="attend">근태 일정</button></div>`);
  const pa=(S.attendance||[]).filter(a=>a.status==='requested'&&(a.userId!==me.id||roleOf(me).id==='r_admin')).length;if(pa)out.push(`<div class="notice warn"><span>근태 승인 대기 ${pa}건</span><button class="btn sm primary" data-act="go" data-v="attend">승인하기</button></div>`)}
 if(canRep('create')){const r=S.reports.find(x=>x.authorId===me.id&&x.date===today());const pd=prevBiz(today());const prv=S.reports.find(x=>x.authorId===me.id&&x.date===pd);const ret=S.reports.filter(x=>x.authorId===me.id&&x.status==='returned');
  if(ret.length)out.push(`<div class="notice warn"><span>반려된 보고서 ${ret.length}건 · ${ret.map(x=>dayLabel(x.date)).join(', ')}</span><button class="btn sm" data-act="repEdit" data-v="${ret[0].date}">보완하기</button></div>`);
  if((!prv||prv.status==='draft')&&!isOffDay(me.id,pd))out.push(`<div class="notice"><span>${dayLabel(pd)} 보고서를 ${prv?'임시 저장만 하고 제출하지 않았습니다':'아직 작성하지 않았습니다'}</span><button class="btn sm" data-act="repEdit" data-v="${pd}">작성하기</button></div>`);
  if(isBiz(today())&&!isOffDay(me.id,today())&&(!r||r.status==='draft'))out.push(`<div class="notice"><span>오늘(${dayLabel(today())}) 일일 보고서 ${r?'임시 저장됨':'작성 전'} · 활동을 기록하면 자동으로 집계됩니다</span><button class="btn sm primary" data-act="goReport" data-v="write">보고서 작성</button></div>`)}
 const pend=S.reports.filter(r=>r.status==='submitted'&&canReview(r)).length;if(pend)out.push(`<div class="notice"><span>검토를 기다리는 보고서 ${pend}건</span><button class="btn sm primary" data-act="goReport" data-v="status">검토하기</button></div>`);
 return out.length?`<div class="notices">${out.join('')}</div>`:''}


/* ============ 근태 일정 ============ */
const ATT={'연차':{off:true,short:'연',color:'var(--v1)'},'오전 반차':{half:true,short:'오전',color:'var(--v3)'},'오후 반차':{half:true,short:'오후',color:'var(--v3)'},
 '병가':{off:true,short:'병',color:'var(--v8)'},'경조사':{off:true,short:'경',color:'var(--v5)'},'교육':{goal0:true,short:'교',color:'var(--v7)'},'출장':{short:'출',color:'var(--v2)'}};
const ATT_ST={requested:['승인 대기','st-pending'],approved:['승인','st-active'],rejected:['반려','a-delete'],canceled:['취소','st-inactive']};
function attOn(uidv,ds,sts=['approved']){return (S.attendance||[]).find(a=>a.userId===uidv&&sts.includes(a.status)&&a.from<=ds&&a.to>=ds)}
const isOffDay=(uidv,ds)=>{const a=attOn(uidv,ds);return !!(a&&ATT[a.type]?.off)};
function goalFor(uidv,ds){const g=S.settings.visitGoal||4;const a=attOn(uidv,ds);if(!a)return g;const t=ATT[a.type]||{};return t.off||t.goal0?0:t.half?Math.ceil(g/2):g}
function attDays(a){if(ATT[a.type]?.half)return .5;return bizDays(a.from,a.to).length}
const leaveTotal=u=>u?.annualLeave??15;
function leaveUsed(uidv,year){return (S.attendance||[]).filter(a=>a.userId===uidv&&a.status==='approved'&&(a.type==='연차'||ATT[a.type]?.half)&&a.from.startsWith(year)).reduce((s,a)=>s+attDays(a),0)}
function canAtt(op,a){const u=cur(),r=roleOf(u);if(!u||!r?.perms.attendance?.[op])return false;if(a&&r.scope==='own'&&a.userId!==u.id)return false;return true}
const attManager=()=>canAtt('update')&&roleOf(cur())?.scope==='all';
const attPeriod=a=>a.from===a.to?fd(a.from):`${fd(a.from)} ~ ${fd(a.to)}`;
function snapAtt(a){const o={};const p=(k,l,v)=>o[k]={l,v:v==null?'':String(v)};p('u','대상자',userName(a.userId));p('t','유형',a.type);p('p','기간',attPeriod(a));p('d','일수',attDays(a)+'일');p('s','상태',ATT_ST[a.status]?.[0]);p('r','사유',a.reason);p('c','처리 의견',a.comment);return o}
function logAtt(a,action,section,before){logEntry({entity:'attendance',entityId:a.id,targetName:`${userName(a.userId)} ${a.type} ${attPeriod(a)}`,action,section,changes:diffSnap(before||{},snapAtt(a))})}

function attHTML(){const A=ui.att;const me=cur();const mgr=attManager();const ym=A.month;const [y,m]=ym.split('-').map(Number);
 const first=new Date(y,m-1,1);const start=new Date(first);start.setDate(1-((first.getDay()+6)%7));const cells=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(fmtD(d))}
 const weeks=cells.slice(35).every(d=>d.slice(0,7)!==ym)?cells.slice(0,35):cells;
 const visible=a=>mgr||a.userId===me.id||canAtt('read')&&roleOf(me).scope==='all';
 const list=(S.attendance||[]).filter(a=>visible(a)&&(!A.user||a.userId===A.user)&&a.status!=='canceled');
 const onDay=d=>list.filter(a=>a.from<=d&&a.to>=d&&a.status!=='rejected'&&isBiz(d));
 const users=S.users.filter(u=>u.status==='active'&&(mgr||roleOf(me).scope==='all'||u.id===me.id));
 const pend=(S.attendance||[]).filter(a=>a.status==='requested'&&(mgr?a.userId!==me.id||roleOf(me).id==='r_admin':false));
 const monthList=list.filter(a=>a.from.slice(0,7)<=ym&&a.to.slice(0,7)>=ym).sort((a,b)=>a.from.localeCompare(b.from));
 const year=String(y);
 return `<div class="page-head"><div><h1>근태 일정</h1><p>연차·반차·병가·교육·출장 일정을 등록하면 영업 보고의 제출 현황과 방문 목표에 자동으로 반영됩니다.</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">${canAtt('create')?`<button class="btn ${mgr?'':'primary'}" data-act="attNew" data-v="me">${I.plus}내 일정 ${mgr?'등록':'신청'}</button>`:''}${mgr?`<button class="btn primary" data-act="attNew" data-v="">${I.plus}직원 일정 등록</button>`:''}</div></div>
 ${pend.length?`<section class="pending-box"><b>승인 대기 ${pend.length}건</b>${pend.map(a=>`<div class="pending-row"><div class="u-cell">${av(userById(a.userId))}<div><b>${esc(userName(a.userId))} · ${esc(a.type)}</b><small>${attPeriod(a)} · ${attDays(a)}일${a.reason?' · '+esc(a.reason):''}</small></div></div>
  <button class="btn sm primary" data-act="attApprove" data-id="${a.id}">승인</button><button class="btn sm danger" data-act="attReject" data-id="${a.id}">반려</button></div>`).join('')}</section>`:''}
 <div class="att-grid">
 <section class="panel"><div class="cal-head"><button class="icon-btn" data-act="attMonth" data-v="-1" aria-label="이전 달">‹</button><h2 style="margin:0">${y}년 ${m}월</h2><button class="icon-btn" data-act="attMonth" data-v="1" aria-label="다음 달">›</button>
  <button class="btn sm" data-act="attMonth" data-v="0">이번 달</button>${users.length>1?`<select data-att="user" aria-label="직원"><option value="">전체 직원</option>${users.map(u=>`<option value="${u.id}" ${A.user===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>`:''}</div>
  <div class="cal"><div class="cal-dow">${['월','화','수','목','금','토','일'].map((w,i)=>`<span class="${i>4?'we':''}">${w}</span>`).join('')}</div>
  <div class="cal-body">${weeks.map(d=>{const dd=new Date(d+'T00:00:00');const wd=dd.getDay();const hol=holName(d);const items=onDay(d);
   return `<div class="cal-cell ${d.slice(0,7)!==ym?'out':''} ${wd===0||wd===6||hol?'we':''} ${d===today()?'today':''}" ${tipAttr([fd(d)+(hol?' · '+hol:''),...items.map(a=>`${userName(a.userId)} ${a.type}${a.status==='requested'?' (승인 대기)':''}`)])}><div class="cal-d"><b>${+d.slice(8)}</b>${hol?`<small>${esc(hol)}</small>`:''}</div>
   ${items.slice(0,3).map(a=>`<button class="att-chip ${a.status==='requested'?'pending':''}" style="--ac:${ATT[a.type]?.color||'var(--v1)'}" data-act="attOpen" data-id="${a.id}"><span class="cn-f">${esc(userName(a.userId))} ${esc(ATT[a.type]?.short||a.type)}</span><span class="cn-s">${esc(userName(a.userId).slice(0,1))}·${esc((ATT[a.type]?.short||a.type).slice(0,1))}</span></button>`).join('')}${items.length>3?`<span class="more">+${items.length-3}</span>`:''}</div>`}).join('')}</div></div>
  <div class="legend" style="margin-top:10px">${Object.entries(ATT).map(([k,v])=>`<span><i style="background:${v.color}"></i>${k}</span>`).join('')}<span><i class="dash-i"></i>승인 대기</span></div></section>
 <section class="panel"><h2>연차 현황 <small>${year}년 · 승인 기준</small></h2><ul class="leave-list">${users.map(u=>{const used=leaveUsed(u.id,year),tot=leaveTotal(u);const req=(S.attendance||[]).filter(a=>a.userId===u.id&&a.status==='requested'&&(a.type==='연차'||ATT[a.type]?.half)).reduce((s,a)=>s+attDays(a),0);
  return `<li><div class="u-cell">${av(u,'sm')}<b>${esc(u.name)}</b></div><div class="lv-bar"><i style="width:${Math.min(100,used/tot*100)}%"></i>${req?`<em style="left:${Math.min(100,used/tot*100)}%;width:${Math.min(100-used/tot*100,req/tot*100)}%"></em>`:''}</div><span class="num"><b>${tot-used}</b>일 남음<small> · 사용 ${used}${req?` · 대기 ${req}`:''}</small></span></li>`}).join('')}</ul>
  <p class="hint">연차·반차만 차감합니다. 연간 연차 일수는 사용자·권한에서 바꿀 수 있습니다.</p></section></div>
 <section class="panel" style="margin-top:16px"><h2>${y}년 ${m}월 일정 <small>${monthList.length}건</small></h2>${monthList.length?`<div class="tbl-wrap"><table class="stack"><thead><tr><th>직원</th><th>유형</th><th>기간</th><th>일수</th><th>상태</th><th>사유</th><th>처리</th><th></th></tr></thead><tbody>
 ${monthList.map(a=>`<tr><td><div class="u-cell">${av(userById(a.userId)||{name:'?'},'sm')}<b>${esc(userName(a.userId))}</b></div></td><td data-label="유형"><span class="att-dot" style="--ac:${ATT[a.type]?.color}"></span>${esc(a.type)}</td><td data-label="기간" style="white-space:nowrap">${attPeriod(a)}</td><td class="num" data-label="일수">${attDays(a)}일</td>
 <td data-label="상태"><span class="badge ${ATT_ST[a.status][1]}">${ATT_ST[a.status][0]}</span></td><td class="h-sub" data-label="사유">${esc(a.reason||'—')}</td><td class="h-sub" data-label="처리">${a.approverId?`${esc(userName(a.approverId))} · ${fd(a.approvedAt?.slice(0,10))}`:'—'}</td>
 <td class="right" style="white-space:nowrap">${attActions(a)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">이 달에 등록된 일정이 없습니다</div>'}</section>
 ${mgr?holidaysHTML():''}`}
function attActions(a){const me=cur();const out=[];
 if(a.status==='requested'&&attManager()&&(a.userId!==me.id||roleOf(me).id==='r_admin'))out.push(`<button class="btn sm primary" data-act="attApprove" data-id="${a.id}">승인</button><button class="btn sm" data-act="attReject" data-id="${a.id}">반려</button>`);
 if(a.userId===me.id&&a.status==='requested'&&canAtt('delete',a))out.push(`<button class="btn sm" data-act="attCancel" data-id="${a.id}">신청 취소</button>`);
 if(attManager()&&canAtt('delete',a)&&a.status==='approved')out.push(`<button class="icon-btn" data-act="attCancel" data-id="${a.id}" aria-label="일정 취소">${I.trash}</button>`);
 return out.join('')}
function holidaysHTML(){const y=ui.att.month.slice(0,4);const hs=Object.entries(holMap()).filter(([d])=>d.startsWith(y)).sort();
 return `<section class="panel" style="margin-top:16px"><h2>회사 휴일 <small>${y}년 · 주말과 함께 근무일에서 빠집니다</small></h2>
 <ul class="code-list">${hs.map(([d,n])=>`<li><span class="mono" style="flex:none;width:150px">${fd(d)}</span><span>${esc(n)}</span><button class="icon-btn" data-act="holDel" data-v="${d}" aria-label="삭제">${I.trash}</button></li>`).join('')||'<li class="hint">등록된 휴일이 없습니다</li>'}</ul>
 <div class="inline-add"><input type="date" id="hol-date" aria-label="날짜"><input id="hol-name" placeholder="휴일 이름 (예: 창립기념일)"><button class="btn" data-act="holAdd">추가</button></div></section>`}
function attFormHTML(m){const f=m.f;const mgr=attManager();const half=ATT[f.type]?.half;const days=f.from&&f.to&&f.to>=f.from?attDays(f):0;const u=userById(f.userId);
 return `<div class="form-grid">
 <label class="fld span2"><span>직원</span>${mgr&&!m.self?`<select data-af="userId">${S.users.filter(x=>x.status==='active').map(x=>`<option value="${x.id}" ${f.userId===x.id?'selected':''}>${esc(x.name)} (${esc(roleOf(x)?.name||'')})</option>`).join('')}</select>`:`<input value="${esc(userName(f.userId))}" disabled>`}</label>
 <div class="fld span2"><span>유형</span><div class="chips">${Object.keys(ATT).map(t=>`<button type="button" class="chip-toggle ${f.type===t?'on':''}" style="--cc:${ATT[t].color}" data-act="attType" data-v="${t}"><i></i>${t}</button>`).join('')}</div></div>
 <label class="fld"><span>${half?'날짜':'시작일'}</span><input type="date" data-af="from" value="${f.from}"></label>
 ${half?'<div></div>':`<label class="fld"><span>종료일</span><input type="date" data-af="to" value="${f.to}" min="${f.from}"></label>`}
 <p class="hint span2" id="att-days">${days?`근무일 기준 <b>${days}일</b>${f.type==='연차'||half?` · ${esc(u?.name||'')} 연차 ${leaveTotal(u)-leaveUsed(f.userId,f.from.slice(0,4))}일 남음`:''}`:'기간을 선택하세요'} · 주말과 회사 휴일은 빠집니다</p>
 <label class="fld span2"><span>사유</span><input data-af="reason" value="${esc(f.reason)}" placeholder="예: 가족 행사, 제품 교육 (본사)"></label>
 <p class="hint span2">${mgr?'관리자가 등록하면 바로 승인 상태가 됩니다.':'신청하면 팀장이 승인한 뒤 확정됩니다.'} ${ATT[f.type]?.off?'이 날은 일일 보고서를 쓰지 않아도 됩니다.':half?'이 날은 방문 목표가 절반으로 줄어듭니다.':f.type==='교육'?'이 날은 방문 목표가 0곳입니다.':''}</p>
 ${m.err?`<p class="err span2">${esc(m.err)}</p>`:''}</div>`}
function attSave(){const m=ui.modal,f=m.f;const me=cur();const mgr=attManager();if(ATT[f.type]?.half)f.to=f.from;
 if(!f.from||!f.to||f.to<f.from){m.err='기간을 올바르게 선택하세요.';renderModal();return}
 if(!attDays(f)){m.err='선택한 기간에 근무일이 없습니다.';renderModal();return}
 const clash=(S.attendance||[]).find(a=>a.userId===f.userId&&['requested','approved'].includes(a.status)&&a.from<=f.to&&a.to>=f.from);if(clash){m.err=`이미 ${attPeriod(clash)}에 ${clash.type} 일정(${ATT_ST[clash.status][0]})이 있습니다.`;renderModal();return}
 if(f.userId!==me.id&&!mgr){toast('다른 직원의 일정은 등록할 수 없습니다');return}if(!canAtt('create')){toast('근태 일정 등록 권한이 없습니다');return}
 if((f.type==='연차'||ATT[f.type]?.half)&&leaveUsed(f.userId,f.from.slice(0,4))+attDays(f)>leaveTotal(userById(f.userId))&&!m.overOk){m.err='남은 연차보다 많습니다. 그래도 진행하려면 한 번 더 누르세요.';m.overOk=true;renderModal();return}
 const auto=mgr;const a={id:'at_'+uid(),userId:f.userId,type:f.type,from:f.from,to:f.to,reason:f.reason.trim(),status:auto?'approved':'requested',requestedBy:me.id,requestedAt:new Date().toISOString(),...(auto?{approverId:me.id,approvedAt:new Date().toISOString()}:{})};
 (S.attendance||=[]).push(a);logAtt(a,'create',auto?'근태 등록':'근태 신청');save();ui.modal=null;toast(auto?`${userName(a.userId)} ${a.type} 등록`:`${a.type} 신청 완료 · 승인 대기`);render()}
function attDecide(id,ok){const a=S.attendance.find(x=>x.id===id);if(!a||!attManager()){toast('승인 권한이 없습니다');return}
 const go=c=>{const b=snapAtt(a);a.status=ok?'approved':'rejected';a.approverId=cur().id;a.approvedAt=new Date().toISOString();a.comment=c||'';logAtt(a,'update',ok?'근태 승인':'근태 반려',b);save();toast(ok?'승인했습니다':'반려했습니다');render()};
 if(ok)go('');else confirmBox({title:'일정을 반려할까요?',body:`<p>${esc(userName(a.userId))} · ${esc(a.type)} · ${attPeriod(a)}</p>`,ok:'반려',danger:true,input:'반려 사유'}).then(r=>{if(r)go(r.v)})}
function attCancel(id){const a=S.attendance.find(x=>x.id===id);if(!a)return;const own=a.userId===cur().id&&a.status==='requested';if(!(own||attManager())||!canAtt('delete',a)){toast('취소 권한이 없습니다');return}
 confirmBox({title:own?'신청을 취소할까요?':'승인된 일정을 취소할까요?',body:`<p>${esc(userName(a.userId))} · ${esc(a.type)} · ${attPeriod(a)}. 취소 내역은 변경 이력에 남습니다.</p>`,ok:'취소하기',danger:true}).then(ok=>{if(!ok)return;const b=snapAtt(a);a.status='canceled';logAtt(a,'delete','근태 취소',b);save();toast('취소했습니다');render()})}

/* ============ 지도: 지역별 개수 묶음 ============ */
const MAP_MODE_LABEL={sido:'시·도별 개수 · 원을 누르거나 확대하면 구 단위로',sgg:'시·군·구별 개수 · 원을 누르거나 확대하면 병원별로',pin:'병원별 보기 · 축소하면 지역별 개수로'};
function groupHosp(items,mode){const m=new Map();items.forEach(h=>{const k=mode==='sido'?(h.sido||'기타'):`${h.sido} ${h.sigungu}`;if(!m.has(k))m.set(k,[]);m.get(k).push(h)});
 return [...m.entries()].map(([k,list])=>({key:k,label:mode==='sido'?k:(list[0].sigungu||k),list,lat:list.reduce((a,h)=>a+h.lat,0)/list.length,lng:list.reduce((a,h)=>a+h.lng,0)/list.length}))}
function clusterEl(g,mode,onClick){const b=document.createElement('button');b.type='button';b.className='cl';const n=g.list.length;b.style.setProperty('--sz',Math.round(46+Math.min(42,Math.sqrt(n)*7))+'px');
 let acc=0;const segs=[];STAGES.forEach(s=>{const c=g.list.filter(h=>h.stage===s).length;if(!c)return;segs.push(`${sc(s)} ${acc/n*360}deg ${(acc+c)/n*360}deg`);acc+=c});b.style.background=`conic-gradient(${segs.join(',')})`;
 b.dataset.tip=[`${g.key} · ${n}곳`,...STAGES.map(s=>[s,g.list.filter(h=>h.stage===s).length]).filter(x=>x[1]).map(([s,c])=>`${s} ${c}`),mode==='sido'?'누르면 시·군·구별로 확대':'누르면 병원별로 확대'].join('\n');
 b.innerHTML=`<span class="cl-in"><b>${n}</b><small>${esc(g.label)}</small></span>`;b.onclick=onClick;return b}
function setMapView(inView,mode){const el=$('#mapView');if(el)el.innerHTML=`화면 안 <b>${inView}</b>곳 · ${MAP_MODE_LABEL[mode]}`}
class PreviewMap{
 constructor(el){this.el=el;this.c={lat:37.5,lng:127.02};this.k=3000;this.items=[];this.o={sel:null,route:[]};this.routePts=[];
  el.innerHTML=`<div class="pm-wrap"><svg class="pm-bg"></svg><svg class="pm-route"></svg><div class="pm-pins"></div></div><div class="pm-note">미리보기 지도 · 좌표 기준 배치 (카카오맵 키를 넣으면 실제 지도)</div><div style="position:absolute;right:12px;top:100px;z-index:5" class="zoom"><button data-z="1" aria-label="확대">+</button><button data-z="-1" aria-label="축소">−</button></div>`;
  this.wrap=el.querySelector('.pm-wrap');this.bg=el.querySelector('.pm-bg');this.rt=el.querySelector('.pm-route');this.pins=el.querySelector('.pm-pins');
  el.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>this.zoomAt(b.dataset.z>0?1.6:1/1.6));
  let drag=null;
  this.wrap.addEventListener('pointerdown',e=>{if(e.target.closest('.pin,.cl'))return;drag={x:e.clientX,y:e.clientY,c:{...this.c}};this.wrap.setPointerCapture(e.pointerId);this.wrap.classList.add('drag')});
  this.wrap.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;this.c={lat:drag.c.lat+dy/this.k,lng:drag.c.lng-dx/(this.k*this.cos())};this.draw()});
  const end=()=>{drag=null;this.wrap.classList.remove('drag')};this.wrap.addEventListener('pointerup',end);this.wrap.addEventListener('pointercancel',end);
  this.wrap.addEventListener('wheel',e=>{e.preventDefault();const r=this.wrap.getBoundingClientRect();this.zoomAt(e.deltaY<0?1.2:1/1.2,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  new ResizeObserver(()=>this.draw()).observe(el)}
 mode(){return this.k<2600?'sido':this.k<14000?'sgg':'pin'}
 cos(){return Math.cos(this.c.lat*Math.PI/180)}
 size(){return{w:this.el.clientWidth||600,h:this.el.clientHeight||400}}
 proj(lat,lng){const{w,h}=this.size();return{x:w/2+(lng-this.c.lng)*this.k*this.cos(),y:h/2-(lat-this.c.lat)*this.k}}
 unproj(x,y){const{w,h}=this.size();return{lat:this.c.lat-(y-h/2)/this.k,lng:this.c.lng+(x-w/2)/(this.k*this.cos())}}
 zoomAt(f,x,y){const{w,h}=this.size();x??=w/2;y??=h/2;const before=this.unproj(x,y);this.k=Math.min(400000,Math.max(600,this.k*f));const after=this.unproj(x,y);this.c.lat+=before.lat-after.lat;this.c.lng+=before.lng-after.lng;this.draw()}
 setMarkers(items,o,onClick){this.items=items;this.o=o;this.onClick=onClick;this.draw()}
 drawRoute(pts){this.routePts=pts;this.draw()}
 fit(items,noDraw){if(!items.length)return;const{w,h}=this.size();const la=items.map(i=>i.lat),ln=items.map(i=>i.lng);const minA=Math.min(...la),maxA=Math.max(...la),minN=Math.min(...ln),maxN=Math.max(...ln);
  this.c={lat:(minA+maxA)/2,lng:(minN+maxN)/2};const dA=Math.max(maxA-minA,.004),dN=Math.max(maxN-minN,.004);this.k=Math.min(60000,Math.max(600,Math.min((h-150)/dA,(w-120)/(dN*this.cos()))));if(!noDraw)this.draw()}
 zoomGroup(g,mode){const before=mode;this.fit(g.list,true);if(this.mode()===before||g.list.length===1){this.c={lat:g.lat,lng:g.lng};this.k=Math.max(this.k,before==='sido'?3200:16000)}this.draw()}
 focus(hh){this.c={lat:hh.lat,lng:hh.lng};if(this.k<25000)this.k=25000;this.draw()}
 draw(){const{w,h}=this.size();const step=this.k>40000?.005:this.k>12000?.02:this.k>4000?.05:.1;const tl=this.unproj(0,0),br=this.unproj(w,h);let g='';
  for(let x=Math.floor(tl.lng/step)*step;x<=br.lng;x+=step){const p=this.proj(0,x).x;g+=`<line x1="${p}" y1="0" x2="${p}" y2="${h}" stroke="var(--map-grid)" stroke-width="1"/>`}
  for(let y=Math.floor(br.lat/step)*step;y<=tl.lat;y+=step){const p=this.proj(y,0).y;g+=`<line x1="0" y1="${p}" x2="${w}" y2="${p}" stroke="var(--map-grid)" stroke-width="1"/>`}
  const mode=this.mode();
  if(mode==='pin'){const seen=new Set();AREAS.forEach(a=>{if(seen.has(a[1]))return;seen.add(a[1]);const p=this.proj(a[4]-.004,a[5]);if(p.x<-50||p.x>w+50||p.y<-20||p.y>h+20)return;g+=`<text x="${p.x}" y="${p.y+26}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--map-text)" font-family="IBM Plex Sans KR, sans-serif">${esc(a[1])}</text>`})}
  this.bg.innerHTML=g;const pts=this.routePts.map(p=>this.proj(p.lat,p.lng));
  this.rt.innerHTML=pts.length>1?`<polyline points="${pts.map(p=>`${p.x},${p.y-12}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" opacity=".85"/>`:'';
  this.pins.innerHTML='';const frag=document.createDocumentFragment();const inb=p=>p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h;
  setMapView(this.items.filter(it=>inb(this.proj(it.lat,it.lng))).length,mode);
  const pinIt=it=>{const p=this.proj(it.lat,it.lng);if(p.x<-100||p.x>w+100||p.y<-40||p.y>h+60)return;const wrap=document.createElement('div');wrap.className='pm-pin';wrap.style.left=p.x+'px';wrap.style.top=p.y+'px';const b=pinEl(it,this.o);b.onclick=()=>this.onClick(it.id);wrap.appendChild(b);frag.appendChild(wrap)};
  if(mode==='pin'){[...this.items].sort((a,b)=>(a.id===this.o.sel)-(b.id===this.o.sel)||b.lat-a.lat).forEach(pinIt)}
  else{groupHosp(this.items,mode).forEach(gr=>{const p=this.proj(gr.lat,gr.lng);if(p.x<-80||p.x>w+80||p.y<-80||p.y>h+80)return;const wrap=document.createElement('div');wrap.className='pm-cl';wrap.style.left=p.x+'px';wrap.style.top=p.y+'px';wrap.appendChild(clusterEl(gr,mode,()=>this.zoomGroup(gr,mode)));frag.appendChild(wrap)});
   this.items.filter(it=>it.id===this.o.sel||this.o.route.includes(it.id)).forEach(pinIt)}
  this.pins.appendChild(frag)}
}
class KakaoMap{
 constructor(el){el.innerHTML='';this.map=new kakao.maps.Map(el,{center:new kakao.maps.LatLng(37.5,127.03),level:8});this.ovs=[];this.line=null;this.items=[];this.o={sel:null,route:[]};
  this.map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);new ResizeObserver(()=>this.map.relayout()).observe(el);
  kakao.maps.event.addListener(this.map,'idle',()=>this.draw())}
 mode(){const l=this.map.getLevel();return l>=10?'sido':l>=7?'sgg':'pin'}
 setMarkers(items,o,onClick){this.items=items;this.o=o;this.onClick=onClick;this.draw()}
 draw(){this.ovs.forEach(v=>v.setMap(null));this.ovs=[];const mode=this.mode();const b=this.map.getBounds();const LL=(a,c)=>new kakao.maps.LatLng(a,c);
  setMapView(this.items.filter(h=>b.contain(LL(h.lat,h.lng))).length,mode);
  const pin=h=>{const el=pinEl(h,this.o);el.onclick=()=>this.onClick(h.id);const ov=new kakao.maps.CustomOverlay({position:LL(h.lat,h.lng),content:el,xAnchor:.5,yAnchor:1,zIndex:this.o.sel===h.id?10:3,clickable:true});ov.setMap(this.map);this.ovs.push(ov)};
  if(mode==='pin'){this.items.forEach(pin);return}
  groupHosp(this.items,mode).forEach(g=>{const el=clusterEl(g,mode,()=>this.zoomGroup(g,mode));const ov=new kakao.maps.CustomOverlay({position:LL(g.lat,g.lng),content:el,xAnchor:.5,yAnchor:.5,zIndex:1,clickable:true});ov.setMap(this.map);this.ovs.push(ov)});
  this.items.filter(h=>h.id===this.o.sel||this.o.route.includes(h.id)).forEach(pin)}
 zoomGroup(g,mode){const lv=this.map.getLevel();const bb=new kakao.maps.LatLngBounds();g.list.forEach(h=>bb.extend(new kakao.maps.LatLng(h.lat,h.lng)));
  if(g.list.length>1)this.map.setBounds(bb,80,60,60,60);if(this.mode()===mode||g.list.length===1)this.map.setLevel(Math.min(lv-1,mode==='sido'?9:6),{anchor:new kakao.maps.LatLng(g.lat,g.lng)})}
 drawRoute(pts){this.line&&this.line.setMap(null);this.line=null;if(pts.length>1){this.line=new kakao.maps.Polyline({path:pts.map(p=>new kakao.maps.LatLng(p.lat,p.lng)),strokeWeight:4,strokeColor:'#0B6E63',strokeOpacity:.85,strokeStyle:'shortdash'});this.line.setMap(this.map)}}
 fit(items){if(!items.length)return;const b=new kakao.maps.LatLngBounds();items.forEach(h=>b.extend(new kakao.maps.LatLng(h.lat,h.lng)));this.map.setBounds(b,80,60,60,60)}
 focus(h){this.map.setLevel(Math.min(this.map.getLevel(),5));this.map.panTo(new kakao.maps.LatLng(h.lat,h.lng))}
}

/* 날짜 입력칸 옆 요일 */
function decorateDates(root){(root||document).querySelectorAll('input[type=date]').forEach(i=>{let w=i.parentElement;if(!w.classList.contains('dwrap')){w=document.createElement('span');w.className='dwrap';i.replaceWith(w);w.appendChild(i)}
 w.dataset.dow=i.value?`(${WD[new Date(i.value+'T00:00:00').getDay()]})`:''})}
new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('input[type=date]')||n.querySelector?.('input[type=date]')))))decorateDates()}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target.type==='date'&&e.target.parentElement?.classList.contains('dwrap'))e.target.parentElement.dataset.dow=e.target.value?`(${WD[new Date(e.target.value+'T00:00:00').getDay()]})`:''},true);


/* ============ 영업 단계 관리 ============ */
const STAGE_COLORS=['var(--s0)','var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)','var(--v1)','var(--v2)','var(--v3)','var(--v4)','var(--v5)','var(--v7)'];
const TRIGGERS={contact:'첫 접촉 기록 시',visit1:'첫 방문 기록 시',visit2:'두 번째 방문 기록 시',signup:'회원가입일 입력 시',use:'사용 건수 입력 시'};
function stagesHTML(ro){const L=S.stages;const ed=ui.stEdit;const cnt=n=>liveH().filter(h=>h.stage===n).length;const main=L.filter(s=>s.kind==='main'),exit=L.filter(s=>s.kind==='exit');
 const form=s=>`<div class="cat-form"><div class="form-grid"><label class="fld"><span>단계 이름 <em>*</em></span><input id="se-name" data-se="name" value="${esc(s.name)}" placeholder="예: 견적 발송"></label>
  <div class="fld"><span>구분</span><div class="seg">${[['main','진행 단계'],['exit','이탈 단계']].map(([k,l])=>`<button type="button" class="${s.kind===k?'on':''}" data-act="seKind" data-v="${k}">${l}</button>`).join('')}</div></div>
  <label class="fld"><span>자동 전환 <small>이 일이 생기면 이 단계로 올림</small></span><select data-se="trigger" ${s.kind==='exit'?'disabled':''}><option value="">없음 (직접 지정)</option>${Object.entries(TRIGGERS).map(([k,l])=>{const o=L.find(x=>x.trigger===k&&x.id!==s.id);return `<option value="${k}" ${s.trigger===k?'selected':''}>${l}${o?` (지금: ${esc(o.name)})`:''}</option>`}).join('')}</select></label><div></div>
  <div class="fld span2"><span>색상</span><div class="swatches">${STAGE_COLORS.map(c=>`<button type="button" class="sw ${s.color===c?'on':''}" style="--cc:${c}" data-act="seColor" data-v="${c}" aria-label="색상"></button>`).join('')}</div></div>
  ${s.id?`<p class="hint span2">이름을 바꾸면 이 단계에 있는 병원 ${cnt(L.find(x=>x.id===s.id).name)}곳과 단계 이력에 함께 반영됩니다.</p>`:''}${s.err?`<p class="err span2">${esc(s.err)}</p>`:''}</div>
  <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-act="seCancel">취소</button><button class="btn primary" data-act="seSave">${s.id?'변경 저장':'추가'}</button></div></div>`;
 const row=(s,i,arr)=>ed&&ed.id===s.id?form(ed):`<li class="st-row"><span class="st-ord mono">${s.kind==='main'?main.indexOf(s)+1:'—'}</span><span class="badge stage" style="--c:${s.color}">${esc(s.name)}</span>
  <span class="h-sub">${s.kind==='main'&&main[0]===s?'등록 시 시작 단계':s.trigger?`자동: ${TRIGGERS[s.trigger]}`:s.kind==='exit'?'이탈 (진행 순서 밖)':'직접 지정'}</span><span class="num h-sub">${cnt(s.name)}곳</span>
  ${ro?'':`<span class="st-act"><button class="icon-btn" data-act="seMove" data-v="${s.id}" data-d="-1" ${i===0?'disabled':''} aria-label="위로">↑</button><button class="icon-btn" data-act="seMove" data-v="${s.id}" data-d="1" ${i===arr.length-1?'disabled':''} aria-label="아래로">↓</button><button class="icon-btn" data-act="seEdit" data-v="${s.id}" aria-label="수정">${I.edit}</button><button class="icon-btn" data-act="seDel" data-v="${s.id}" aria-label="삭제">${I.trash}</button></span>`}</li>`;
 return `<section class="panel span-all"><h2>영업 단계 <small>진행 단계는 위에서부터 순서대로 진행되며, 첫 단계가 병원 등록 시 시작 단계입니다</small></h2>
 <h3 class="rv-h" style="margin-top:0">진행 단계 · ${main.length}개</h3><ul class="st-list">${main.map(row).join('')}</ul>
 <h3 class="rv-h">이탈 단계 · ${exit.length}개</h3><ul class="st-list">${exit.map(row).join('')||'<li class="hint">없음</li>'}</ul>
 ${ed&&!ed.id?form(ed):ro?'':`<button class="btn" data-act="seNew" style="margin-top:12px">${I.plus}단계 추가</button>`}</section>`}
function stageSave(){const e=ui.stEdit;e.name=(e.name||'').trim();if(!need('settings','update'))return;
 if(!e.name){e.err='단계 이름을 입력하세요.';render();return}if(S.stages.some(s=>s.name===e.name&&s.id!==e.id)){e.err='같은 이름의 단계가 있습니다.';render();return}
 if(e.kind==='exit')e.trigger='';
 if(e.id){const o=S.stages.find(s=>s.id===e.id);const main=S.stages.filter(s=>s.kind==='main');if(o.kind==='main'&&e.kind==='exit'&&main.length<2){e.err='진행 단계는 최소 1개 있어야 합니다.';render();return}
  const ch=[];if(o.name!==e.name)ch.push({field:'이름',before:o.name,after:e.name});if(o.kind!==e.kind)ch.push({field:'구분',before:o.kind==='main'?'진행':'이탈',after:e.kind==='main'?'진행':'이탈'});if(o.trigger!==e.trigger)ch.push({field:'자동 전환',before:TRIGGERS[o.trigger]||'없음',after:TRIGGERS[e.trigger]||'없음'});if(o.color!==e.color)ch.push({field:'색상',before:o.color,after:e.color});
  let moved=0;if(o.name!==e.name){S.hospitals.forEach(h=>{if(h.stage===o.name){h.stage=e.name;moved++}(h.stageHistory||[]).forEach(x=>{if(x.from===o.name)x.from=e.name;if(x.to===o.name)x.to=e.name})})}
  if(e.trigger)S.stages.forEach(s=>{if(s.trigger===e.trigger&&s.id!==o.id)s.trigger=''});
  Object.assign(o,{name:e.name,kind:e.kind,trigger:e.trigger,color:e.color});if(ch.length)logEntry({entity:'settings',entityId:'stage',targetName:`영업 단계 · ${e.name}`,action:'update',section:'영업 단계',changes:ch,summary:moved?`병원 ${moved}곳의 단계 이름 함께 변경`:''});toast('단계를 저장했습니다')}
 else{if(e.trigger)S.stages.forEach(s=>{if(s.trigger===e.trigger)s.trigger=''});const s={id:'st_'+uid(),name:e.name,kind:e.kind,trigger:e.trigger,color:e.color};
  const lastMain=S.stages.map(x=>x.kind).lastIndexOf('main');if(e.kind==='main')S.stages.splice(lastMain+1,0,s);else S.stages.push(s);
  logEntry({entity:'settings',entityId:'stage',targetName:`영업 단계 · ${s.name}`,action:'create',section:'영업 단계',changes:[{field:'이름',before:'',after:s.name},{field:'구분',before:'',after:s.kind==='main'?'진행':'이탈'},...(s.trigger?[{field:'자동 전환',before:'',after:TRIGGERS[s.trigger]}]:[])]});toast(`‘${s.name}’ 단계 추가 · 순서는 화살표로 조정하세요`)}
 ui.stEdit=null;syncStages();save();render()}
function stageMove(id,d){if(!need('settings','update'))return;const L=S.stages;const s=L.find(x=>x.id===id);const grp=L.filter(x=>x.kind===s.kind);const gi=grp.indexOf(s);const t=grp[gi+d];if(!t)return;
 const before=STAGES.filter((_,i)=>i<MAIN_N).join(' → ');const a=L.indexOf(s),b=L.indexOf(t);[L[a],L[b]]=[L[b],L[a]];syncStages();
 if(s.kind==='main')logEntry({entity:'settings',entityId:'stage',targetName:'영업 단계 순서',action:'update',section:'영업 단계',changes:[{field:'진행 순서',before,after:STAGES.filter((_,i)=>i<MAIN_N).join(' → ')}]});save();render()}
function stageDelHTML(m){const s=S.stages.find(x=>x.id===m.id);const n=S.hospitals.filter(h=>h.stage===s.name).length;const others=S.stages.filter(x=>x.id!==s.id);
 return `<p><span class="badge stage" style="--c:${s.color}">${esc(s.name)}</span> 단계를 삭제합니다.${s.trigger?` 자동 전환(${TRIGGERS[s.trigger]})도 함께 해제됩니다.`:''}</p>
 ${n?`<label class="fld" style="margin-top:12px"><span>이 단계에 있는 병원 ${n}곳을 옮길 단계</span><select id="sd-target">${others.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}${x.kind==='exit'?' (이탈)':''}</option>`).join('')}</select></label><p class="hint">옮긴 내역은 각 병원 변경 이력에 남습니다. 지난 단계 이력의 이름은 그대로 둡니다.</p>`:'<p class="hint">이 단계에 있는 병원이 없습니다.</p>'}`}
function stageDelete(id){if(!need('settings','update'))return;const s=S.stages.find(x=>x.id===id);const main=S.stages.filter(x=>x.kind==='main');if(s.kind==='main'&&main.length<2){toast('진행 단계는 최소 1개 있어야 합니다');return}
 const tgt=$('#sd-target')?.value;const hs=S.hospitals.filter(h=>h.stage===s.name);S.stages=S.stages.filter(x=>x!==s);syncStages();
 hs.forEach(h=>mutateH(h,'영업 단계',x=>setStage(x,tgt),{summary:`단계 ‘${s.name}’ 삭제로 이동`}));
 logEntry({entity:'settings',entityId:'stage',targetName:`영업 단계 · ${s.name}`,action:'delete',section:'영업 단계',changes:[{field:'이름',before:s.name,after:''},...(hs.length?[{field:'병원 이동',before:`${hs.length}곳`,after:tgt}]:[])]});
 ui.modal=null;save();toast(`‘${s.name}’ 단계를 삭제했습니다`);render()}

/* ============ 내비 연동 ============ */
const NAV_APPS={kakaomap:{name:'카카오맵',max:7,note:'출발지 포함 최대 7곳(경유지 5곳)을 한 번에 넘깁니다. PC·모바일 모두 열립니다.'},
 kakaonavi:{name:'카카오내비',max:4,note:'현재 위치에서 출발해 최대 4곳(경유지 3곳)을 안내합니다. 휴대폰에 카카오내비 앱이 있어야 하며, 카카오 JavaScript 키와 콘솔의 카카오내비 사용 설정이 필요합니다.'},
 tmap:{name:'티맵',max:1,note:'티맵 앱 연결 주소는 목적지 1곳만 받습니다. 한 곳씩 차례로 안내합니다. 휴대폰에 티맵 앱이 있어야 합니다.'}};
let kakaoSdkReady=false;
function navApp(){try{return localStorage.getItem('vv-nav-app')||'kakaomap'}catch(e){return 'kakaomap'}}
function setNavApp(v){try{localStorage.setItem('vv-nav-app',v)}catch(e){}ui.navApp=v}
function chunks(R,size,overlap){const out=[];if(size<=1){R.forEach((h,i)=>out.push([h]));return out}let i=0;while(i<R.length){const c=R.slice(i,i+size);out.push(c);if(i+size>=R.length)break;i+=size-(overlap?1:0)}return out}
function kakaoMapRouteUrl(pts){const p=pts.map(h=>`${encodeURIComponent(h.name)},${h.lat},${h.lng}`).join('/');return `https://map.kakao.com/link/by/car/${p}`}
function tmapUrl(h){return `tmap://route?rGoName=${encodeURIComponent(h.name)}&rGoX=${h.lng}&rGoY=${h.lat}`}
function navHTML(R){const app=ui.navApp||navApp();const A=NAV_APPS[app];
 const groups=app==='kakaomap'||(app==='kakaonavi'&&!kakaoSdkReady)?chunks(R,7,true):app==='kakaonavi'?chunks(R,4,false):chunks(R,1,false);
 const label=g=>{const a=R.indexOf(g[0])+1,b=R.indexOf(g.at(-1))+1;return a===b?`${a}번 ${esc(g[0].name)}`:`${a}~${b}번`};
 const btn=(g,i)=>app==='kakaomap'?`<a class="btn sm ${i===0?'primary':''}" href="${kakaoMapRouteUrl(g)}" target="_blank" rel="noopener">${g.length===R.length?'전체 동선':label(g)} 카카오맵 길찾기</a>`
  :app==='kakaonavi'?(kakaoSdkReady?`<button class="btn sm ${i===0?'primary':''}" data-act="naviStart" data-i="${i}">${label(g)} 카카오내비 안내</button>`:`<a class="btn sm ${i===0?'primary':''}" href="${kakaoMapRouteUrl(g)}" target="_blank" rel="noopener">${label(g)} 카카오맵으로 열기</a>`)
  :`<a class="btn sm ${i===(ui.map.navStep||0)?'primary':''}" href="${tmapUrl(g[0])}" data-act="tmapGo" data-i="${i}">${label(g)} 티맵 안내</a>`;
 return `<div class="nav-box"><div class="seg nav-seg">${Object.entries(NAV_APPS).map(([k,v])=>`<button type="button" class="${app===k?'on':''}" data-act="navApp" data-v="${k}">${v.name}</button>`).join('')}</div>
 <div class="nav-btns">${groups.map(btn).join('')}</div>
 <p class="hint" style="margin:0">${A.note}${R.length>A.max&&app!=='tmap'?` 동선이 ${R.length}곳이라 ${groups.length}번에 나눠 안내합니다.`:''}${app==='kakaonavi'&&!kakaoSdkReady?' <b>지금은 카카오 SDK가 연결되지 않아 카카오맵 길찾기로 대신 엽니다.</b>':''}</p></div>`}
async function initKakaoSdk(){const key=CONFIG.KAKAO_JS_KEY||S.settings.kakaoKey;if(!key||!WEB_ORIGIN)return;try{if(!window.Kakao)await loadScript('https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js',6000);if(!Kakao.isInitialized())Kakao.init(key);kakaoSdkReady=!!Kakao.Navi}catch(e){kakaoSdkReady=false}}
function naviStart(i){const R=ui.map.route.map(getH).filter(h=>h&&!h.deletedAt);const g=chunks(R,4,false)[i];if(!g)return;const dest=g.at(-1);
 if(!(kakaoSdkReady&&window.Kakao?.Navi)){toast('카카오 SDK가 연결되지 않았습니다');return}
 try{Kakao.Navi.start({name:dest.name,x:dest.lng,y:dest.lat,coordType:'wgs84',viaPoints:g.slice(0,-1).map(h=>({name:h.name,x:h.lng,y:h.lat}))})}catch(e){toast('카카오내비를 열지 못했습니다. 휴대폰에서 다시 시도하세요')}}


/* 글자 폭 추정 (차트 라벨 자리 계산용) */
const textW=(t,px=12)=>[...String(t)].reduce((a,c)=>a+(/[ᄀ-ᇿ㄰-㆏가-힯]/.test(c)?px*.95:/[\s.,·:()]/.test(c)?px*.33:px*.6),0);

/* ============ 병원 검색 자동완성 ============ */
function hpHTML(key,selId,ph){const h=selId&&getH(selId);return `<div class="hp"><input class="hp-in" data-hpkey="${key}" value="${esc(h?h.name:'')}" placeholder="${esc(ph||'병원명·지역·원장 이름으로 검색')}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"><ul class="hp-list" role="listbox" hidden></ul></div>`}
function hpPool(){const me=cur();return (roleOf(me)?.scope==='own'?liveH().filter(h=>h.ownerId===me.id):liveH())}
function hpSearch(q,key){q=q.trim().toLowerCase();const pool=hpPool();const day=(ui.hpDay||[]).map(getH).filter(Boolean);
 if(key==='plan'&&ui.rep.draft)return pool.filter(h=>!ui.rep.draft.plan.hospitalIds.includes(h.id)).filter(h=>!q||hpMatch(h,q)).sort((a,b)=>hpRank(a,q)-hpRank(b,q)).slice(0,30);
 if(!q)return [...day,...pool.filter(h=>!day.includes(h)).sort((a,b)=>a.name.localeCompare(b.name,'ko'))].slice(0,30);
 return pool.filter(h=>hpMatch(h,q)).sort((a,b)=>hpRank(a,q)-hpRank(b,q)).slice(0,30)}
const hpMatch=(h,q)=>[h.name,h.sigungu,h.director,h.address,h.id].join(' ').toLowerCase().includes(q);
const hpRank=(h,q)=>!q?0:h.name.toLowerCase().startsWith(q)?0:h.name.toLowerCase().includes(q)?1:2;
function hpRender(inp){const box=inp.parentElement;const ul=box.querySelector('.hp-list');const res=hpSearch(inp.value,inp.dataset.hpkey);box._res=res;box._act=0;
 ul.innerHTML=res.length?res.map((h,i)=>{const day=(ui.hpDay||[]).includes(h.id);return `<li role="option" class="${i===0?'act':''}" data-hp-pick="${h.id}"><b>${esc(h.name)}</b><span>${esc(region(h))} · ${esc(h.stage)}${h.director?` · ${esc(h.director)} 원장`:''}${day?' · 오늘 접촉':''}</span></li>`}).join(''):'<li class="none">검색 결과가 없습니다</li>';
 ul.hidden=false;inp.setAttribute('aria-expanded','true')}
function hpClose(box){const ul=box?.querySelector('.hp-list');if(ul){ul.hidden=true;box.querySelector('.hp-in')?.setAttribute('aria-expanded','false')}}
function hpPick(inp,id){const key=inp.dataset.hpkey;const h=getH(id);hpClose(inp.parentElement);
 if(key==='plan'){if(!ui.rep.draft.plan.hospitalIds.includes(id))ui.rep.draft.plan.hospitalIds.push(id);render();setTimeout(()=>document.querySelector('.hp-in[data-hpkey="plan"]')?.focus(),20);return}
 inp.value=h?h.name:'';inp.dataset.sel=id||'';
 if(key==='qa'&&ui.modal?.f){ui.modal.f.hospitalId=id;return}
 if(key==='cmpH'&&ui.form){ui.form._hosp=id;return}
 const [kind,i]=key.split(':');if(ui.rep.draft&&ui.rep.draft[kind]?.[+i])ui.rep.draft[kind][+i].hospitalId=id}
document.addEventListener('input',e=>{const t=e.target;if(!t.classList?.contains('hp-in'))return;e.stopImmediatePropagation();
 if(!t.value.trim()&&t.dataset.hpkey!=='plan')hpPick(t,'');hpRender(t)},true);
document.addEventListener('focusin',e=>{const t=e.target;if(t.classList?.contains('hp-in'))hpRender(t)});
function hpCurrent(key){if(key==='qa')return ui.modal?.f?.hospitalId||'';if(key==='cmpH')return ui.form?._hosp||'';const [k,i]=key.split(':');return ui.rep.draft?.[k]?.[+i]?.hospitalId||''}
document.addEventListener('focusout',e=>{const t=e.target;if(!t.classList?.contains('hp-in'))return;setTimeout(()=>{if(document.activeElement===t)return;hpClose(t.parentElement);const key=t.dataset.hpkey;if(key==='plan'){t.value='';return}t.value=hName(hpCurrent(key))},160)});
document.addEventListener('keydown',e=>{const t=e.target;if(!t.classList?.contains('hp-in'))return;const box=t.parentElement;const ul=box.querySelector('.hp-list');const res=box._res||[];
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(ul.hidden)hpRender(t);box._act=Math.max(0,Math.min(res.length-1,(box._act||0)+(e.key==='ArrowDown'?1:-1)));ul.querySelectorAll('li').forEach((li,i)=>li.classList.toggle('act',i===box._act));ul.children[box._act]?.scrollIntoView({block:'nearest'})}
 else if(e.key==='Enter'){if(!ul.hidden&&res[box._act||0]){e.preventDefault();hpPick(t,res[box._act||0].id)}}
 else if(e.key==='Escape'){if(!ul.hidden){e.stopPropagation();hpClose(box)}}},true);
document.addEventListener('pointerdown',e=>{const li=e.target.closest?.('[data-hp-pick]');if(!li)return;e.preventDefault();const inp=li.closest('.hp').querySelector('.hp-in');hpPick(inp,li.dataset.hpPick)});

/* ============ 경쟁사 ============ */
const COMP_TYPES=['마취 기록 앱','전자차트(EMR) 부가 모듈','모니터 제조사 번들','수기·외주 대행','기타'];
const THREAT={높음:'a-delete',중간:'f-오늘',낮음:'f-없음'};
const compById=id=>(S.competitors||[]).find(c=>c.id===id);
const canComp=op=>can('competitor',op);
function compMentions(c){const out=[];S.reports.forEach(r=>(r.comp||[]).forEach(x=>{if(x.competitorId===c.id||(!x.competitorId&&x.name===c.name))out.push({...x,date:r.date,author:r.authorId,status:r.status})}));return out.sort((a,b)=>b.date.localeCompare(a.date))}
const compHosp=c=>liveH().filter(h=>h.compId===c.id);
function compHTML(){const L=S.competitors||[];const since=addDays(-30);const q=(ui.cq||'').trim().toLowerCase();
 const list=L.filter(c=>!q||[c.name,c.company,c.type,(c.products||[]).map(p=>p.name).join(' '),c.regions].join(' ').toLowerCase().includes(q));
 return `<div class="page-head"><div><h1>경쟁사</h1><p>경쟁 제품과 회사 정보를 모아 두면 영업 보고의 경쟁사 동향, 병원별 사용 제품과 연결되어 대응 포인트를 바로 찾을 수 있습니다.</p></div>${canComp('create')?`<button class="btn primary" data-act="compNew">${I.plus}경쟁사 등록</button>`:''}</div>
 <div class="toolbar"><label class="search">${I.search}<input type="search" data-cq="1" value="${esc(ui.cq||'')}" placeholder="회사·제품·지역 검색"></label></div>
 <div class="comp-grid">${list.map(c=>{const m=compMentions(c);const m30=m.filter(x=>x.date>=since).length;const hs=compHosp(c);
  return `<article class="comp-card" data-act="compOpen" data-id="${c.id}"><div class="cc-top"><div style="min-width:0"><h3>${esc(c.name)}</h3><p class="h-sub">${esc(c.company||'회사명 미입력')}${c.sigungu?` · ${esc(c.sido)} ${esc(c.sigungu)}`:''}</p></div><span class="badge ${THREAT[c.threat]||'f-없음'}">위협 ${esc(c.threat||'—')}</span></div>
  <div class="chips"><span class="cat-chip">${esc(c.type||'유형 미지정')}</span>${(c.products||[]).slice(0,3).map(p=>`<span class="cat-chip none">${esc(p.name)}</span>`).join('')}</div>
  <div class="cc-stats"><div><b class="num">${hs.length}</b><span>사용 병원</span></div><div><b class="num">${m30}</b><span>최근 30일 언급</span></div><div><b class="num">${m.length}</b><span>전체 언급</span></div></div>
  ${c.counter?`<p class="cc-counter"><b>대응</b> ${esc(c.counter)}</p>`:''}</article>`}).join('')||'<div class="panel empty">등록된 경쟁사가 없습니다</div>'}</div>`}
function blankComp(){return{id:'',name:'',company:'',type:COMP_TYPES[0],threat:'중간',website:'',phone:'',zip:'',address:'',jibun:'',addressDetail:'',sido:'',sigungu:'',lat:null,lng:null,regions:'',products:[{name:'',price:'',note:''}],strengths:'',weaknesses:'',counter:'',memo:''}}
function compFormHTML(f,err){return `<div class="form-grid">
 <label class="fld"><span>제품·서비스명 <em>*</em></span><input id="f-name" data-f="name" value="${esc(f.name)}" placeholder="예: 모니로그"></label>
 <label class="fld"><span>회사명</span><input data-f="company" value="${esc(f.company)}"></label>
 <label class="fld"><span>유형</span><select data-f="type">${COMP_TYPES.map(t=>`<option ${f.type===t?'selected':''}>${t}</option>`).join('')}</select></label>
 <div class="fld"><span>위협도</span><div class="seg">${['높음','중간','낮음'].map(t=>`<button type="button" class="${f.threat===t?'on':''}" data-act="setF" data-k="threat" data-v="${t}">${t}</button>`).join('')}</div></div>
 <label class="fld"><span>웹사이트</span><input data-f="website" value="${esc(f.website)}" placeholder="https://" inputmode="url"></label>
 <label class="fld"><span>대표 전화</span><input data-f="phone" value="${esc(f.phone)}" inputmode="tel"></label>
 <div class="fld span2"><span>본사 위치</span><div class="addr-row"><input id="f-zip" class="zip-in" value="${esc(f.zip)}" placeholder="우편번호" readonly data-act="openAddr"><button type="button" class="btn" data-act="openAddr">${I.search}주소 검색</button></div>
  <input id="f-addr" class="addr-in" value="${esc(f.address)}" placeholder="주소 검색을 눌러 선택" readonly data-act="openAddr"><input id="f-detail" data-f="addressDetail" value="${esc(f.addressDetail)}" placeholder="상세주소" style="margin-top:6px"></div>
 <label class="fld span2"><span>주요 영업 지역·대상</span><input data-f="regions" value="${esc(f.regions)}" placeholder="예: 수도권 1차 병원, 전자차트 기존 고객"></label>
 <div class="fld span2"><span>경쟁 품목 <small>제품, 가격 정책, 특징</small></span><div class="rr-list">${(f.products||[]).map((p,i)=>`<div class="rr rr-cp"><input data-cp="${i}" data-k="name" value="${esc(p.name)}" placeholder="제품명"><input data-cp="${i}" data-k="price" value="${esc(p.price)}" placeholder="가격·조건 (예: 월 9만원, 첫해 50%)"><input data-cp="${i}" data-k="note" value="${esc(p.note)}" placeholder="특징"><button class="icon-btn" data-act="cpDel" data-i="${i}" aria-label="삭제">${I.x}</button></div>`).join('')}<button class="btn sm" data-act="cpAdd">${I.plus}품목 추가</button></div></div>
 <label class="fld"><span>강점</span><textarea data-f="strengths" rows="3" placeholder="병원이 이 제품을 고르는 이유">${esc(f.strengths)}</textarea></label>
 <label class="fld"><span>약점</span><textarea data-f="weaknesses" rows="3" placeholder="불만, 한계">${esc(f.weaknesses)}</textarea></label>
 <label class="fld span2"><span>우리 대응 포인트</span><textarea data-f="counter" rows="3" placeholder="영업사원이 쓸 비교 포인트·세일즈 토크">${esc(f.counter)}</textarea></label>
 <label class="fld span2"><span>메모</span><textarea data-f="memo" rows="2">${esc(f.memo)}</textarea></label>${err?`<p class="err span2">${esc(err)}</p>`:''}</div>`}
function compViewHTML(c){const m=compMentions(c);const hs=compHosp(c);
 return `<div class="rv-head"><div style="min-width:0"><h3 style="margin:0;font-size:18px">${esc(c.name)}</h3><div class="au-meta"><span>${esc(c.company||'')}</span><span class="cat-chip">${esc(c.type)}</span><span class="badge ${THREAT[c.threat]||'f-없음'}">위협 ${esc(c.threat||'—')}</span></div></div></div>
 <dl class="mc-grid"><dt>웹사이트</dt><dd>${c.website?`<a href="${esc(c.website)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(c.website)}</a>`:'—'}</dd><dt>대표 전화</dt><dd class="mono">${esc(c.phone||'—')}</dd>
 <dt>본사</dt><dd>${c.address?`${c.zip?`(${esc(c.zip)}) `:''}${esc(c.address)} ${esc(c.addressDetail||'')}`:'—'}</dd><dt>영업 지역</dt><dd>${esc(c.regions||'—')}</dd><dt>등록</dt><dd>${fd(c.createdAt)} ${esc(userName(c.createdBy)||'')}</dd></dl>
 <h3 class="rv-h">경쟁 품목</h3>${(c.products||[]).filter(p=>p.name).length?`<div class="tbl-wrap"><table><thead><tr><th>제품</th><th>가격·조건</th><th>특징</th></tr></thead><tbody>${c.products.filter(p=>p.name).map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.price||'—')}</td><td class="h-sub">${esc(p.note||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">없음</p>'}
 <div class="rv-2"><div><h3 class="rv-h">강점</h3><p class="rv-p">${esc(c.strengths||'—')}</p></div><div><h3 class="rv-h">약점</h3><p class="rv-p">${esc(c.weaknesses||'—')}</p></div></div>
 <h3 class="rv-h">우리 대응 포인트</h3><p class="rv-p cc-counter">${esc(c.counter||'—')}</p>${c.memo?`<h3 class="rv-h">메모</h3><p class="rv-p">${esc(c.memo)}</p>`:''}
 <h3 class="rv-h">사용 중인 병원 · ${hs.length}곳</h3>${hs.length?`<ul class="plain">${hs.map(h=>`<li><button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button> <span class="h-sub">${esc(region(h))} · ${esc(h.stage)}${h.compUntil?` · 계약 만료 ${fd(h.compUntil)}`:''}</span></li>`).join('')}</ul>`:'<p class="hint">병원 기본 정보에서 사용 중인 경쟁 제품을 지정하면 여기에 모입니다.</p>'}
 <h3 class="rv-h">영업 보고 언급 · ${m.length}건</h3>${m.length?`<ul class="feed">${m.slice(0,8).map(v=>`<li><span class="badge f-없음">${fd(v.date).slice(5)}</span><div><div>${esc(v.text)}</div><div class="h-sub">${esc(hName(v.hospitalId)||'병원 미지정')} · ${esc(userName(v.author))}</div></div></li>`).join('')}</ul>`:'<p class="hint">없음</p>'}`}
function snapComp(c){const o={};const p=(k,l,v)=>o[k]={l,v:v==null?'':String(v)};p('n','제품·서비스명',c.name);p('co','회사명',c.company);p('t','유형',c.type);p('th','위협도',c.threat);p('w','웹사이트',c.website);p('ph','대표 전화',c.phone);
 p('a','본사 위치',c.address?`${c.address} ${c.addressDetail||''}`.trim():'');p('r','영업 지역',c.regions);(c.products||[]).filter(x=>x.name).forEach((x,i)=>p('pr'+i,`경쟁 품목 ${i+1}`,[x.name,x.price,x.note].filter(Boolean).join(' · ')));
 p('s','강점',c.strengths);p('wk','약점',c.weaknesses);p('cn','대응 포인트',c.counter);p('m','메모',c.memo);return o}
function compSave(){const f=ui.form;const isNew=!f.id;if(!canComp(isNew?'create':'update')){toast('경쟁사 등록·수정 권한이 없습니다');return}
 f.name=(f.name||'').trim();if(!f.name){ui.modal.err='제품·서비스명을 입력하세요.';renderModal();return}
 if((S.competitors||[]).some(c=>c.name===f.name&&c.id!==f.id)){ui.modal.err='같은 이름의 경쟁사가 있습니다.';renderModal();return}
 if(f.website&&!/^https?:\/\//.test(f.website))f.website='https://'+f.website.trim();f.phone=fmtPhone(f.phone);f.products=(f.products||[]).filter(p=>p.name||p.price||p.note);
 const data=clone(f);delete data._hosp;
 if(isNew){data.id='cp_'+uid();data.createdAt=today();data.createdBy=cur().id;(S.competitors||=[]).push(data);logEntry({entity:'competitor',entityId:data.id,targetName:data.name,action:'create',section:'경쟁사',changes:diffSnap({},snapComp(data))})}
 else{const o=compById(f.id);const ch=diffSnap(snapComp(o),snapComp(data));const oldName=o.name;Object.assign(o,data);if(oldName!==o.name)S.reports.forEach(r=>(r.comp||[]).forEach(x=>{if(x.competitorId===o.id)x.name=o.name}));if(ch.length)logEntry({entity:'competitor',entityId:o.id,targetName:o.name,action:'update',section:'경쟁사',changes:ch})}
 save();ui.modal=null;ui.form=null;toast(isNew?`${data.name} 등록`:'저장했습니다');render()}
async function compDelete(id){const c=compById(id);if(!canComp('delete')){toast('삭제 권한이 없습니다');return}const hs=compHosp(c);const m=compMentions(c).length;
 if(!await confirmBox({title:`‘${c.name}’을 삭제할까요?`,body:`<p>${hs.length?`사용 병원 ${hs.length}곳의 경쟁 제품 지정이 비워지고 각 병원 이력에 남습니다. `:''}${m?`영업 보고의 언급 ${m}건은 이름 그대로 남습니다.`:''}</p>`,ok:'삭제',danger:true}))return;
 hs.forEach(h=>mutateH(h,'기본 정보',x=>{x.compId='';x.compUntil=''},{summary:`경쟁사 ‘${c.name}’ 삭제`}));S.reports.forEach(r=>(r.comp||[]).forEach(x=>{if(x.competitorId===c.id)delete x.competitorId}));
 logEntry({entity:'competitor',entityId:c.id,targetName:c.name,action:'delete',section:'경쟁사',changes:diffSnap(snapComp(c),{})});S.competitors=S.competitors.filter(x=>x!==c);ui.modal=null;save();toast('삭제했습니다');render()}
/* ============ 공통 지표 ============ */
const ownedActive=uidv=>liveH().filter(h=>h.ownerId===uidv&&STAGES.indexOf(h.stage)<MAIN_N);
const lastContact=h=>sortedActs(h).at(-1)?.date||'';
const isStale=h=>{const lc=lastContact(h);return STAGES.indexOf(h.stage)<MAIN_N&&(lc?dday(lc)<=-14:dday(h.createdAt)<=-7)};
const monOf=d=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return fmtD(x)};
function repMetrics(u,from,to){const acts=[];S.hospitals.forEach(h=>(h.activities||[]).forEach(a=>{if(a.authorId===u.id&&a.date>=from&&a.date<=to)acts.push({...a,hid:h.id})}));
 const days=bizDays(from,to).filter(d=>d<today()||d===to);const worked=days.filter(d=>!isOffDay(u.id,d)&&d<=today());const goalSum=worked.reduce((s,d)=>s+goalFor(u.id,d),0);
 const visits=acts.filter(a=>a.type==='방문').length;const calls=acts.filter(a=>a.type==='전화').length;
 const own=ownedActive(u.id);const contacted=own.filter(h=>{const lc=lastContact(h);return lc&&dday(lc)>-14}).length;
 const ownIds=new Set(liveH().filter(h=>h.ownerId===u.id).map(h=>h.id));let ups=0;
 S.audit.forEach(e=>{if(e.entity!=='hospital'||!ownIds.has(e.hospitalId))return;const d=fmtTs(e.ts).slice(0,10);if(d<from||d>to)return;(e.changes||[]).forEach(c=>{if(c.field==='현재 단계'){const a=STAGES.indexOf(c.before),b=STAGES.indexOf(c.after);if(b>a&&b<MAIN_N&&a>=0)ups++}})});
 const signups=liveH().filter(h=>h.ownerId===u.id&&h.signupDate>=from&&h.signupDate<=to).length;
 const withNext=liveH().filter(h=>h.ownerId===u.id&&h.next?.date&&!h.next.done);const overdue=withNext.filter(h=>dday(h.next.date)<0);
 const due=days.filter(d=>d<today()&&!isOffDay(u.id,d));const subm=due.filter(d=>S.reports.some(r=>r.authorId===u.id&&r.date===d&&['submitted','confirmed'].includes(r.status))).length;
 const re={긍정:0,보통:0,부정:0,부재:0};acts.forEach(a=>{if(a.reaction in re)re[a.reaction]++});const ans=re.긍정+re.보통+re.부정;
 const elig=own.filter(canEvalStage);const evalOk=elig.filter(h=>evalN(h)===3).length;
 const stale=own.filter(isStale);const evalMissing=elig.filter(h=>evalN(h)<3);
 return {u,visits,calls,worked:worked.length,goalSum,avg:worked.length?visits/worked.length:0,own:own.length,contacted,ups,signups,withNext:withNext.length,overdue,subm,due:due.length,re,ans,elig:elig.length,evalOk,stale,evalMissing,
  scores:{activity:goalSum?Math.min(100,visits/goalSum*100):null,coverage:own.length?contacted/own.length*100:null,progress:null,followup:withNext.length?(withNext.length-overdue.length)/withNext.length*100:100,report:due.length?subm/due.length*100:null,response:ans?re.긍정/ans*100:null,quality:elig.length?evalOk/elig.length*100:null}}}
const AXES=[['activity','활동량'],['coverage','관리 범위'],['progress','단계 진척'],['followup','팔로우업'],['report','보고 성실도'],['response','고객 반응'],['quality','평가 입력']];
const AXIS_HELP={activity:'방문 수 ÷ 근무일 방문 목표 합',coverage:'담당 병원 중 최근 14일 안에 접촉한 비율',progress:'담당 병원 단계 진전 건수 (팀 최고 = 100)',followup:'다음 액션 중 기한을 넘기지 않은 비율',report:'근무일 중 보고서를 제출한 비율',response:'방문·통화 반응 중 긍정 비율 (부재 제외)',quality:'접촉한 담당 병원 중 리드 평가를 다 입력한 비율'};
function teamData(weeks){const to=today();const from=addDays(-(weeks*7-1));const rs=reporters().filter(u=>u.roleId!=='r_admin');const M=rs.map(u=>repMetrics(u,from,to));
 const maxUp=Math.max(0,...M.map(m=>m.ups));M.forEach(m=>{m.scores.progress=maxUp?m.ups/maxUp*100:null;const v=Object.values(m.scores).filter(x=>x!=null);m.total=v.length?v.reduce((a,b)=>a+b,0)/v.length:0});
 const avg={};AXES.forEach(([k])=>{const v=M.map(m=>m.scores[k]).filter(x=>x!=null);avg[k]=v.length?v.reduce((a,b)=>a+b,0)/v.length:0});return {from,to,M,avg,maxUp}}
const gradeOfScore=s=>s>=80?['A','우수','g-a']:s>=65?['B','양호','g-b']:s>=50?['C','보통','g-c']:['D','관리 필요','g-d'];
function repAlerts(m){const goal=S.settings.visitGoal||4;const out=[];
 if(m.overdue.length)out.push(['crit',`팔로우업 지연 ${m.overdue.length}건`]);if(m.stale.length)out.push(['warn',`2주 넘게 연락 없는 병원 ${m.stale.length}곳`]);
 if(m.due&&m.subm<m.due)out.push([m.due-m.subm>=2?'crit':'warn',`보고서 미제출 ${m.due-m.subm}일`]);if(m.worked&&m.avg<goal*.75)out.push(['warn',`일평균 방문 ${m.avg.toFixed(1)}곳 (목표 ${goal})`]);
 if(m.evalMissing.length>=3)out.push(['info',`리드 평가 미완료 ${m.evalMissing.length}곳`]);if(m.signups)out.push(['good',`회원가입 전환 ${m.signups}건`]);return out}
function radarSVG(vals,avg,color,size,compact){const n=AXES.length,c=size/2,r=size/2-(compact?26:40);const mx=compact?56:64;const P=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [c+Math.cos(a)*r*(v||0)/100,c+Math.sin(a)*r*(v||0)/100]};
 let g='';[25,50,75,100].forEach(v=>{g+=`<polygon points="${AXES.map((_,i)=>P(i,v).join(',')).join(' ')}" fill="none" stroke="var(--grid)" stroke-width="1"/>`});
 AXES.forEach(([k,l],i)=>{const [x,y]=P(i,100);g+=`<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`;const [lx,ly]=P(i,compact?118:122);const anc=Math.abs(lx-c)<4?'middle':lx>c?'start':'end';g+=`<text x="${lx}" y="${ly+4}" text-anchor="${anc}" class="ax" font-size="${compact?15:13}" font-weight="600">${l}</text>`});
 g+=`<polygon points="${AXES.map(([k],i)=>P(i,avg[k]||0).join(',')).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
 g+=`<polygon points="${AXES.map(([k],i)=>P(i,vals[k]).join(',')).join(' ')}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
 AXES.forEach(([k,l],i)=>{const [x,y]=P(i,vals[k]);g+=`<circle cx="${x}" cy="${y}" r="${compact?3.5:4.5}" fill="${color}" stroke="var(--surface)" stroke-width="2" ${tipAttr([l,vals[k]==null?'이 기간 데이터 없음 · 종합 점수에서 제외':`${Math.round(vals[k])}점 (팀 평균 ${Math.round(avg[k])})`,AXIS_HELP[k]])}/>`});
 return `<svg viewBox="${-mx} 0 ${size+mx*2} ${size}" class="radar" role="img" aria-label="역량 레이더">${g}</svg>`}
function sparkSVG(vals,color){const w=120,h=28,max=Math.max(1,...vals);const x=i=>4+i*(w-8)/(vals.length-1||1),y=v=>h-4-(h-8)*v/max;
 return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(vals.length-1)}" cy="${y(vals.at(-1))}" r="3" fill="${color}"/></svg>`}
const weeklyVisits=(uidv,n=8)=>{const w0=monOf(today());const ws=[...Array(n)].map((_,i)=>addDays(-7*(n-1-i),w0));const acts=S.hospitals.flatMap(h=>h.activities||[]).filter(a=>a.authorId===uidv&&a.type==='방문');return {ws,vals:ws.map(w=>acts.filter(a=>monOf(a.date)===w).length)}};

/* ============ 팀 성과 (관리자) ============ */
function teamHTML(){const T=ui.team;const D=teamData(T.weeks);const {M,avg}=D;const goal=S.settings.visitGoal||4;
 const alerts=M.reduce((s,m)=>s+repAlerts(m).filter(a=>a[0]==='crit'||a[0]==='warn').length,0);const teamAvg=M.length?M.reduce((s,m)=>s+m.total,0)/M.length:0;
 const k=[['팀 평균 종합 점수',`${Math.round(teamAvg)}점`,gradeOfScore(teamAvg)[1],false,'total'],['기간 방문',fmtN(M.reduce((s,m)=>s+m.visits,0)),`통화 ${fmtN(M.reduce((s,m)=>s+m.calls,0))}`,false,'visitsKpi'],['단계 진전',M.reduce((s,m)=>s+m.ups,0),`회원가입 전환 ${M.reduce((s,m)=>s+m.signups,0)}건`,false,'upsKpi'],['주의 항목',alerts,'지연·미제출·방치 리드 등',alerts>0,'alerts']];
 const cell=(v)=>v==null?'<td class="hm">—</td>':`<td class="hm" style="background:color-mix(in srgb,${v>=80?'var(--ok)':v>=50?'var(--warn)':'var(--danger)'} ${Math.round(10+(v>=80?v-60:v>=50?40:70-v)*.5)}%,transparent)">${Math.round(v)}</td>`;
 return `<div class="page-head"><div><h1>팀 성과</h1><p>${fd(D.from)} ~ ${fd(D.to)} · 활동량, 관리 범위, 단계 진척, 팔로우업, 보고 성실도, 고객 반응, 평가 입력 7가지로 영업사원을 비교합니다. 점선은 팀 평균입니다.</p></div>
 <div class="seg" style="width:auto">${[2,4,8].map(w=>`<button type="button" class="${T.weeks===w?'on':''}" data-act="teamWeeks" data-v="${w}">최근 ${w}주</button>`).join('')}</div></div>
 <div class="kpis">${k.map(([l,v,s,al,ik])=>`<div class="kpi ${al?'alert':''}"><span class="lbl-i">${l}${infoBtn(ik)}</span><b>${v}</b><small>${s}</small></div>`).join('')}</div>
 <div class="team-grid">${M.sort((a,b)=>b.total-a.total).map(m=>{const g=gradeOfScore(m.total);const col=userColor(m.u.id);const wv=weeklyVisits(m.u.id);const al=repAlerts(m);
  return `<article class="team-card"><div class="tc-head">${av(m.u)}<div style="min-width:0"><b>${esc(m.u.name)}</b><small>${esc(roleOf(m.u)?.name||'')} · ${esc(m.u.team||'')}</small></div><div class="tc-score ${g[2]}"><b>${g[0]}</b><span>${Math.round(m.total)}점 · ${g[1]}</span></div>${infoBtn('total',m.u.id)}</div>
  ${radarSVG(m.scores,avg,col,260,true)}
  <div class="tc-nums"><div><b>${m.avg.toFixed(1)}</b><span>일평균 방문<br>목표 ${goal}</span></div><div><b>${m.own}</b><span>담당 병원<br>(진행 중)</span></div><div><b>${m.ups}</b><span>단계 진전</span></div><div><b>${m.signups}</b><span>회원가입</span></div></div>
  <div class="tc-trend"><span class="h-sub">주간 방문 8주</span>${sparkSVG(wv.vals,col)}<b class="num">${wv.vals.at(-1)}</b></div>
  <div class="lbl-i h-sub" style="margin-bottom:-4px">주의 항목${infoBtn('alerts')}</div><ul class="tc-alerts">${al.slice(0,4).map(([lv,t])=>`<li class="al-${lv}">${t}</li>`).join('')||'<li class="al-good">특이 사항 없음</li>'}</ul>
  <button class="btn sm" data-act="teamOpen" data-v="${m.u.id}">자세히 보기 · 코칭 메모</button></article>`}).join('')||'<div class="panel empty">보고서를 쓰는 영업 담당자가 없습니다</div>'}</div>
 <section class="panel" style="margin-top:16px"><h2>항목별 비교 <small>0~100점 · 초록 80 이상, 주황 50~79, 빨강 50 미만 · ⓘ를 누르면 계산 기준</small></h2>
 <div class="tbl-wrap"><table class="heat"><thead><tr><th>영업사원</th>${AXES.map(([k,l])=>`<th><span class="lbl-i">${l}${infoBtn(k)}</span></th>`).join('')}<th><span class="lbl-i">종합${infoBtn('total')}</span></th></tr></thead><tbody>
 ${M.map(m=>`<tr class="row" data-act="teamOpen" data-v="${m.u.id}"><td><div class="u-cell"><span class="sw-dot" style="background:${userColor(m.u.id)}"></span><b>${esc(m.u.name)}</b></div></td>${AXES.map(([k])=>cell(m.scores[k])).join('')}<td><span class="badge ${gradeOfScore(m.total)[2]}">${gradeOfScore(m.total)[0]} ${Math.round(m.total)}</span></td></tr>`).join('')}
 <tr class="avg-row"><td>팀 평균</td>${AXES.map(([k])=>`<td class="num">${M.some(x=>x.scores[k]!=null)?Math.round(avg[k]):'—'}</td>`).join('')}<td class="num">${Math.round(teamAvg)}</td></tr></tbody></table></div></section>`}
function teamDetailHTML(uidv){const D=teamData(ui.team.weeks);const m=D.M.find(x=>x.u.id===uidv);if(!m)return '<div class="empty">데이터 없음</div>';const col=userColor(uidv);const g=gradeOfScore(m.total);
 const wv=weeklyVisits(uidv);const team=D.M.map(x=>weeklyVisits(x.u.id).vals);const tAvg=wv.ws.map((_,i)=>+(team.reduce((s,v)=>s+v[i],0)/Math.max(1,team.length)).toFixed(1));
 const line={type:'line',h:200,labels:wv.ws.map(w=>w.slice(5).replace('-','/')),full:wv.ws.map(w=>`${fd(w)} 시작 주`),unit:'곳',series:[{name:m.u.name,color:col,values:wv.vals},{name:'팀 평균',color:'var(--muted)',values:tAvg}]};
 const own=liveH().filter(h=>h.ownerId===uidv);const pipe={type:'hbar',rows:STAGES.map(s=>({label:s,segs:[{name:'병원',color:sc(s),value:own.filter(h=>h.stage===s).length}]})),unit:'곳',labelW:96};
 const notes=(S.coaching||[]).filter(n=>n.userId===uidv).sort((a,b)=>b.ts.localeCompare(a.ts));const ce=can('team','create');
 return `<div class="rv-head">${av(m.u)}<div><b>${esc(m.u.name)}</b> <span class="muted">${esc(roleOf(m.u)?.name||'')} · ${esc(m.u.team||'')}</span><div class="au-meta"><span>${fd(D.from)} ~ ${fd(D.to)}</span><span class="badge ${g[2]}">${g[0]} · ${Math.round(m.total)}점 · ${g[1]}</span></div></div></div>
 <div class="td-top"><div>${radarSVG(m.scores,D.avg,col,340,false)}<p class="hint" style="text-align:center;margin:0">실선 ${esc(m.u.name)} · 점선 팀 평균</p></div>
 <div class="tbl-wrap"><table><thead><tr><th>항목</th><th>점수</th><th>팀 평균</th><th>근거</th></tr></thead><tbody>
 ${[['activity',`방문 ${m.visits} / 목표 ${m.goalSum} (근무 ${m.worked}일)`],['coverage',`${m.contacted} / ${m.own}곳`],['progress',`단계 진전 ${m.ups}건`],['followup',`지연 ${m.overdue.length} / 진행 중 ${m.withNext}건`],['report',`제출 ${m.subm} / ${m.due}일`],['response',`긍정 ${m.re.긍정} · 보통 ${m.re.보통} · 부정 ${m.re.부정}`],['quality',`${m.evalOk} / ${m.elig}곳`]].map(([k,t])=>`<tr><td><span class="lbl-i">${AXES.find(a=>a[0]===k)[1]}${infoBtn(k,uidv)}</span></td><td class="num"><b>${m.scores[k]==null?'—':Math.round(m.scores[k])}</b></td><td class="num muted">${D.M.some(x=>x.scores[k]!=null)?Math.round(D.avg[k]):'—'}</td><td class="h-sub">${t}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="rv-2"><div><h3 class="rv-h">주간 방문 추이</h3>${legendHTML(line.series)}${chartBox(line)}</div><div><h3 class="rv-h">담당 병원 단계 구성 · ${own.length}곳</h3>${chartBox(pipe)}</div></div>
 <div class="rv-2"><div><h3 class="rv-h">팔로우업 지연 · ${m.overdue.length}건</h3>${m.overdue.length?`<ul class="plain">${m.overdue.sort((a,b)=>a.next.date.localeCompare(b.next.date)).slice(0,8).map(h=>`<li><button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button> <span class="h-sub">${fd(h.next.date)} · ${esc(h.next.todo||'')}</span></li>`).join('')}</ul>`:'<p class="hint">없음</p>'}</div>
 <div><h3 class="rv-h">2주 넘게 연락 없는 병원 · ${m.stale.length}곳</h3>${m.stale.length?`<ul class="plain">${m.stale.slice(0,8).map(h=>`<li><button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button> <span class="h-sub">${esc(h.stage)} · 마지막 접촉 ${fd(lastContact(h))||'없음'}</span></li>`).join('')}</ul>`:'<p class="hint">없음</p>'}</div></div>
 <h3 class="rv-h">코칭 메모 · ${notes.length}건</h3>${ce?`<div class="inline-add" style="margin-bottom:10px"><input id="coach-text" placeholder="예: 분당 권역 2차 방문 전환율 개선 — 시연 자료 보강 함께 준비" style="flex:1"><button class="btn primary" data-act="coachAdd" data-v="${uidv}">메모 남기기</button></div>`:''}
 ${notes.length?`<ul class="audit">${notes.map(n=>`<li class="au"><div class="au-head">${av(userById(n.authorId)||{name:n.authorName})}<div style="flex:1;min-width:0"><b>${esc(userName(n.authorId)||n.authorName)}</b><div class="au-meta"><span class="mono">${fmtTs(n.ts)}</span></div><p class="au-sum" style="margin-top:4px;white-space:pre-wrap">${esc(n.text)}</p></div>${can('team','delete')&&n.authorId===cur().id?`<button class="icon-btn" data-act="coachDel" data-v="${n.id}" aria-label="삭제">${I.trash}</button>`:''}</div></li>`).join('')}</ul>`:'<p class="hint">아직 메모가 없습니다. 1:1 면담 내용과 다음 목표를 남겨 두세요.</p>'}`}

/* ============ 오늘 할 일 (영업사원) ============ */
function todayHTML(){const me=cur();const t=today();const mine=liveH().filter(h=>h.ownerId===me.id);const att=attOn(me.id,t,['approved','requested']);const goal=goalFor(me.id,t);
 const actsToday=S.hospitals.flatMap(h=>(h.activities||[]).filter(a=>a.authorId===me.id&&a.date===t).map(a=>({...a,hid:h.id})));const visitedIds=new Set(actsToday.filter(a=>a.type==='방문').map(a=>a.hid));const touched=new Set(actsToday.map(a=>a.hid));
 const pd=prevBiz(t);const prvRep=S.reports.find(r=>r.authorId===me.id&&r.date===pd);const planIds=prvRep?.plan?.hospitalIds||[];
 const due=mine.filter(h=>h.next?.date&&!h.next.done&&h.next.date<=t);
 const ids=[...new Set([...planIds,...due.map(h=>h.id)])].filter(id=>getH(id)&&!getH(id).deletedAt);
 const items=ids.map(id=>{const h=getH(id);return {h,plan:planIds.includes(id),fu:due.includes(h),done:touched.has(id)}}).sort((a,b)=>a.done-b.done||(b.fu&&dday(b.h.next.date)<0)-(a.fu&&dday(a.h.next.date)<0));
 const left=items.filter(x=>!x.done).length;const stale=mine.filter(isStale).sort((a,b)=>(lastContact(a)||'0').localeCompare(lastContact(b)||'0'));const evalNeed=mine.filter(h=>STAGES.indexOf(h.stage)>=1&&STAGES.indexOf(h.stage)<MAIN_N&&evalN(h)<3);
 const week=mine.filter(h=>h.next?.date&&!h.next.done&&h.next.date>t&&h.next.date<=addDays(7)).sort((a,b)=>a.next.date.localeCompare(b.next.date));
 const myAtt=(S.attendance||[]).filter(a=>a.userId===me.id&&['approved','requested'].includes(a.status)&&a.to>=t&&a.from<=addDays(14));
 const todos=(S.todos||[]).filter(x=>x.userId===me.id&&(!x.done||x.doneAt?.slice(0,10)===t)).sort((a,b)=>a.done-b.done||a.date.localeCompare(b.date));
 const rep=S.reports.find(r=>r.authorId===me.id&&r.date===t);const ret=S.reports.filter(r=>r.authorId===me.id&&r.status==='returned');const wkVisits=S.hospitals.flatMap(h=>h.activities||[]).filter(a=>a.authorId===me.id&&a.type==='방문'&&monOf(a.date)===monOf(t)).length;
 const pct=goal?Math.min(100,visitedIds.size/goal*100):100;
 const row=x=>{const h=x.h;const od=x.fu&&dday(h.next.date)<0;return `<li class="td-item ${x.done?'done':''}"><span class="td-check">${x.done?I.check:''}</span><div style="min-width:0"><div class="td-name"><button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button>${stageBadge(h.stage)}${x.plan?'<span class="cat-chip">어제 계획</span>':''}${x.fu?`<span class="badge ${od?'f-지연':'f-오늘'}">${od?`지연 ${-dday(h.next.date)}일`:'오늘 액션'}</span>`:''}</div>
  <div class="h-sub">${x.fu?esc(h.next.todo||'할 일 미입력'):''}${x.fu?' · ':''}${esc(region(h))}${h.director?` · ${esc(h.director)} 원장`:''}${h.directorPhone?` · <span class="mono">${esc(h.directorPhone)}</span>`:''}</div></div>
  <div class="td-btns">${x.done?'<span class="h-sub">오늘 기록함</span>':`<button class="btn sm primary" data-act="todayRec" data-id="${h.id}">기록</button>`}${x.fu&&can('activity','update',h)?`<button class="btn sm" data-act="fuDone" data-id="${h.id}">액션 완료</button>`:''}</div></li>`};
 return `<div class="page-head"><div><h1>오늘 할 일</h1><p>${fd(t)} · ${esc(me.name)}님${att?` · <span class="badge ${att.status==='approved'?'f-오늘':'st-pending'}">${esc(att.type)}${att.status==='requested'?' 승인 대기':''}</span>`:''}</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">${items.some(x=>!x.done&&x.h.lat)?`<button class="btn" data-act="todayRoute">${I.route}남은 곳으로 동선 만들기</button>`:''}${canRep('create')?`<button class="btn primary" data-act="goReport" data-v="write">${I.report}오늘 보고서 ${rep?REP_ST[rep.status][0]:'작성'}</button>`:''}</div></div>
 ${ret.length?`<div class="notice warn" style="margin-bottom:12px"><span>반려된 보고서 ${ret.length}건 · ${ret.map(r=>fd(r.date)).join(', ')}</span><button class="btn sm" data-act="repEdit" data-v="${ret[0].date}">보완하기</button></div>`:''}
 <div class="kpis today-kpis"><div class="kpi"><span>오늘 방문</span><b>${visitedIds.size}<small style="font-size:14px"> / ${goal}</small></b><div class="meter"><i style="width:${pct}%;background:${visitedIds.size>=goal?'var(--ok)':'var(--accent)'}"></i></div></div>
  <div class="kpi"><span>남은 방문·액션</span><b>${left}</b><small>오늘 목록 ${items.length}곳 중</small></div><div class="kpi ${due.filter(h=>dday(h.next.date)<0).length?'alert':''}"><span>지연된 팔로우업</span><b>${due.filter(h=>dday(h.next.date)<0).length}</b><small>기한이 지난 다음 액션</small></div>
  <div class="kpi"><span>이번 주 방문</span><b>${wkVisits}</b><small>월요일부터 누계</small></div></div>
 <div class="today-grid"><div class="tg-main">
 <section class="panel"><h2>오늘 갈 곳·할 일 <small>어제 보고서의 내일 계획 + 오늘까지인 다음 액션</small></h2>${items.length?`<ul class="td-list">${items.map(row).join('')}</ul>`:'<div class="empty">오늘 예정된 곳이 없습니다. 아래 추천에서 골라 보세요.</div>'}</section>
 <section class="panel"><h2>2주 넘게 연락 없는 담당 병원 <small>${stale.length}곳 · 오래된 순</small></h2>${stale.length?`<ul class="td-list">${stale.slice(0,8).map(h=>`<li class="td-item"><span class="td-dot" style="background:${sc(h.stage)}"></span><div style="min-width:0"><div class="td-name"><button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button>${stageBadge(h.stage)}</div><div class="h-sub">마지막 접촉 ${fd(lastContact(h))||'없음'} · ${esc(region(h))}</div></div><div class="td-btns"><button class="btn sm" data-act="todayRec" data-id="${h.id}" data-t="전화">전화 기록</button></div></li>`).join('')}</ul>`:'<div class="empty">모든 담당 병원과 최근 2주 안에 연락했습니다</div>'}</section>
 ${evalNeed.length?`<section class="panel"><h2>리드 평가가 덜 된 병원 <small>${evalNeed.length}곳</small></h2><div class="chips">${evalNeed.slice(0,12).map(h=>`<button class="chip-toggle" style="--cc:${sc(h.stage)}" data-act="openEval" data-id="${h.id}"><i></i>${esc(h.name)} · ${evalN(h)}/3</button>`).join('')}</div></section>`:''}
 </div><div class="tg-side">
 <section class="panel"><h2>내 메모·할 일 <small>나만 보입니다</small></h2><div class="inline-add" style="margin-bottom:10px"><input id="todo-text" placeholder="예: 견적서 PDF 다시 보내기" data-todo-in="1"><button class="btn" data-act="tdAdd">추가</button></div>
  ${todos.length?`<ul class="todo-list">${todos.map(x=>`<li class="${x.done?'done':''}"><label class="check"><input type="checkbox" data-act="tdToggle" data-v="${x.id}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>${x.date<t&&!x.done?`<small class="h-sub">${fd(x.date)}부터</small>`:''}<button class="icon-btn" data-act="tdDel" data-v="${x.id}" aria-label="삭제">${I.x}</button></li>`).join('')}</ul>`:'<p class="hint">못 끝낸 할 일은 다음 날로 넘어갑니다.</p>'}</section>
 <section class="panel"><h2>이번 주 다가오는 일정</h2>${week.length||myAtt.length?`<ul class="plain">${myAtt.map(a=>`<li><span class="badge ${a.status==='approved'?'f-오늘':'st-pending'}">${esc(a.type)}</span> ${attPeriod(a)}</li>`).join('')}${week.map(h=>`<li><span class="mono h-sub">${fd(h.next.date)}</span> <button class="au-target" data-act="open" data-id="${h.id}">${esc(h.name)}</button> <span class="h-sub">${esc(h.next.todo||'')}</span></li>`).join('')}</ul>`:'<p class="hint">7일 안에 예정된 일이 없습니다</p>'}</section>
 <section class="panel"><h2>오늘 기록한 활동 <small>${actsToday.length}건</small></h2>${actsToday.length?`<ul class="plain">${actsToday.map(a=>`<li><b>${esc(hName(a.hid))}</b> <span class="h-sub">${esc(a.type)}${a.purpose?' · '+esc(a.purpose):''}${a.reaction?' · '+a.reaction:''}</span></li>`).join('')}</ul>`:'<p class="hint">아직 없습니다. 방문 후 바로 ‘기록’을 누르세요.</p>'}</section>
 </div></div>`}

/* ============ 계산 기준 안내 (ⓘ 말풍선) ============ */
const INFO={
 activity:{t:'활동량',f:'방문 수 ÷ 근무일 방문 목표 합 × 100 (최대 100점)',d:['방문은 본인이 기록한 ‘방문’ 활동만 셉니다. 전화·문자는 넣지 않습니다.','근무일은 주말, 회사 휴일, 승인된 연차·병가·경조사를 뺀 날입니다.',`하루 목표는 설정의 일일 방문 목표(지금 ${'${G}'}곳)이고, 반차인 날은 절반, 교육인 날은 0곳입니다.`],ex:(m)=>`방문 ${m.visits}곳 ÷ 목표 ${m.goalSum}곳 (근무 ${m.worked}일)`},
 coverage:{t:'관리 범위',f:'최근 14일 안에 연락한 담당 병원 ÷ 진행 중인 담당 병원 × 100',d:['진행 중 = 이탈 단계(보류·Lost 등)가 아닌 담당 병원입니다.','연락은 방문·전화·문자·이메일 등 모든 활동 기록을 셉니다.','기간 선택과 관계없이 오늘 기준 최근 14일로 봅니다.'],ex:(m)=>`연락 ${m.contacted}곳 ÷ 담당 ${m.own}곳`},
 progress:{t:'단계 진척',f:'기간 중 담당 병원의 단계 진전 건수 ÷ 팀에서 가장 많은 사람의 건수 × 100',d:['진행 단계 순서에서 앞으로 나아간 변경만 셉니다. 이탈 단계로 가거나 뒤로 간 것은 빼고 셉니다.','누가 바꿨는지와 관계없이 그 사람이 담당한 병원 기준입니다.','팀 전체에 진전이 하나도 없으면 ‘데이터 없음’으로 두고 종합 점수에서 뺍니다.'],ex:(m,D)=>`진전 ${m.ups}건 ÷ 팀 최고 ${D.maxUp}건`},
 followup:{t:'팔로우업',f:'기한이 지나지 않은 다음 액션 ÷ 진행 중인 다음 액션 × 100',d:['완료 처리하지 않은 다음 액션만 셉니다.','다음 액션일이 오늘보다 앞이면 ‘지연’입니다.','진행 중인 다음 액션이 없으면 100점입니다.'],ex:(m)=>`기한 내 ${m.withNext-m.overdue.length}건 ÷ 진행 중 ${m.withNext}건 (지연 ${m.overdue.length}건)`},
 report:{t:'보고 성실도',f:'보고서를 제출한 근무일 ÷ 제출해야 할 근무일 × 100',d:['제출 또는 팀장 확인 상태만 제출로 봅니다. 임시 저장·반려는 빼고 셉니다.','오늘은 아직 작성 중일 수 있어 빼고, 어제까지만 봅니다.','연차·병가·경조사로 쉰 날은 제출할 날에서 뺍니다.'],ex:(m)=>`제출 ${m.subm}일 ÷ ${m.due}일`},
 response:{t:'고객 반응',f:'긍정 ÷ (긍정 + 보통 + 부정) × 100',d:['기간 중 본인이 기록한 방문·통화의 ‘반응’ 값을 셉니다.','‘부재’와 반응을 고르지 않은 기록은 빼고 셉니다.'],ex:(m)=>`긍정 ${m.re.긍정} ÷ ${m.ans}건 (보통 ${m.re.보통}, 부정 ${m.re.부정})`},
 quality:{t:'평가 입력',f:'리드 평가 3항목을 모두 입력한 병원 ÷ 평가 대상 담당 병원 × 100',d:['3항목은 디지털 수용도, 서비스 호감도, 월 마취 건수이고 각각 상·중·하로 평가합니다.','평가 대상은 1차 방문 이후 단계의 담당 병원입니다. 이탈 단계는 방문 기록이 있을 때만 대상입니다.'],ex:(m)=>`완료 ${m.evalOk}곳 ÷ ${m.elig}곳`},
 total:{t:'종합 점수·등급',f:'7개 항목 점수의 평균 (데이터가 없는 항목은 빼고 평균)',d:['A 80점 이상 우수 · B 65~79 양호 · C 50~64 보통 · D 50 미만 관리 필요','레이더 차트의 점선은 팀 평균이고, 항목별 팀 평균도 데이터가 있는 사람만으로 냅니다.','점수는 사람을 줄 세우기보다 코칭할 항목을 찾는 용도로 보세요.'],ex:(m)=>AXES.map(([k,l])=>`${l} ${m.scores[k]==null?'—':Math.round(m.scores[k])}`).join(' · ')+` → 평균 ${Math.round(m.total)}점`},
 alerts:{t:'주의 항목',f:'아래 규칙에 걸린 항목 수 (빨강·주황만 셉니다)',d:['빨강: 팔로우업 지연이 있음, 보고서 미제출 2일 이상','주황: 2주 넘게 연락 없는 담당 병원, 보고서 미제출 1일, 일평균 방문이 목표의 75% 미만','파랑(참고): 리드 평가 미완료 3곳 이상 · 초록(좋음): 회원가입 전환']},
 visitsKpi:{t:'기간 방문',f:'기간 중 팀원이 기록한 ‘방문’ 활동 합계',d:['아래 작은 글씨는 같은 기간의 ‘전화’ 기록 합계입니다.']},
 upsKpi:{t:'단계 진전',f:'기간 중 팀원 담당 병원의 단계 진전 합계',d:['회원가입 전환은 회원가입일이 기간 안에 있는 담당 병원 수입니다.']}
};
const INFO_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
const infoBtn=(key,uidv)=>`<button type="button" class="info-btn" data-info="${key}" ${uidv?`data-u="${uidv}"`:''} aria-label="${esc(INFO[key].t)} 계산 기준 보기" aria-expanded="false">${INFO_SVG}</button>`;
let infoOpen=null;
function closeInfo(){const p=document.querySelector('.info-pop');if(p)p.remove();if(infoOpen){infoOpen.setAttribute('aria-expanded','false');infoOpen=null}}
function showInfo(btn){const key=btn.dataset.info,I2=INFO[key];if(!I2)return;closeInfo();infoOpen=btn;btn.setAttribute('aria-expanded','true');
 let ex='';if(I2.ex&&btn.dataset.u){const D=teamData(ui.team.weeks);const m=D.M.find(x=>x.u.id===btn.dataset.u);if(m){const sc_=key==='total'?null:m.scores[key];ex=`<div class="ip-ex"><b>${esc(m.u.name)}</b> · ${esc(I2.ex(m,D))}${key!=='total'?` = <b>${sc_==null?'데이터 없음':Math.round(sc_)+'점'}</b>`:''}</div>`}}
 const p=document.createElement('div');p.className='info-pop';p.setAttribute('role','dialog');p.setAttribute('aria-label',I2.t+' 계산 기준');
 p.innerHTML=`<div class="ip-head"><b>${esc(I2.t)}</b><button type="button" class="icon-btn" data-info-close aria-label="닫기">${I.x}</button></div><div class="ip-f">${esc(I2.f)}</div><ul>${I2.d.map(x=>`<li>${esc(x.replace('${G}',S.settings.visitGoal||4))}</li>`).join('')}</ul>${ex}`;
 document.body.appendChild(p);const r=btn.getBoundingClientRect(),pw=p.offsetWidth,ph=p.offsetHeight;let x=r.left+r.width/2-pw/2,y=r.bottom+8;x=Math.max(8,Math.min(innerWidth-pw-8,x));if(y+ph>innerHeight-8)y=Math.max(8,r.top-ph-8);
 p.style.left=x+'px';p.style.top=y+'px';p.style.setProperty('--ax',(r.left+r.width/2-x)+'px');p.classList.toggle('up',y<r.top);p.querySelector('[data-info-close]').focus()}
document.addEventListener('click',e=>{const b=e.target.closest?.('.info-btn');if(b){e.stopPropagation();e.preventDefault();if(infoOpen===b)closeInfo();else showInfo(b);return}
 if(e.target.closest?.('[data-info-close]')){e.stopPropagation();const ob=infoOpen;closeInfo();ob?.focus();return}if(!e.target.closest?.('.info-pop'))closeInfo()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&infoOpen){e.stopPropagation();const ob=infoOpen;closeInfo();ob.focus()}},true);
window.addEventListener('resize',closeInfo);document.addEventListener('scroll',e=>{if(!e.target.closest?.('.info-pop'))closeInfo()},true);

/* ============ 대화상자 ============ */
function confirmBox({title,body,ok='확인',danger=false,input}){return new Promise(res=>{const el=$('#confirmLayer');
 el.innerHTML=`<div class="backdrop"><div class="modal sm" role="alertdialog" aria-modal="true"><header><h2>${esc(title)}</h2></header><div class="body" style="display:grid;gap:10px">${body}${input?`<label class="fld"><span>${esc(input)}</span><input id="cfIn"></label>`:''}</div><footer><button class="btn" id="cfNo">취소</button><button class="btn ${danger?'danger solid':'primary'}" id="cfOk">${esc(ok)}</button></footer></div></div>`;
 const done=v=>{el.innerHTML='';res(v)};$('#cfNo').onclick=()=>done(false);$('#cfOk').onclick=()=>done(input?{v:$('#cfIn').value.trim()}:true);(input?$('#cfIn'):$('#cfOk')).focus()})}
function promptBox(title,value){return new Promise(res=>{const el=$('#confirmLayer');
 el.innerHTML=`<div class="backdrop"><div class="modal sm" role="dialog" aria-modal="true"><header><h2>${esc(title)}</h2></header><div class="body"><input id="pbIn" style="width:100%" value="${esc(value)}"></div><footer><button class="btn" id="pbNo">취소</button><button class="btn primary" id="pbOk">저장</button></footer></div></div>`;
 const done=v=>{el.innerHTML='';res(v)};$('#pbNo').onclick=()=>done(null);$('#pbOk').onclick=()=>done($('#pbIn').value.trim());$('#pbIn').onkeydown=e=>{if(e.key==='Enter')done($('#pbIn').value.trim())};$('#pbIn').focus()})}

/* ============ 액션 ============ */
const H_=()=>getH(ui.detailId);
const A={
 go:b=>{ui.view=b.dataset.v;ui.catEdit=null;ui.modal=null;render();$('#main').scrollTop=0},
 moreMenu:()=>{ui.modal={type:'more'};renderModal()},
 logout:()=>doLogout(),
 pwOpen:()=>{ui.modal={type:'pw',f:{current:'',password:'',password2:''}};renderModal();setTimeout(()=>$('#pw-cur')?.focus(),30)},
 pwSave:()=>savePassword(),
 loginTab:b=>{ui.loginTab=b.dataset.v;ui.loginMsg='';renderLogin()},
 doLogin:()=>doLogin(),
 doSignup:()=>doSignup(),
 newH:()=>openRegister(),
 open:b=>openDetail(b.dataset.id,ui.detailId===b.dataset.id?ui.tab:null),
 closeDetail:()=>closeDetail(),
 bdDrawer:(b,e)=>{if(e.target===b)closeDetail()},
 bd:(b,e)=>{if(e.target===b){ui.modal=null;renderModal()}},
 closeModal:()=>{ui.modal=null;renderModal()},
 bdAddr:(b,e)=>{if(e.target===b){ui.addr=null;renderAddr()}},
 closeAddr:()=>{ui.addr=null;renderAddr()},
 saveNew:()=>saveNew(),
 setF:b=>{const k=b.dataset.k;ui.form[k]=k!=='pre'&&ui.form[k]===b.dataset.v?'':b.dataset.v;refreshFormHost()},
 toggleSrc:b=>{const a=ui.form.sources||[],v=b.dataset.v;ui.form.sources=a.includes(v)?a.filter(x=>x!==v):[...a,v];refreshFormHost()},
 toggleFCat:b=>{const a=ui.form.categoryIds,v=b.dataset.v;ui.form.categoryIds=a.includes(v)?a.filter(x=>x!==v):[...a,v];refreshFormHost()},
 openAddr:()=>openAddr(),
 manualAddr:()=>{const v=$('#manualAddr').value.trim();if(!v){$('#manualAddr').focus();return}const z=($('#manualZip')?.value||'').replace(/\D/g,'').slice(0,5);const parts=v.split(/\s+/);fillAddrInputs(z,v);applyAddr({zip:z,address:v,jibun:'',sido:parts[0]||'',sigungu:/시$/.test(parts[1]||'')&&/구$/.test(parts[2]||'')?parts[1]+' '+parts[2]:parts[1]||'',lat:null,lng:null})},
 listStage:b=>{if(!canRead('hospital'))return;ui.list={...ui.list,stage:b.dataset.v,cat:'',q:'',deleted:false};ui.view='list';render()},
 toggleDeleted:()=>{ui.list.deleted=!ui.list.deleted;render()},
 mapCat:b=>{if(!canRead('map'))return;ui.map.cats=new Set(b.dataset.v?[b.dataset.v]:[]);ui.map.stages=new Set(STAGES);ui.map.sel=null;ui.view='map';mapMounted=false;render()},
 tab:b=>{ui.tab=b.dataset.v;renderDrawer()},
 setStage:b=>{const h=H_(),to=b.dataset.v;if(h.stage===to||!need('hospital','update',h))return;mutateH(h,'영업 단계',x=>setStage(x,to));toast(`단계: ${to}`);render()},
 toggleHCat:b=>{const h=H_(),v=b.dataset.v;if(!need('hospital','update',h))return;mutateH(h,'카테고리',x=>{x.categoryIds=x.categoryIds.includes(v)?x.categoryIds.filter(y=>y!==v):[...x.categoryIds,v]});ui.form.categoryIds=clone(h.categoryIds);render()},
 saveInfo:()=>{const h=H_(),f=ui.form;if(!need('hospital','update',h))return;ui.formErr=validateForm(f);if(ui.formErr){renderDrawer();return}
  const ch=mutateH(h,'기본 정보',x=>{['name','zip','address','jibun','addressDetail','sido','sigungu','lat','lng','grade','specialty','director','ownerId','compId','compUntil','pre'].forEach(k=>x[k]=f[k]);x.sources=clone(f.sources||[]);x.phone=fmtPhone(f.phone);x.directorPhone=fmtPhone(f.directorPhone);x.vetCount=f.vetCount===''?'':+f.vetCount;x.categoryIds=clone(f.categoryIds)});
  ui.form=formFromH(h);toast('기본 정보를 저장했습니다');render()},
 resetInfo:()=>{ui.form=formFromH(H_());ui.formErr='';renderDrawer()},
 delH:async()=>{const h=H_();if(!need('hospital','delete',h))return;const r=await confirmBox({title:'병원을 삭제할까요?',body:`<p><b>${esc(h.name)}</b> (${h.id})를 삭제 목록으로 옮깁니다. 목록·지도·통계에서 빠지지만 기록과 변경 이력은 남고, 삭제 권한이 있는 사람이 복원할 수 있습니다.</p>`,ok:'삭제',danger:true,input:'삭제 사유 (이력에 남습니다)'});if(!r)return;
  mutateH(h,'병원 상태',x=>{x.deletedAt=today();x.deletedBy=cur().id},{action:'delete',summary:r.v?`사유: ${r.v}`:''});ui.map.route=ui.map.route.filter(x=>x!==h.id);if(ui.map.sel===h.id)ui.map.sel=null;closeDetail();toast(`${h.name} 삭제됨 · 삭제된 병원에서 복원할 수 있습니다`);render()},
 restoreH:()=>{const h=H_();if(!need('hospital','delete',h))return;mutateH(h,'병원 상태',x=>{delete x.deletedAt;delete x.deletedBy},{action:'restore'});toast(`${h.name} 복원됨`);render()},
 setEval:b=>{const v=b.dataset.v;ui.evalDraft[b.dataset.k]=v===''?'':+v;renderDrawer()},
 shotDel:b=>{(ui.evalDraft.shots||[]).splice(+b.dataset.i,1);renderDrawer()},
 shotView:b=>{const x=(ui.evalDraft.shots||[])[+b.dataset.i];if(x){ui.modal={type:'img',src:x.data,title:x.name||'근거 이미지'};renderModal()}},
 saveEval:()=>{const h=H_(),e=ui.evalDraft;const has=evalN(h)>0||(h.eval?.shots||[]).length>0;
  const nv={adoption:hasEval(e.adoption)?+e.adoption:'',favor:hasEval(e.favor)?+e.favor:'',surgeries:hasEval(e.surgeries)?+e.surgeries:'',surgeryCount:hasEval(e.surgeryCount)?+e.surgeryCount:'',shots:clone(e.shots||[]),scale:EVAL_MAX};
  const empty=!hasEval(nv.adoption)&&!hasEval(nv.favor)&&!hasEval(nv.surgeries)&&!nv.shots.length;const op=!has?'create':empty?'delete':'update';if(!has&&empty){toast('입력한 값이 없습니다');return}
  if(!empty&&!canEvalStage(h)){toast('리드 평가는 1차 방문 이후에 할 수 있습니다');return}if(!need('eval',op,h))return;
  if(nv.surgeryCount!==''&&(nv.surgeryCount<0||!Number.isFinite(nv.surgeryCount))){toast('실제 건수는 0 이상 숫자로 입력하세요');return}
  mutateH(h,'리드 평가',x=>{x.eval=empty?{}:{...nv,date:today()}},{action:op});ui.evalDraft=clone(h.eval);const sv=save();toast(sv===false?'저장 공간이 부족합니다. 근거 이미지 수를 줄여 주세요':`평가 저장 · ${gradeOf(h)}${scoreOf(h)!=null?` (${scoreOf(h)}/${EVAL_TOTAL}점)`:''}`);render()},
 delEval:async()=>{const h=H_();if(!need('eval','delete',h))return;if(!await confirmBox({title:'리드 평가를 삭제할까요?',body:'<p>세 항목, 근거 이미지, 종합 등급이 지워지고 ‘미평가’로 바뀝니다. 이전 값은 변경 이력에 남습니다.</p>',ok:'삭제',danger:true}))return;
  mutateH(h,'리드 평가',x=>{x.eval={}},{action:'delete'});ui.evalDraft={};toast('평가를 삭제했습니다');render()},
 saveNext:()=>{const h=H_();const has=!!(h.next?.date||h.next?.todo);if(!need('activity',has?'update':'create',h))return;mutateH(h,'영업 활동',x=>{x.next=clone(ui.nextDraft)},{action:has?'update':'create'});toast('다음 액션을 저장했습니다');render()},
 clearNext:()=>{const h=H_();if(!need('activity','delete',h))return;mutateH(h,'영업 활동',x=>{x.next={}},{action:'delete'});ui.nextDraft={};toast('다음 액션을 지웠습니다');render()},
 addAct:()=>{const h=H_(),a=ui.actDraft;if(!need('activity','create',h))return;if(!a.date){toast('날짜를 선택하세요');return}let mv='';
  if(a.date>today()){toast('미래 날짜에는 기록할 수 없습니다');return}mutateH(h,'영업 활동',x=>{x.activities.push({id:uid(),type:a.type,date:a.date,purpose:a.purpose||'',contact:a.contact||'',reaction:a.reaction||'',note:a.note.trim(),authorId:cur().id,...extrasOf(a)});mv=autoAdvance(x)},{action:'create'});ui.actDraft={type:a.type,date:today(),note:'',purpose:'',contact:'',reaction:''};toast(mv?`기록 추가 · 단계가 ‘${mv}’(으)로 바뀌었습니다`:'기록을 추가했습니다');render()},
 editAct:b=>{const x=H_().activities.find(y=>y.id===b.dataset.v);ui.actDraft={id:x.id,type:x.type,date:x.date,note:x.note,purpose:x.purpose||'',contact:x.contact||'',reaction:x.reaction||'',...extrasDraft(x)};renderDrawer();setTimeout(()=>$('#ac-note')?.focus(),20)},
 cancelAct:()=>{ui.actDraft={type:'방문',date:today(),note:''};renderDrawer()},
 saveAct:()=>{const h=H_(),a=ui.actDraft;if(!need('activity','update',h))return;let mv='';mutateH(h,'영업 활동',x=>{const t=x.activities.find(y=>y.id===a.id);Object.assign(t,{type:a.type,date:a.date,purpose:a.purpose||'',contact:a.contact||'',reaction:a.reaction||'',note:a.note.trim()});delete t.voc;delete t.comp;delete t.issue;Object.assign(t,extrasOf(a));mv=autoAdvance(x)});
  ui.actDraft={type:'방문',date:today(),note:''};toast(mv?`수정 · 단계가 ‘${mv}’(으)로 바뀌었습니다`:'기록을 수정했습니다');render()},
 delAct:async b=>{const h=H_();if(!need('activity','delete',h))return;if(!await confirmBox({title:'기록을 삭제할까요?',body:'<p>삭제한 내용은 변경 이력에 남습니다. 영업 단계는 자동으로 내려가지 않습니다.</p>',ok:'삭제',danger:true}))return;
  mutateH(h,'영업 활동',x=>{x.activities=x.activities.filter(y=>y.id!==b.dataset.v)},{action:'delete'});render()},
 saveConv:()=>{const h=H_(),c=ui.convDraft;const has=!!(h.signupDate||+h.usageCount||h.lastUsedDate||h.memo);if(!need('conv',has?'update':'create',h))return;let mv='';
  mutateH(h,'전환·사용',x=>{x.signupDate=c.signupDate||'';x.usageCount=+c.usageCount||0;x.lastUsedDate=c.lastUsedDate||'';x.memo=c.memo||'';mv=autoAdvance(x)},{action:has?'update':'create'});toast(mv?`저장 · 단계가 ‘${mv}’(으)로 바뀌었습니다`:'저장했습니다');render()},
 delConv:async()=>{const h=H_();if(!need('conv','delete',h))return;if(!await confirmBox({title:'전환·사용 정보를 삭제할까요?',body:'<p>회원가입일, 사용 건수, 최근 사용일, 비고가 비워집니다. 이전 값은 변경 이력에 남습니다.</p>',ok:'삭제',danger:true}))return;
  mutateH(h,'전환·사용',x=>{x.signupDate='';x.usageCount=0;x.lastUsedDate='';x.memo=''},{action:'delete'});ui.convDraft={signupDate:'',usageCount:0,lastUsedDate:'',memo:''};render()},
 showOnMap:b=>{const id=b.dataset.id;closeDetail();ui.map.cats=new Set();ui.map.stages=new Set(STAGES);ui.map.sel=id;ui.view='map';mapMounted=false;render();const h=getH(id);setTimeout(()=>mapAdapter?.focus(h),30)},
 histMore:()=>{ui.hist.limit+=60;render()},
 // 카테고리
 ceNew:()=>{if(!need('category','create'))return;ui.catEdit={id:null,name:'',desc:'',color:CAT_COLORS[S.categories.length%CAT_COLORS.length]};render();setTimeout(()=>$('#ce-name')?.focus(),20)},
 ceEdit:b=>{if(!need('category','update'))return;ui.catEdit=clone(catById(b.dataset.v));render()},
 ceCancel:()=>{ui.catEdit=null;render()},
 ceColor:b=>{ui.catEdit.color=b.dataset.v;render()},
 ceSave:()=>{const c=ui.catEdit;c.name=c.name.trim();if(!need('category',c.id?'update':'create'))return;if(!c.name){c.err='이름을 입력하세요.';render();return}if(c.name==='미분류'||S.categories.some(x=>x.name===c.name&&x.id!==c.id)){c.err='같은 이름의 카테고리가 이미 있습니다.';render();return}
  if(c.id){const o=catById(c.id);const ch=[['이름','name'],['설명','desc'],['색상','color']].filter(([,k])=>(o[k]||'')!==(c[k]||'')).map(([l,k])=>({field:l,before:o[k]||'',after:c[k]||''}));
   if(ch.length)logEntry({entity:'category',entityId:o.id,targetName:c.name,action:'update',section:'카테고리',changes:ch});Object.assign(o,{name:c.name,desc:c.desc,color:c.color});toast('카테고리를 변경했습니다')}
  else{const id='c'+uid();S.categories.push({id,name:c.name,desc:c.desc,color:c.color});logEntry({entity:'category',entityId:id,targetName:c.name,action:'create',section:'카테고리',changes:[{field:'이름',before:'',after:c.name},{field:'설명',before:'',after:c.desc||''},{field:'색상',before:'',after:c.color}].filter(x=>x.after)});toast(`‘${c.name}’ 추가됨`)}
  ui.catEdit=null;save();render()},
 ceDel:async b=>{if(!need('category','delete'))return;const c=catById(b.dataset.v);const used=S.hospitals.filter(h=>h.categoryIds.includes(c.id));const orphan=used.filter(h=>h.categoryIds.length===1).length;
  if(!await confirmBox({title:`‘${c.name}’ 카테고리를 삭제할까요?`,body:`<p>${used.length}개 병원에서 이 카테고리가 빠집니다.${orphan?` 그중 ${orphan}곳은 다른 카테고리가 없어 <b>미분류</b>가 됩니다.`:''} 각 병원 변경 이력에도 기록됩니다.</p>`,ok:'삭제',danger:true}))return;
  used.forEach(h=>mutateH(h,'카테고리',x=>{x.categoryIds=x.categoryIds.filter(y=>y!==c.id)},{summary:`카테고리 ‘${c.name}’ 삭제로 제외`}));
  logEntry({entity:'category',entityId:c.id,targetName:c.name,action:'delete',section:'카테고리',changes:[{field:'이름',before:c.name,after:''},{field:'지정 병원 수',before:String(used.length),after:'0'}]});
  S.categories=S.categories.filter(x=>x!==c);ui.map.cats.delete(c.id);save();toast('카테고리를 삭제했습니다');render()},
 // 사용자
 usersTab:b=>{ui.usersTab=b.dataset.v;render()},
 acReact:b=>{ui.actDraft.reaction=ui.actDraft.reaction===b.dataset.v?'':b.dataset.v;renderDrawer()},
 noop:()=>{},
 repTab:b=>{ui.rep.tab=b.dataset.v;render()},
 repPreset:b=>{setPreset(b.dataset.v);render()},
 repDayNav:()=>{},
 rpDay:b=>{const R_=ui.rep;const d=+b.dataset.v>0?nextBiz(R_.date):prevBiz(R_.date);if(d>today())return;R_.date=d;R_.draft=null;render()},
 rpWork:b=>{ui.rep.draft.workType=b.dataset.v;render()},
 rpAdd:b=>{const k=b.dataset.v;const def={voc:{type:VOC_TYPES[0],hospitalId:'',text:''},comp:{name:'',hospitalId:'',text:''},issues:{type:ISSUE_TYPES[0],urgency:'보통',text:''},exp:{type:EXP_TYPES[0],amount:'',note:''}}[k];ui.rep.draft[k].push(def);render()},
 rpDel:b=>{ui.rep.draft[b.dataset.v].splice(+b.dataset.i,1);render()},
 planAdd:b=>{ui.rep.draft.plan.hospitalIds.push(b.dataset.v);render()},
 planDel:b=>{const p=ui.rep.draft.plan;p.hospitalIds=p.hospitalIds.filter(x=>x!==b.dataset.v);render()},
 rpSave:()=>repSave(false),
 rpSubmit:()=>repSave(true),
 rpDelete:async()=>{const d=ui.rep.draft;const saved=S.reports.find(r=>r.id===d.id);if(!saved||!canRep('delete',saved)){toast('보고서 삭제 권한이 없습니다');return}
  if(!await confirmBox({title:'임시 저장한 보고서를 삭제할까요?',body:`<p>${dayLabel(d.date)} 보고서 초안이 삭제됩니다. 활동 기록은 그대로 남습니다.</p>`,ok:'삭제',danger:true}))return;
  logEntry({entity:'report',entityId:saved.id,targetName:`${userName(saved.authorId)} ${saved.date} 일일 보고`,action:'delete',section:'영업 보고',changes:diffSnap(snapRep(saved),{})});S.reports=S.reports.filter(r=>r!==saved);ui.rep.draft=null;save();toast('초안을 삭제했습니다');render()},
 repOpen:b=>{const r=S.reports.find(x=>x.id===b.dataset.id);if(!r)return;if(!canRep('read',r)){toast('이 보고서를 볼 권한이 없습니다');return}ui.rep.review='';ui.modal={type:'repView',id:r.id};renderModal()},
 repWriteAt:b=>{ui.rep.tab='write';ui.rep.date=b.dataset.v;ui.rep.draft=null;ui.view='report';render()},
 repEdit:b=>{ui.modal=null;ui.rep.tab='write';ui.rep.date=b.dataset.v;ui.rep.draft=null;ui.view='report';render()},
 repConfirm:b=>repReview(b.dataset.id,true),
 repReturn:b=>repReview(b.dataset.id,false),
 goReport:b=>{ui.view='report';ui.rep.tab=b.dataset.v;ui.rep.date=today();ui.rep.draft=null;render()},
 quickAct:()=>{ui.modal={type:'quickAct',f:{hospitalId:'',type:'방문',date:ui.rep.draft.date,purpose:'',contact:'',reaction:'',note:''}};renderModal()},
 qaReact:b=>{const f=ui.modal.f;f.reaction=f.reaction===b.dataset.v?'':b.dataset.v;renderModal()},
 qaSave:()=>{const m=ui.modal,f=m.f;const h=getH(f.hospitalId);if(!h){m.err='병원을 선택하세요.';renderModal();return}if(!need('activity','create',h))return;let mv='';
  mutateH(h,'영업 활동',x=>{x.activities.push({id:uid(),type:f.type,date:f.date,purpose:f.purpose,contact:f.contact,reaction:f.reaction,note:f.note.trim(),authorId:cur().id,...extrasOf(f)});mv=autoAdvance(x)},{action:'create'});
  ui.modal=null;toast(mv?`${h.name} 기록 추가 · 단계가 ‘${mv}’(으)로 바뀌었습니다`:`${h.name} 기록을 추가했습니다`);render()},
 teamWeeks:b=>{ui.team.weeks=+b.dataset.v;render()},
 teamOpen:b=>{ui.modal={type:'teamView',id:b.dataset.v};renderModal()},
 coachAdd:b=>{if(!can('team','create')){toast('코칭 메모 권한이 없습니다');return}const t=$('#coach-text').value.trim();if(!t){$('#coach-text').focus();return}const n={id:'co_'+uid(),userId:b.dataset.v,authorId:cur().id,authorName:cur().name,ts:new Date().toISOString(),text:t};(S.coaching||=[]).push(n);
  logEntry({entity:'user',entityId:n.userId,targetName:userName(n.userId),action:'create',section:'코칭 메모',changes:[{field:'메모',before:'',after:t}]});save();renderModal();toast('코칭 메모를 남겼습니다')},
 coachDel:async b=>{const n=S.coaching.find(x=>x.id===b.dataset.v);if(!n||!can('team','delete'))return;if(!await confirmBox({title:'메모를 삭제할까요?',body:'<p>삭제 내역은 변경 이력에 남습니다.</p>',ok:'삭제',danger:true}))return;S.coaching=S.coaching.filter(x=>x!==n);logEntry({entity:'user',entityId:n.userId,targetName:userName(n.userId),action:'delete',section:'코칭 메모',changes:[{field:'메모',before:n.text,after:''}]});save();renderModal()},
 todayRec:b=>{const h=getH(b.dataset.id);if(!need('activity','create',h))return;ui.modal={type:'quickAct',f:{hospitalId:h.id,type:b.dataset.t||'방문',date:today(),purpose:'',contact:'',reaction:'',note:''}};renderModal()},
 fuDone:b=>{const h=getH(b.dataset.id);if(!need('activity','update',h))return;mutateH(h,'영업 활동',x=>{x.next={...x.next,done:true}});toast(`${h.name} 다음 액션 완료`);render()},
 todayRoute:()=>{const me=cur();const t=today();const touched=new Set(S.hospitals.filter(h=>(h.activities||[]).some(a=>a.authorId===me.id&&a.date===t)).map(h=>h.id));const pr=S.reports.find(r=>r.authorId===me.id&&r.date===prevBiz(t));
  const ids=[...new Set([...(pr?.plan?.hospitalIds||[]),...liveH().filter(h=>h.ownerId===me.id&&h.next?.date&&!h.next.done&&h.next.date<=t).map(h=>h.id)])].filter(id=>getH(id)?.lat&&!touched.has(id));if(!ids.length){toast('동선에 넣을 곳이 없습니다');return}
  ui.map.route=ids.length>2?nearestOrder(ids):ids;ui.map.cats=new Set();ui.map.stages=new Set(STAGES);ui.map.sel=null;ui.view='map';mapMounted=false;render();setTimeout(()=>mapAdapter?.fit(ui.map.route.map(getH)),60);toast(`${ids.length}곳으로 동선을 만들었습니다`)},
 openEval:b=>openDetail(b.dataset.id,'eval'),
 tdAdd:()=>{const i=$('#todo-text');const t=i.value.trim();if(!t){i.focus();return}(S.todos||=[]).push({id:'td_'+uid(),userId:cur().id,date:today(),text:t,done:false});save();render();setTimeout(()=>$('#todo-text')?.focus(),20)},
 tdToggle:b=>{const x=S.todos.find(y=>y.id===b.dataset.v);x.done=!x.done;x.doneAt=x.done?new Date().toISOString():'';save();render()},
 tdDel:b=>{S.todos=S.todos.filter(y=>y.id!==b.dataset.v);save();render()},
 compNew:()=>{if(!canComp('create')){toast('경쟁사 등록 권한이 없습니다');return}ui.form=blankComp();ui.modal={type:'comp'};renderModal();setTimeout(()=>$('#f-name')?.focus(),30)},
 compEdit:b=>{if(!canComp('update')){toast('수정 권한이 없습니다');return}ui.form=clone(compById(b.dataset.id));if(!ui.form.products?.length)ui.form.products=[{name:'',price:'',note:''}];ui.modal={type:'comp'};renderModal()},
 compOpen:b=>{ui.modal={type:'compView',id:b.dataset.id};renderModal()},
 compSave:()=>compSave(),
 compDel:b=>compDelete(b.dataset.id),
 cpAdd:()=>{ui.form.products.push({name:'',price:'',note:''});renderModal()},
 cpDel:b=>{ui.form.products.splice(+b.dataset.i,1);renderModal()},
 seNew:()=>{if(!need('settings','update'))return;ui.stEdit={id:null,name:'',kind:'main',trigger:'',color:STAGE_COLORS[(S.stages.length+2)%STAGE_COLORS.length]};render();setTimeout(()=>$('#se-name')?.focus(),20)},
 seEdit:b=>{if(!need('settings','update'))return;ui.stEdit=clone(S.stages.find(x=>x.id===b.dataset.v));render()},
 seCancel:()=>{ui.stEdit=null;render()},
 seKind:b=>{ui.stEdit.kind=b.dataset.v;if(b.dataset.v==='exit')ui.stEdit.trigger='';render()},
 seColor:b=>{ui.stEdit.color=b.dataset.v;render()},
 seSave:()=>stageSave(),
 seMove:b=>stageMove(b.dataset.v,+b.dataset.d),
 seDel:b=>{if(!need('settings','update'))return;ui.modal={type:'stDel',id:b.dataset.v};renderModal()},
 seDelGo:b=>stageDelete(b.dataset.v),
 navApp:b=>{setNavApp(b.dataset.v);ui.map.navStep=0;renderRoute()},
 naviStart:b=>naviStart(+b.dataset.i),
 tmapGo:b=>{ui.map.navStep=+b.dataset.i+1;setTimeout(renderRoute,300)},
 attNew:b=>{if(!canAtt('create')){toast('근태 일정 권한이 없습니다');return}const self=b.dataset.v==='me';const d=today();ui.modal={type:'att',self,f:{userId:self?cur().id:(ui.att.user||S.users.find(u=>u.status==='active'&&u.id!==cur().id)?.id),type:'연차',from:d,to:d,reason:''}};renderModal()},
 attType:b=>{const f=ui.modal.f;f.type=b.dataset.v;if(ATT[f.type]?.half)f.to=f.from;ui.modal.overOk=false;renderModal()},
 attSave:()=>attSave(),
 attApprove:b=>{ui.modal=null;attDecide(b.dataset.id,true)},
 attReject:b=>{ui.modal=null;renderModal();attDecide(b.dataset.id,false)},
 attCancel:b=>{ui.modal=null;renderModal();attCancel(b.dataset.id)},
 attOpen:b=>{ui.modal={type:'attView',id:b.dataset.id};renderModal()},
 attMonth:b=>{const v=+b.dataset.v;if(!v){ui.att.month=today().slice(0,7)}else{const [y,m]=ui.att.month.split('-').map(Number);const d=new Date(y,m-1+v,1);ui.att.month=fmtD(d).slice(0,7)}render()},
 holAdd:()=>{if(!attManager())return;const d=$('#hol-date').value,n=$('#hol-name').value.trim();if(!d||!n){toast('날짜와 이름을 입력하세요');return}S.holidays={...holMap(),[d]:n};logEntry({entity:'settings',entityId:'holiday',targetName:'회사 휴일',action:'create',section:'회사 휴일',changes:[{field:fd(d),before:'',after:n}]});save();toast(`${fd(d)} ${n} 추가`);render()},
 holDel:async b=>{if(!attManager())return;const d=b.dataset.v;const n=holName(d);if(!await confirmBox({title:'휴일을 삭제할까요?',body:`<p>${fd(d)} ${esc(n)}이 근무일로 바뀝니다.</p>`,ok:'삭제',danger:true}))return;const h={...holMap()};delete h[d];S.holidays=h;logEntry({entity:'settings',entityId:'holiday',targetName:'회사 휴일',action:'delete',section:'회사 휴일',changes:[{field:fd(d),before:n,after:''}]});save();render()},
 newUser:()=>{if(!need('users','create'))return;ui.modal={type:'user',f:{id:'',name:'',username:'',team:'',phone:'',roleId:'r_sales',status:'active',password:''}};renderModal()},
 editUser:b=>{if(!need('users','update'))return;ui.modal={type:'user',f:{...clone(userById(b.dataset.v)),password:''}};renderModal()},
 saveUser:async()=>{const m=ui.modal,f=m.f;if(!need('users',f.id?'update':'create'))return;f.name=f.name.trim();f.username=(f.username||'').trim().toLowerCase();const pw=f.password||'';
  if(!f.name){m.err='이름을 입력하세요.';renderModal();return}
  if(!USERNAME_RE.test(f.username)){m.err='아이디는 영문 소문자로 시작하고 영문 소문자·숫자·. _ - 로 4~30자여야 합니다.';renderModal();return}
  if(S.users.some(u=>u.username===f.username&&u.id!==f.id)){m.err='이미 사용 중인 아이디입니다.';renderModal();return}
  if(!f.id&&pw.length<8){m.err='초기 비밀번호를 8자 이상 입력하세요.';renderModal();return}
  if(f.id&&pw&&pw.length<8){m.err='새 비밀번호는 8자 이상이어야 합니다.';renderModal();return}
  if(f.status==='active'&&!f.roleId){m.err='활성 사용자는 역할이 있어야 합니다.';renderModal();return}
  f.annualLeave=f.annualLeave===''||f.annualLeave==null?15:+f.annualLeave;const L={name:'이름',username:'아이디',team:'소속',phone:'연락처',roleId:'역할',status:'상태',annualLeave:'연간 연차'};const disp=(k,v)=>k==='roleId'?(S.roles.find(r=>r.id===v)?.name||''):k==='status'?({active:'활성',inactive:'비활성',pending:'승인 대기'}[v]||''):(v==null?'':String(v));
  const data={...f};delete data.password;let id=f.id;
  if(f.id){const o=userById(f.id);const ch=Object.keys(L).filter(k=>String(o[k]??'')!==String(data[k]??'')).map(k=>({field:L[k],before:disp(k,o[k]),after:disp(k,data[k])}));
   if(o.roleId==='r_admin'&&data.roleId!=='r_admin'&&S.users.filter(u=>u.roleId==='r_admin'&&u.status==='active').length<2){m.err='마지막 관리자의 역할은 바꿀 수 없습니다.';renderModal();return}
   if(ch.length)logEntry({entity:'user',entityId:o.id,targetName:data.name,action:'update',section:'사용자',changes:ch});Object.assign(o,{...data,phone:fmtPhone(data.phone)})}
  else{const u={...data,id:'u_'+uid(),slot:Math.max(0,...S.users.map(x=>x.slot||0))+1,phone:fmtPhone(data.phone),joinedAt:today()};id=u.id;S.users.push(u);logEntry({entity:'user',entityId:u.id,targetName:u.name,action:'create',section:'사용자',changes:Object.keys(L).map(k=>({field:L[k],before:'',after:disp(k,u[k])})).filter(c=>c.after)})}
  ui.modal=null;render();const ok=await saveNow();if(!ok)return;
  if(pw){try{await api('POST',`/api/users/${encodeURIComponent(id)}/password`,{password:pw});toast(f.id?'사용자 정보와 비밀번호를 저장했습니다':`${data.name} 추가됨 · 아이디 ${data.username}`)}catch(e){toast('비밀번호를 저장하지 못했습니다: '+e.message)}}
  else toast('사용자 정보를 저장했습니다')},
 delUser:async b=>{if(!need('users','delete'))return;const u=userById(b.dataset.v);const own=S.hospitals.filter(h=>h.ownerId===u.id);
  if(u.roleId==='r_admin'&&S.users.filter(x=>x.roleId==='r_admin').length<2){toast('마지막 관리자는 삭제할 수 없습니다');return}
  if(!await confirmBox({title:`${u.name}님을 삭제할까요?`,body:`<p>로그인할 수 없게 됩니다. ${own.length?`담당 병원 ${own.length}곳은 <b>담당 미지정</b>으로 바뀌고 각 병원 이력에 기록됩니다. `:''}이 사람이 남긴 기록과 변경 이력은 이름과 함께 그대로 남습니다.</p><p class="hint">퇴사자는 삭제 대신 비활성으로 두는 것을 권장합니다.</p>`,ok:'삭제',danger:true}))return;
  own.forEach(h=>mutateH(h,'기본 정보',x=>{x.ownerId=''},{summary:`담당자 ${u.name} 계정 삭제`}));
  logEntry({entity:'user',entityId:u.id,targetName:u.name,action:'delete',section:'사용자',changes:[{field:'아이디',before:u.username,after:''},{field:'역할',before:roleOf(u)?.name||'',after:''}]});
  S.users=S.users.filter(x=>x!==u);save();toast(`${u.name} 삭제됨`);render()},
 approve:b=>{if(!need('users','update'))return;const u=userById(b.dataset.v);const rid=$('#ap-'+u.id).value;
  logEntry({entity:'user',entityId:u.id,targetName:u.name,action:'update',section:'가입 승인',changes:[{field:'상태',before:'승인 대기',after:'활성'},{field:'역할',before:'',after:S.roles.find(r=>r.id===rid).name}]});
  u.status='active';u.roleId=rid;save();toast(`${u.name} 승인 · ${S.roles.find(r=>r.id===rid).name}`);render()},
 reject:async b=>{if(!need('users','delete'))return;const u=userById(b.dataset.v);if(!await confirmBox({title:'가입 신청을 거절할까요?',body:`<p>${esc(u.name)} (${esc(u.username)})의 신청이 삭제됩니다.</p>`,ok:'거절',danger:true}))return;
  logEntry({entity:'user',entityId:u.id,targetName:u.name,action:'delete',section:'가입 거절',changes:[{field:'상태',before:'승인 대기',after:'거절'}]});S.users=S.users.filter(x=>x!==u);save();render()},
 roleSel:b=>{ui.roleSel=b.dataset.v;ui.roleDraft=null;render()},
 roleReset:()=>{ui.roleDraft=null;render()},
 newRole:async()=>{if(!need('users','create'))return;const n=await promptBox('새 역할 이름','');if(!n)return;if(S.roles.some(r=>r.name===n)){toast('같은 이름의 역할이 있습니다');return}
  const r={id:'r_'+uid(),name:n,desc:'',scope:'own',perms:permsOf({dash:'vr',hospital:'vr'})};S.roles.push(r);logEntry({entity:'role',entityId:r.id,targetName:n,action:'create',section:'역할',changes:[{field:'이름',before:'',after:n}]});
  ui.roleSel=r.id;ui.roleDraft=null;save();render()},
 roleSave:()=>{if(!need('users','update'))return;const d=ui.roleDraft,o=S.roles.find(r=>r.id===d.id);if(o.locked)return;d.name=d.name.trim();if(!d.name){toast('역할 이름을 입력하세요');return}
  const ch=[];if(o.name!==d.name)ch.push({field:'이름',before:o.name,after:d.name});if((o.desc||'')!==(d.desc||''))ch.push({field:'설명',before:o.desc||'',after:d.desc||''});
  const sl={all:'전체 병원',own:'내 담당 병원만'};if(o.scope!==d.scope)ch.push({field:'수정 범위',before:sl[o.scope],after:sl[d.scope]});
  FEATURES.forEach(([k,l,ops])=>ops.forEach(op=>{const a=!!o.perms[k]?.[op],b2=!!d.perms[k]?.[op];if(a!==b2)ch.push({field:`${l} · ${OPS.find(x=>x[0]===op)[1]}`,before:a?'허용':'불가',after:b2?'허용':'불가'})}));
  if(!ch.length){toast('바뀐 내용이 없습니다');return}
  logEntry({entity:'role',entityId:o.id,targetName:d.name,action:'update',section:'역할 권한',changes:ch});Object.assign(o,clone(d));ui.roleDraft=null;save();toast(`${d.name} 권한 저장 · ${ch.length}개 항목 변경`);render()},
 delRole:async()=>{if(!need('users','delete'))return;const o=S.roles.find(r=>r.id===ui.roleSel);if(S.users.some(u=>u.roleId===o.id))return;if(!await confirmBox({title:`‘${o.name}’ 역할을 삭제할까요?`,body:'<p>이 역할을 쓰는 사용자는 없습니다.</p>',ok:'삭제',danger:true}))return;
  logEntry({entity:'role',entityId:o.id,targetName:o.name,action:'delete',section:'역할',changes:[{field:'이름',before:o.name,after:''}]});S.roles=S.roles.filter(r=>r!==o);ui.roleDraft=null;save();render()},
 // 설정
 saveKey:async()=>{if(!need('settings','update'))return;const v=$('#kakaoKey').value.trim();if(v!==S.settings.kakaoKey)logEntry({entity:'settings',entityId:'kakao',targetName:'카카오맵 연동',action:'update',section:'설정',changes:[{field:'JavaScript 앱 키',before:S.settings.kakaoKey?'설정됨':'',after:v?'설정됨':''}]});
  S.settings.kakaoKey=v;save();ui.keyMsg='연결 중…';render();await initKakao();ui.keyMsg=kakaoReady?'카카오맵에 연결했습니다.':v?'카카오맵 스크립트를 불러오지 못했습니다. 키와 등록 도메인을 확인하세요. ':'';render()},
 clearKey:()=>{if(!need('settings','update'))return;logEntry({entity:'settings',entityId:'kakao',targetName:'카카오맵 연동',action:'delete',section:'설정',changes:[{field:'JavaScript 앱 키',before:'설정됨',after:''}]});S.settings.kakaoKey='';save();ui.keyMsg='';render()},
 saveGrade:()=>{if(!need('settings','update'))return;const ch=[];
  const goal=+$('#set-goal').value;if(!(goal>=1&&goal<=20)){toast('일일 방문 목표는 1~20 사이로 입력하세요');return}if(goal!==(S.settings.visitGoal||4))ch.push({field:'일일 방문 목표',before:String(S.settings.visitGoal||4),after:String(goal)});
  if(ch.length)logEntry({entity:'settings',entityId:'grade',targetName:'리드 등급·영업 목표',action:'update',section:'설정',changes:ch});S.settings.visitGoal=goal;save();toast('영업 목표를 저장했습니다');render()},
 codeAdd:b=>{if(!need('settings','update'))return;const k=b.dataset.k,inp=$('#add-'+k),v=inp.value.trim();if(!v)return;if(S.codes[k].includes(v)){toast('이미 있는 항목입니다');return}S.codes[k].push(v);
  logEntry({entity:'settings',entityId:k,targetName:k==='grades'?'병원 등급 목록':'전문과 목록',action:'create',section:'설정',changes:[{field:'항목',before:'',after:v}]});save();render()},
 codeRen:async b=>{if(!need('settings','update'))return;const k=b.dataset.k,i=+b.dataset.i,old=S.codes[k][i];const v=await promptBox('이름 변경',old);if(!v||v===old)return;if(S.codes[k].includes(v)){toast('이미 있는 항목입니다');return}
  const f={grades:'grade',specialties:'specialty'}[k];S.codes[k][i]=v;logEntry({entity:'settings',entityId:k,targetName:k==='grades'?'병원 등급 목록':'전문과 목록',action:'update',section:'설정',changes:[{field:'항목',before:old,after:v}]});
  S.hospitals.filter(h=>h[f]===old).forEach(h=>mutateH(h,'기본 정보',x=>{x[f]=v},{summary:'선택 목록 이름 변경에 따른 일괄 반영'}));save();render()},
 codeDel:async b=>{if(!need('settings','update'))return;const k=b.dataset.k,i=+b.dataset.i,v=S.codes[k][i];const f={grades:'grade',specialties:'specialty'}[k];const used=S.hospitals.filter(h=>h[f]===v);
  if(!await confirmBox({title:`‘${v}’ 항목을 삭제할까요?`,body:`<p>${used.length?`${used.length}개 병원에서 이 값이 비워지고 각 병원 이력에 기록됩니다.`:'사용 중인 병원이 없습니다.'}</p>`,ok:'삭제',danger:true}))return;
  S.codes[k].splice(i,1);logEntry({entity:'settings',entityId:k,targetName:k==='grades'?'병원 등급 목록':'전문과 목록',action:'delete',section:'설정',changes:[{field:'항목',before:v,after:''}]});
  used.forEach(h=>mutateH(h,'기본 정보',x=>{x[f]=''},{summary:'선택 목록 항목 삭제에 따른 일괄 반영'}));save();render()},
 // 지도
 mcat:b=>{const v=b.dataset.v,M=ui.map;if(!v)M.cats.clear();else M.cats.has(v)?M.cats.delete(v):M.cats.add(v);refreshMap(true)},
 mcatAll:()=>{ui.map.cats.clear();refreshMap(true)},
 mstage:b=>{const s=b.dataset.v,M=ui.map;M.stages.has(s)?M.stages.delete(s):M.stages.add(s);refreshMap()},
 mstageAll:()=>{const M=ui.map;M.stages=M.stages.size===STAGES.length?new Set():new Set(STAGES);refreshMap()},
 msel:(b,e)=>{if(e.target.closest('.route-btn'))return;selectOnMap(b.dataset.id,true)},
 mclose:()=>{ui.map.sel=null;refreshMap()},
 routeToggle:(b,e)=>{e.stopPropagation();const id=b.dataset.id,R=ui.map.route;ui.map.route=R.includes(id)?R.filter(x=>x!==id):[...R,id];refreshMap()},
 routeOpt:()=>{if(ui.map.route.length>2){ui.map.route=nearestOrder(ui.map.route);refreshMap();toast('가까운 순으로 정렬했습니다')}},
 routeClear:()=>{ui.map.route=[];refreshMap()},
 fitMap:()=>mapAdapter?.fit(mapFiltered()),
 toggleLabels:b=>{ui.map.labels=!ui.map.labels;b.textContent=ui.map.labels?'이름 숨기기':'이름 표시';$('#mapCanvas').classList.toggle('hide-labels',!ui.map.labels)}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const f=A[b.dataset.act];if(f)f(b,e)});
document.addEventListener('input',e=>{const t=e.target,d=t.dataset;
 if(d.f&&ui.form){ui.form[d.f]=t.value;if(ui.form._dupWarned&&['name','phone','addressDetail'].includes(d.f))ui.form._dupWarned=false}
 else if(d.lf){ui.list[d.lf]=t.value;renderListBody()}
 else if(d.hf){ui.hist[d.hf]=t.value;ui.hist.limit=60;const pos=t.selectionStart;render();if(t.type==='search'){const n=$('#hq');n.focus();n.setSelectionRange(pos,pos)}}
 else if(d.ht){ui.histTab[d.ht]=t.value;renderDrawer()}
 else if(d.ev){ui.evalDraft[d.ev]=t.value;const p=$('#scorePreview');if(p)p.innerHTML=scoreHTML(ui.evalDraft)}
 else if(d.nx){ui.nextDraft[d.nx]=t.type==='checkbox'?t.checked:t.value}
 else if(d.ac){ui.actDraft[d.ac]=t.value}
 else if(d.cv){ui.convDraft[d.cv]=t.value}
 else if(d.ce&&ui.catEdit){ui.catEdit[d.ce]=t.value}
 else if(d.uf&&ui.modal?.f){ui.modal.f[d.uf]=t.value}
 else if(d.su){ui.signup[d.su]=t.value}
 else if(d.pw&&ui.modal?.f){ui.modal.f[d.pw]=t.value}
 else if(d.att){ui.att[d.att]=t.value;render()}
 else if(d.se&&ui.stEdit){ui.stEdit[d.se]=t.value}
 else if(d.cp&&ui.form?.products){ui.form.products[+d.cp][d.k]=t.value}
 else if(d.cq){ui.cq=t.value;const pos=t.selectionStart;render();const n=document.querySelector('[data-cq]');if(n){n.focus();n.setSelectionRange(pos,pos)}}
 else if(d.af&&ui.modal?.f){ui.modal.f[d.af]=t.value;if(d.af==='from'&&(ATT[ui.modal.f.type]?.half||ui.modal.f.to<t.value))ui.modal.f.to=t.value;if(d.af!=='reason')renderModal()}
 else if(d.rp&&ui.rep.draft){ui.rep.draft[d.rp]=t.value}
 else if(d.rpplan&&ui.rep.draft){ui.rep.draft.plan[d.rpplan]=t.value}
 else if(d.rr&&ui.rep.draft){const row=ui.rep.draft[d.rr][+d.i];row[d.k]=t.value;if(d.rr==='comp'&&d.k==='competitorId')row.name=compById(t.value)?.name||'';if(d.rr==='exp'&&d.k==='amount'){const hh=$('.rep-grid .panel h2 small');}}
 else if(d.rpdate&&t.value){if(t.value>today()){t.value=today()}ui.rep.date=t.value;ui.rep.draft=null;render()}
 else if(d.rpr){ui.rep[d.rpr]=t.value;if(d.rpr==='from'||d.rpr==='to')ui.rep.preset='';render()}
 else if(d.rv){ui.rep.review=t.value}
 else if(d.qa&&ui.modal?.f){ui.modal.f[d.qa]=t.value}
 else if(t.id==='planPick'&&t.value&&ui.rep.draft){ui.rep.draft.plan.hospitalIds.push(t.value);render()}
 else if(d.rd&&ui.roleDraft){ui.roleDraft[d.rd]=t.value}
 else if(d.perm&&ui.roleDraft){const p=ui.roleDraft.perms[d.perm];const ops=FEATURES.find(f=>f[0]===d.perm)[2];p[d.op]=t.checked;
  if(t.checked){if(d.op!=='view')p.view=true;if(['create','update','delete'].includes(d.op))p.read=true}
  else{if(d.op==='view')ops.forEach(o=>p[o]=false);if(d.op==='read')['create','update','delete'].forEach(o=>{if(ops.includes(o))p[o]=false})}
  document.querySelectorAll(`[data-perm="${d.perm}"]`).forEach(c=>c.checked=!!p[c.dataset.op])}
});
async function addShots(files){const d=ui.evalDraft;if(!d)return;d.shots=d.shots||[];const list=[...files].filter(f=>f.type.startsWith('image/'));
 if(!list.length){toast('이미지 파일만 올릴 수 있습니다');return}let skipped=0;
 for(const f of list){if(d.shots.length>=MAX_SHOTS){skipped++;continue}try{d.shots.push({id:uid(),name:f.name||'캡처 이미지',data:await shrinkImage(f),at:today()})}catch(e){toast('이미지를 읽지 못했습니다')}}
 if(skipped)toast(`근거 이미지는 최대 ${MAX_SHOTS}장까지 올릴 수 있습니다`);renderDrawer()}
function shrinkImage(file,max=1200){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};img.src=r.result};r.readAsDataURL(file)})}
document.addEventListener('change',e=>{if(e.target.matches?.('[data-evfile]')){addShots(e.target.files);e.target.value=''}});
document.addEventListener('paste',e=>{if(!ui.detailId||ui.tab!=='eval'||!document.getElementById('ev-shots'))return;const fs=[...(e.clipboardData?.items||[])].filter(x=>x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);if(fs.length){e.preventDefault();addShots(fs)}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.nx==='done')ui.nextDraft.done=t.checked;if(t.dataset.f&&/phone|Phone/.test(t.dataset.f)&&ui.form){ui.form[t.dataset.f]=fmtPhone(t.value);t.value=ui.form[t.dataset.f]}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='todo-text'){e.preventDefault();A.tdAdd();return}if(e.key==='Enter'&&e.target.id==='coach-text'){e.preventDefault();document.querySelector('[data-act=coachAdd]')?.click();return}if(e.key!=='Escape')return;if($('#confirmLayer').innerHTML)return;if(ui.addr){ui.addr=null;renderAddr()}else if(ui.modal){ui.modal=null;renderModal()}else if(ui.detailId)closeDetail()});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(ui.view==='list')renderListBody();drawCharts()},150)});

/* ============ 외부 스크립트 (카카오) ============ */
function loadScript(src,ms=6000){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;const t=setTimeout(()=>rej(new Error('timeout')),ms);s.onload=()=>{clearTimeout(t);res()};s.onerror=()=>{clearTimeout(t);rej(new Error('load'))};document.head.appendChild(s)})}
async function initKakao(){kakaoReady=false;const key=CONFIG.KAKAO_JS_KEY||S.settings.kakaoKey;if(!key)return;
 try{if(!window.kakao?.maps?.Map){await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`);await new Promise((r,j)=>{if(!window.kakao?.maps)return j();kakao.maps.load(r)})}kakaoReady=true}catch(e){kakaoReady=false}
 if(ui.view==='map')mapMounted=false}
async function initPostcode(){for(const src of ['https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js','https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js']){try{await loadScript(src,5000);if(PostcodeCls()){postcodeReady=true;return}}catch(e){}}postcodeReady=false}

/* ============ 시작 ============ */
let externalStarted=false;
function startExternal(){if(externalStarted)return;externalStarted=true;
 Promise.allSettled([initKakao(),initPostcode(),initKakaoSdk()]).then(()=>{if(!S)return;if(kakaoReady){mapMounted=false;render()}else if(cur())renderNav()})}
async function boot(){$('#main').innerHTML='<div class="empty" style="margin-top:20vh">불러오는 중…</div>';
 try{const me=await api('GET','/api/me');if(me?.user){await loadState();ui.view=can('myday','view')?'today':'dash';render();startExternal();return}}
 catch(e){if(e.status!==401){$('#main').innerHTML=`<div class="lock" style="margin-top:20vh"><b>서버에 연결하지 못했습니다</b><span>${esc(e.message)}</span><button class="btn" onclick="location.reload()">다시 시도</button></div>`;return}}
 S=null;render();initPostcode()}
boot();

