import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {CircleAlert, LoaderCircle, RefreshCw, Settings2, X} from 'lucide-react';
import {Assistant} from './components/Assistant';
import LotWorkspace from './components/LotWorkspace';
import OperationsHome from './components/OperationsHome';
import ResourceLibrary from './components/ResourceLibrary';
import WorkspaceShell,{type WorkspaceView} from './components/WorkspaceShell';
import {loadAllMetalRecords} from './operations';
import {request,type Document,type Row,type Workspace} from './types';

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();previous?.focus()}},[]);
 return <dialog ref={ref} className="modal" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><header><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={19}/></button></header><div className="modal-body">{children}</div></dialog>;
}
const validViews:WorkspaceView[]=['home','lots','assistant','library'];
function readRoute(hash:string):{view:WorkspaceView;lot:string|null}{
 const parts=hash.replace(/^#\/?/,'').split('/').filter(Boolean);
 if(!parts.length)return {view:'home',lot:null};
 const view=parts[0] as WorkspaceView;
 if(!validViews.includes(view))return {view:'home',lot:null};
 try{return {view,lot:parts[1]?decodeURIComponent(parts[1]):null}}catch{return {view,lot:null}}
}
export default function App(){
 const [route,setRoute]=useState(()=>readRoute(window.location.hash));
 const [data,setData]=useState<Workspace|null>(null);
 const [documents,setDocuments]=useState<Document[]>([]);
 const [documentsError,setDocumentsError]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('kkt_access_token')||'');
 const [settings,setSettings]=useState(false);
 const [tokenDraft,setTokenDraft]=useState('');
 const [checking,setChecking]=useState(false);
 const [connectionMessage,setConnectionMessage]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [metalRecords,setMetalRecords]=useState<Row[]>([]);
 const [history,setHistory]=useState<string[]>([]);
 const [metalError,setMetalError]=useState('');
 const assistant=useRef<import('./components/Assistant').AssistantHandle>(null);
 const documentsEpoch=useRef(0);
 const metalEpoch=useRef(0);
 const contextLot=route.lot||'';

 useEffect(()=>{const update=()=>setRoute(readRoute(window.location.hash));window.addEventListener('hashchange',update);if(!window.location.hash)window.location.hash='#/home';return()=>window.removeEventListener('hashchange',update)},[]);
 const navigate=useCallback((view:WorkspaceView,lot:string|null=contextLot)=>{
  const suffix=lot?`/${encodeURIComponent(lot)}`:'';
  const target=`#/${view}${suffix}`;
  if(window.location.hash===target)setRoute(readRoute(target));else window.location.hash=target;
 },[contextLot]);
 const selectLot=useCallback((lot:string)=>navigate(route.view,lot||null),[navigate,route.view]);

 const reloadDocuments=useCallback(async(query='')=>{
  const epoch=++documentsEpoch.current;
  try{const result=await request<Document[]>(`/documents${query?`?q=${encodeURIComponent(query)}`:''}`);if(epoch===documentsEpoch.current){setDocuments(result);setDocumentsError('')}}
  catch(reason){if(epoch===documentsEpoch.current)setDocumentsError((reason as Error).message)}
 },[]);
 const reloadMetal=useCallback(async()=>{
  const epoch=++metalEpoch.current;setMetalError('');
  try{const result=await loadAllMetalRecords();if(epoch===metalEpoch.current){setMetalRecords(result);setMetalError('')}}
  catch(reason){if(epoch===metalEpoch.current){setMetalRecords([]);setMetalError((reason as Error).message)}}
 },[]);
 const load=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);else setRefreshing(true);
  setError('');
  try{
   const workspace=await request<Workspace>('/workspace');
   setData(workspace);setLoading(false);
   await Promise.all([reloadDocuments(),reloadMetal()]);
  }catch(reason){setError((reason as Error).message);if(initial)setLoading(false)}
  finally{setRefreshing(false)}
 },[reloadDocuments,reloadMetal]);
 useEffect(()=>{void load(true)},[load]);
 const reloadTable=useCallback((table:string,page:number)=>request<Row[]>(`/tables/${encodeURIComponent(table)}?limit=20&offset=${page*20}`),[]);

 async function checkConnection(){
  setChecking(true);setConnectionMessage('');
  try{const result=await request<{message:string}>('/connection',{headers:tokenDraft.trim()?{Authorization:'Bearer '+tokenDraft.trim()}: {}});setToken(tokenDraft.trim());sessionStorage.setItem('kkt_access_token',tokenDraft.trim());setConnectionMessage(result.message);await load(false)}
  catch(reason){setConnectionMessage((reason as Error).message)}finally{setChecking(false)}
 }
 if(loading)return <div className="state-page"><LoaderCircle className="spin"/><h1>평창꽃순이김치 기록을 준비하고 있습니다.</h1></div>;
 if(error&&!data)return <div className="state-page" role="alert"><CircleAlert/><h1>기록을 불러오지 못했습니다.</h1><p>{error}</p><button className="primary-button" onClick={()=>void load(true)}>다시 연결</button></div>;
 if(!data)return null;

 const contextQuestion=(question:string,lot=contextLot)=>{navigate('assistant',lot);window.setTimeout(()=>assistant.current?.ask(question,lot),0)};
 let content:ReactNode;
 if(route.view==='home')content=<OperationsHome data={data} metalRecords={metalRecords} metalError={metalError} onOpenLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot??contextLot)}/>;
 else if(route.view==='lots')content=<LotWorkspace lots={data.lots} selectedLot={route.lot} onSelectLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot)}/>;
 else if(route.view==='assistant')content=<div className="assistant-mobile-heading"><div><p className="eyebrow">근거형 제조 도우미</p><h1>LOT와 기록을 질문하세요</h1><p>이 화면에서 질문하고 근거를 확인합니다.</p></div><button className="assistant-home-button" onClick={()=>navigate('home')} aria-label="현장 홈으로 돌아가기"><X size={19}/></button></div>;
 else content=<ResourceLibrary documents={documents} documentError={documentsError} tables={data.tables} onDocumentsReload={reloadDocuments} onRows={reloadTable}/>;
 return <WorkspaceShell view={route.view} selectedLot={contextLot||null} data={data} headerActions={<><button className="workspace-action" disabled={refreshing} aria-label="기록 새로고침" onClick={()=>void load(false)}><RefreshCw size={18}/><span>{refreshing?'조회 중':'새로고침'}</span></button><button className="workspace-action" onClick={()=>{setTokenDraft(token);setSettings(true)}}><Settings2 size={18}/><span>연결 설정</span></button></>} assistant={<Assistant ref={assistant} data={data} token={token} user={null} lot={contextLot} onLot={selectLot} onSettings={()=>{setTokenDraft(token);setSettings(true)}} onSave={()=>setSettings(true)} work={null} open={false} mobileActive={route.view==='assistant'} recommendations={data.questions['공정데이터']||[]} history={history} onQuestion={question=>setHistory(previous=>[question,...previous.filter(item=>item!==question)].slice(0,20))} onClose={()=>navigate('home')}/>} onNavigate={view=>navigate(view)}>{content}
  {error&&<div className="inline-error" role="alert"><CircleAlert size={17}/><span>기록 새로고침에 실패했습니다: {error}</span><button onClick={()=>void load(false)}>다시 불러오기</button></div>}
  {metalError&&<p className="sample-note" role="status">금속검출 기록은 조회하지 못했습니다. 확인 대상에 0건으로 표시하지 않습니다.</p>}
  {settings&&<Modal title="AI 연결 설정" onClose={()=>setSettings(false)}><p className="settings-copy">로컬에서는 서버의 AI 연결을 바로 사용합니다. 외부 접속은 관리자가 발급한 접근 코드가 필요합니다.</p><p role="status">{connectionMessage||(data.meta.ai_configured?'서버 AI 설정이 있습니다. 연결 권한을 확인하세요.':'서버 API 키가 미설정이거나 외부 접근 코드가 구성되지 않았습니다. 관리자 설정 후 다시 확인하세요.')}</p><label className="form-label">AI 접근 코드<input type="password" autoComplete="off" value={tokenDraft} onChange={event=>setTokenDraft(event.target.value)}/></label><div className="modal-actions"><button className="secondary-button" onClick={()=>setSettings(false)}>닫기</button><button className="secondary-button" onClick={()=>{setToken('');setTokenDraft('');sessionStorage.removeItem('kkt_access_token');setConnectionMessage('저장된 접근 코드를 지웠습니다.')}}>접근 코드 지우기</button><button className="primary-button" disabled={checking} onClick={()=>void checkConnection()}>{checking?'확인 중…':'연결 확인·적용'}</button></div></Modal>}
 </WorkspaceShell>;
}
