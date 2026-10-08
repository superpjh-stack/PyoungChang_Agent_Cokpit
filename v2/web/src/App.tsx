import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {CircleAlert, LoaderCircle, RefreshCw, Settings2, X} from 'lucide-react';
import ConnectionSetup from './components/ConnectionSetup';
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
 if(!parts.length)return {view:'assistant',lot:null};
 const view=parts[0] as WorkspaceView;
 if(!validViews.includes(view))return {view:'assistant',lot:null};
 try{return {view,lot:parts[1]?decodeURIComponent(parts[1]):null}}catch{return {view,lot:null}}
}
export default function App(){
 const [route,setRoute]=useState(()=>readRoute(window.location.hash));
 const [data,setData]=useState<Workspace|null>(null);
 const [documents,setDocuments]=useState<Document[]>([]);
 const [documentsError,setDocumentsError]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('kkt_access_token')||'');
 const [settings,setSettings]=useState(false);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [metalRecords,setMetalRecords]=useState<Row[]>([]);
 const [history,setHistory]=useState<string[]>(()=>{try{const saved=JSON.parse(sessionStorage.getItem('kkt_question_history')||'[]');return Array.isArray(saved)?saved.filter((item):item is string=>typeof item==='string').slice(0,20):[]}catch{return []}});
 useEffect(()=>{sessionStorage.setItem('kkt_question_history',JSON.stringify(history))},[history]);
 const [metalError,setMetalError]=useState('');
 const assistant=useRef<import('./components/Assistant').AssistantHandle>(null);
 const documentsEpoch=useRef(0);
 const metalEpoch=useRef(0);
 const contextLot=route.lot||'';
 const [queuedQuestion,setQueuedQuestion]=useState<{question:string;lot:string}|null>(null);
 useEffect(()=>{
  if(!queuedQuestion||!data||route.view!=='assistant'||contextLot!==queuedQuestion.lot)return;
  assistant.current?.ask(queuedQuestion.question,queuedQuestion.lot);
  setQueuedQuestion(null);
 },[queuedQuestion,data,route.view,contextLot]);
 const contextQuestion=(question:string,lot=contextLot)=>{
  navigate('assistant',lot||null);
  setQueuedQuestion({question,lot});
 };

 useEffect(()=>{const update=()=>setRoute(readRoute(window.location.hash));window.addEventListener('hashchange',update);if(!window.location.hash)window.location.hash='#/assistant';return()=>window.removeEventListener('hashchange',update)},[]);
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

 if(loading)return <div className="state-page"><LoaderCircle className="spin"/><h1>평창꽃순이김치 기록을 준비하고 있습니다.</h1></div>;
 if(error&&!data)return <div className="state-page" role="alert"><CircleAlert/><h1>기록을 불러오지 못했습니다.</h1><p>{error}</p><button className="primary-button" onClick={()=>void load(true)}>다시 연결</button></div>;
 if(!data)return null;

 let content:ReactNode;
 if(route.view==='home')content=<OperationsHome data={data} metalRecords={metalRecords} metalError={metalError} onOpenLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot??contextLot)}/>;
 else if(route.view==='lots')content=<LotWorkspace lots={data.lots} selectedLot={route.lot} onSelectLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot)}/>;
 else if(route.view==='assistant')content=<div className="assistant-mobile-heading"><div><p className="eyebrow">근거형 제조 도우미</p><h1>LOT와 기록을 질문하세요</h1><p>이 화면에서 질문하고 근거를 확인합니다.</p></div><button className="assistant-home-button" onClick={()=>navigate('home')} aria-label="현장 홈으로 돌아가기"><X size={19}/></button></div>;
 else content=<ResourceLibrary documents={documents} documentError={documentsError} tables={data.tables} onDocumentsReload={reloadDocuments} onRows={reloadTable}/>;
 return <WorkspaceShell history={history} onAsk={question=>contextQuestion(question,'')} onNewChat={()=>assistant.current?.reset()} resources={<ResourceLibrary compact documents={documents} documentError={documentsError} tables={data.tables} onDocumentsReload={reloadDocuments} onRows={reloadTable}/>} view={route.view} selectedLot={contextLot||null} data={data} headerActions={<><button className="workspace-action" disabled={refreshing} aria-label="기록 새로고침" onClick={()=>void load(false)}><RefreshCw size={18}/><span>{refreshing?'조회 중':'새로고침'}</span></button><button className="workspace-action" aria-label="연결 설정" onClick={()=>{setSettings(true)}}><Settings2 size={18}/><span>연결 설정</span></button></>} assistant={<Assistant ref={assistant} data={data} token={token} user={null} lot={contextLot} onLot={selectLot} onSettings={()=>{setSettings(true)}} onSave={()=>setSettings(true)} work={null} open={false} mobileActive={route.view==='assistant'} recommendations={data.questions['공정데이터']||[]} history={history} onQuestion={question=>setHistory(previous=>[question,...previous.filter(item=>item!==question)].slice(0,20))} onClose={()=>navigate('home')}/>} onNavigate={view=>navigate(view)}>{content}
  {error&&<div className="inline-error" role="alert"><CircleAlert size={17}/><span>기록 새로고침에 실패했습니다: {error}</span><button onClick={()=>void load(false)}>다시 불러오기</button></div>}
  {metalError&&<p className="sample-note" role="status">금속검출 기록은 조회하지 못했습니다. 확인 대상에 0건으로 표시하지 않습니다.</p>}
  {settings&&<Modal title="음성 · OpenAI 연결" onClose={()=>setSettings(false)}><ConnectionSetup data={data} token={token} onApply={async value=>{setToken(value);sessionStorage.setItem('kkt_access_token',value);await load(false)}} onClear={()=>{setToken('');sessionStorage.removeItem('kkt_access_token')}}/></Modal>}
 </WorkspaceShell>;
}
