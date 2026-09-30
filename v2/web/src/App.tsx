import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {BookOpen, ChevronRight, CircleAlert, Database, FileText, LoaderCircle, RefreshCw, Search, Settings2, Table2, X} from 'lucide-react';
import {Assistant} from './components/Assistant';
import LotWorkspace from './components/LotWorkspace';
import OperationsHome from './components/OperationsHome';
import WorkspaceShell,{type WorkspaceView} from './components/WorkspaceShell';
import {loadAllMetalRecords} from './operations';
import {request,type Detail,type Document,type Row,type Workspace} from './types';

type LibraryTab='knowledge'|'data';
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();return()=>dialog.close()},[]);
 return <dialog ref={ref} className="modal" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><header><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={19}/></button></header><div className="modal-body">{children}</div></dialog>;
}
const cleanDocumentName=(filename:string)=>filename.replace(/^KKT-KB-\d+_/, '').replace(/\.md$/, '').replaceAll('_',' ');
const validViews:WorkspaceView[]=['home','lots','assistant','library'];
function readRoute(hash:string):{view:WorkspaceView;lot:string|null}{
 const parts=hash.replace(/^#\/?/,'').split('/').filter(Boolean);
 if(!parts.length)return {view:'home',lot:null};
 const view=parts[0] as WorkspaceView;
 if(!validViews.includes(view))return {view:'home',lot:null};
 try{return {view,lot:parts[1]?decodeURIComponent(parts[1]):null}}catch{return {view,lot:null}}
}
function PageIntro({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}){return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>}

export default function App(){
 const [route,setRoute]=useState(()=>readRoute(window.location.hash));
 const [data,setData]=useState<Workspace|null>(null);
 const [documents,setDocuments]=useState<Document[]>([]);
 const [rows,setRows]=useState<Row[]>([]);
 const [selectedRecord,setSelectedRecord]=useState<Row|null>(null);
 const [selectedDocument,setSelectedDocument]=useState<Document|null>(null);
 const [selectedTable,setSelectedTable]=useState('lots');
 const [libraryTab,setLibraryTab]=useState<LibraryTab>('knowledge');
 const [search,setSearch]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('kkt_access_token')||'');
 const [settings,setSettings]=useState(false);
 const [tokenDraft,setTokenDraft]=useState('');
 const [checking,setChecking]=useState(false);
 const [connectionMessage,setConnectionMessage]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [metalRecords,setMetalRecords]=useState<Row[]>([]);
 const [metalError,setMetalError]=useState('');
 const assistant=useRef<import('./components/Assistant').AssistantHandle>(null);
 const contextLot=route.lot||'';

 useEffect(()=>{const update=()=>setRoute(readRoute(window.location.hash));window.addEventListener('hashchange',update);if(!window.location.hash)window.location.hash='#/home';return()=>window.removeEventListener('hashchange',update)},[]);
 const navigate=useCallback((view:WorkspaceView,lot:string|null=contextLot)=>{
  const suffix=lot?`/${encodeURIComponent(lot)}`:'';
  const target=`#/${view}${suffix}`;
  if(window.location.hash===target)setRoute(readRoute(target));else window.location.hash=target;
 },[contextLot]);
 const selectLot=useCallback((lot:string)=>navigate(route.view,lot||null),[navigate,route.view]);

 const load=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);else setRefreshing(true);
  setError('');
  try{
   const [workspace,docs]=await Promise.all([request<Workspace>('/workspace'),request<Document[]>('/documents')]);
   setData(workspace);setDocuments(docs);setLoading(false);
   try{setMetalRecords(await loadAllMetalRecords());setMetalError('')}catch(reason){setMetalError((reason as Error).message)}
  }catch(reason){setError((reason as Error).message);if(initial)setLoading(false)}
  finally{setRefreshing(false)}
 },[]);
 useEffect(()=>{void load(true)},[load]);
 useEffect(()=>{
  if(!data||libraryTab!=='data')return;
  let active=true;
  request<Row[]>(`/tables/${selectedTable}?limit=20&offset=0`).then(result=>{if(active)setRows(result)}).catch(reason=>{if(active)setError((reason as Error).message)});
  return()=>{active=false};
 },[data,selectedTable,libraryTab]);

 async function checkConnection(){
  setChecking(true);setConnectionMessage('');
  try{const result=await request<{message:string}>('/connection',{headers:tokenDraft.trim()?{Authorization:'Bearer '+tokenDraft.trim()}: {}});setToken(tokenDraft.trim());sessionStorage.setItem('kkt_access_token',tokenDraft.trim());setConnectionMessage(result.message);await load(false)}
  catch(reason){setConnectionMessage((reason as Error).message)}finally{setChecking(false)}
 }
 if(loading)return <div className="state-page"><LoaderCircle className="spin"/><h1>평창꽃순이김치 기록을 준비하고 있습니다.</h1></div>;
 if(error&&!data)return <div className="state-page" role="alert"><CircleAlert/><h1>기록을 불러오지 못했습니다.</h1><p>{error}</p><button className="primary-button" onClick={()=>void load(true)}>다시 연결</button></div>;
 if(!data)return null;

 const filteredDocuments=documents.filter(document=>`${document.filename} ${document.content}`.toLowerCase().includes(search.toLowerCase()));
 const activeTable=data.tables.find(table=>table.table===selectedTable);
 const contextQuestion=(question:string,lot=contextLot)=>{navigate('assistant',lot);window.setTimeout(()=>assistant.current?.ask(question,lot),0)};
 let content:ReactNode;
 if(route.view==='home')content=<OperationsHome data={data} metalRecords={metalRecords} metalError={metalError} onOpenLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot??contextLot)}/>;
 else if(route.view==='lots')content=<LotWorkspace lots={data.lots} selectedLot={route.lot} onSelectLot={lot=>navigate('lots',lot||null)} onAsk={(question,lot)=>contextQuestion(question,lot)}/>;
 else if(route.view==='assistant')content=<div className="assistant-mobile-heading"><div><p className="eyebrow">근거형 제조 도우미</p><h1>LOT와 기록을 질문하세요</h1><p>이 화면에서 질문하고 근거를 확인합니다.</p></div><button className="assistant-home-button" onClick={()=>navigate('home')} aria-label="현장 홈으로 돌아가기"><X size={19}/></button></div>;
 else content=<div className="workspace-page"><PageIntro eyebrow="문서 · 원본 기록" title="제조 자료" description="문서 상태와 기록 원문을 조회합니다."/>
  <div className="library-tabs" role="tablist"><button role="tab" aria-selected={libraryTab==='knowledge'} className={libraryTab==='knowledge'?'active':''} onClick={()=>setLibraryTab('knowledge')}><BookOpen size={17}/>지식베이스</button><button role="tab" aria-selected={libraryTab==='data'} className={libraryTab==='data'?'active':''} onClick={()=>setLibraryTab('data')}><Database size={17}/>데이터허브</button></div>
  {libraryTab==='knowledge'?<><label className="side-search"><Search size={16}/><span className="sr-only">문서 검색</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="문서명 또는 공정 검색"/></label><p className="source-note">샘플 지식베이스 {documents.length}개 · 미승인 예시</p><div className="document-list">{filteredDocuments.map(document=><button key={document.document_id} onClick={()=>setSelectedDocument(document)}><FileText size={18}/><span><strong>{document.title||cleanDocumentName(document.filename)}</strong><small>{document.source} / {document.status}</small></span><ChevronRight size={16}/></button>)}</div>{!filteredDocuments.length&&<p className="empty-note">등록된 문서가 없습니다.</p>}</>:<><label className="table-picker">조회할 데이터<select value={selectedTable} onChange={event=>setSelectedTable(event.target.value)}>{data.tables.map(table=><option key={table.table} value={table.table}>{table.label} ({table.count})</option>)}</select></label><p className="source-note">{data.meta.backend} · 샘플 데이터 조회 전용</p><div className="data-preview"><div><Table2 size={18}/><strong>{activeTable?.label}</strong><span>{activeTable?.count??0}건</span></div>{rows.slice(0,20).map((row,index)=><button key={index} onClick={()=>setSelectedRecord(row)}><span>{String(row.lot_id??row.item_name??row.name??row.order_no??row.shipment_no??row.equipment_id??`기록 ${index+1}`)}</span><ChevronRight size={15}/></button>)}</div></>}
 </div>;
 return <WorkspaceShell view={route.view} selectedLot={contextLot||null} data={data} headerActions={<><button className="workspace-action" disabled={refreshing} aria-label="기록 새로고침" onClick={()=>void load(false)}><RefreshCw size={18}/><span>{refreshing?'조회 중':'새로고침'}</span></button><button className="workspace-action" onClick={()=>{setTokenDraft(token);setSettings(true)}}><Settings2 size={18}/><span>연결 설정</span></button></>} assistant={<Assistant ref={assistant} data={data} token={token} user={null} lot={contextLot} onLot={selectLot} onSettings={()=>{setTokenDraft(token);setSettings(true)}} onSave={()=>setSettings(true)} work={null} open={false} onClose={()=>navigate('home')}/>} onNavigate={view=>navigate(view)}>{content}
  {error&&<div className="inline-error" role="alert"><CircleAlert size={17}/><span>화면 자료를 불러오지 못했습니다: {error}</span><button onClick={()=>{setError('');void load(false)}}>다시 불러오기</button></div>}
  {metalError&&<p className="sample-note" role="status">금속검출 기록은 조회하지 못했습니다. 확인 대상에 0건으로 표시하지 않습니다.</p>}
  {selectedRecord&&<Modal title="원본 데이터 기록" onClose={()=>setSelectedRecord(null)}><pre className="document-content">{JSON.stringify(selectedRecord,null,2)}</pre></Modal>}
  {selectedDocument&&<Modal title={selectedDocument.title||cleanDocumentName(selectedDocument.filename)} onClose={()=>setSelectedDocument(null)}><div className="document-meta"><code>{selectedDocument.document_id}</code><span>{selectedDocument.status}</span></div><pre className="document-content">{selectedDocument.content}</pre></Modal>}
  {settings&&<Modal title="AI 연결 설정" onClose={()=>setSettings(false)}><p className="settings-copy">로컬에서는 서버의 AI 연결을 바로 사용합니다. 외부 접속은 관리자가 발급한 접근 코드가 필요합니다.</p><p role="status">{connectionMessage||(data.meta.ai_configured?'서버 AI 설정이 있습니다. 연결 권한을 확인하세요.':'서버 API 키가 미설정이거나 외부 접근 코드가 구성되지 않았습니다. 관리자 설정 후 다시 확인하세요.')}</p><label className="form-label">AI 접근 코드<input type="password" autoComplete="off" value={tokenDraft} onChange={event=>setTokenDraft(event.target.value)}/></label><div className="modal-actions"><button className="secondary-button" onClick={()=>setSettings(false)}>닫기</button><button className="secondary-button" onClick={()=>{setToken('');setTokenDraft('');sessionStorage.removeItem('kkt_access_token');setConnectionMessage('저장된 접근 코드를 지웠습니다.')}}>접근 코드 지우기</button><button className="primary-button" disabled={checking} onClick={()=>void checkConnection()}>{checking?'확인 중…':'연결 확인·적용'}</button></div></Modal>}
 </WorkspaceShell>;
}
