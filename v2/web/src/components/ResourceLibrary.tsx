import {useEffect,useRef,useState,type ReactNode} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,CircleAlert,Database,FileText,LoaderCircle,Search,Table2,X} from 'lucide-react';
import type {Document,Row,TableInfo} from '../types';
import EvidenceRecord,{inferRecordKind} from './EvidenceRecord';

type Props={compact?:boolean;documents:Document[];documentError:string;tables:TableInfo[];onDocumentsReload:(query:string)=>Promise<void>;onRows:(table:string,page:number)=>Promise<Row[]>};
type Tab='knowledge'|'data';
function ResourceDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();previous?.focus()}},[]);
 return <dialog ref={ref} className="modal" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><header><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={19}/></button></header><div className="modal-body">{children}</div></dialog>;
}
const displayKey=(record:Row,index:number)=>String(record.dispatch_id??record.plan_id??record.lot_id??record.item_name??record.name??record.order_no??record.shipment_no??record.equipment_id??record.document_id??`기록 ${index+1}`);
const cleanDocumentName=(filename:string)=>filename.replace(/^KKT-KB-\d+_/, '').replace(/\.md$/, '').replaceAll('_',' ');

export default function ResourceLibrary({compact=false,documents,documentError,tables,onDocumentsReload,onRows}:Props){
 const [tab,setTab]=useState<Tab>('knowledge');
 const [query,setQuery]=useState('');
 const [table,setTable]=useState('daily_inventory');
 const [page,setPage]=useState(0);
 const [rows,setRows]=useState<Row[]>([]);
 const [rowError,setRowError]=useState('');
 const [rowLoading,setRowLoading]=useState(false);
 const [retryKey,setRetryKey]=useState(0);
 const [selectedDocument,setSelectedDocument]=useState<Document|null>(null);
 const [selectedRecord,setSelectedRecord]=useState<Row|null>(null);
 const requestEpoch=useRef(0);
 const filteredDocuments=documents.filter(item=>`${item.title??''} ${item.filename} ${item.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const tableInfo=tables.find(item=>item.table===table);
 const pageCount=tableInfo?Math.ceil(tableInfo.count/20):0;

 useEffect(()=>{
  if(tab!=='knowledge')return;
  const timer=window.setTimeout(()=>{void onDocumentsReload(query.trim())},240);
  return()=>window.clearTimeout(timer);
 },[onDocumentsReload,query,tab]);
 useEffect(()=>{
  if(tab!=='data')return;
  const controller=new AbortController();const generation=++requestEpoch.current;
  setRows([]);setRowError('');setRowLoading(true);
  onRows(table,page).then(result=>{if(!controller.signal.aborted&&generation===requestEpoch.current)setRows(result)}).catch(reason=>{if(!controller.signal.aborted&&generation===requestEpoch.current)setRowError((reason as Error).message)}).finally(()=>{if(!controller.signal.aborted&&generation===requestEpoch.current)setRowLoading(false)});
  return()=>controller.abort();
 },[onRows,page,retryKey,tab,table]);

 return <div className="workspace-page resource-library">
  <header className="page-heading"><div><p className="eyebrow">문서 · 원본 기록</p><h1>{compact?'업무 자료':'제조 자료'}</h1><p>문서의 상태와 원본 제조 데이터를 조회합니다.</p></div></header>
  <div className="library-tabs" role="tablist" aria-label="자료 종류"><button role="tab" id="tab-knowledge" aria-controls="panel-knowledge" aria-selected={tab==='knowledge'} className={tab==='knowledge'?'active':''} onClick={()=>setTab('knowledge')}><BookOpen size={17}/>지식베이스</button><button role="tab" id="tab-data" aria-controls="panel-data" aria-selected={tab==='data'} className={tab==='data'?'active':''} onClick={()=>setTab('data')}><Database size={17}/>DB 데이터</button></div>
  {tab==='knowledge'?<section id="panel-knowledge" role="tabpanel" aria-labelledby="tab-knowledge" className="resource-panel">
   <label className="resource-search"><Search size={17}/><span className="sr-only">문서 이름 또는 본문 검색</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="문서명 또는 공정 검색"/></label>
   <p className="source-note">샘플 지식베이스 {documents.length}개 · 문서 상태를 확인해 사용하세요.</p>
   {documentError&&<div className="resource-error" role="alert"><CircleAlert size={17}/><span>{documentError}</span><button onClick={()=>void onDocumentsReload(query.trim())}>다시 불러오기</button></div>}
   {filteredDocuments.length?<div className="resource-document-list">{filteredDocuments.map(document=><button key={document.document_id} onClick={()=>setSelectedDocument(document)}><FileText size={18}/><span><strong>{document.title||cleanDocumentName(document.filename)}</strong><small>{document.owner||'담당 미확인'} · 개정 {document.revision||'미확인'} · {document.status||'상태 미확인'}</small></span><ChevronRight size={16}/></button>)}</div>:!documentError?<p className="attention-empty">검색한 문서를 찾을 수 없습니다.</p>:null}
  </section>:<section id="panel-data" role="tabpanel" aria-labelledby="tab-data" className="resource-panel">
   <label className="table-picker">조회할 데이터<select value={table} onChange={event=>{setTable(event.target.value);setPage(0)}}>{tables.map(item=><option key={item.table} value={item.table}>{item.label} ({item.count})</option>)}</select></label>
   <p className="source-note">데모 데이터 조회 전용 · 페이지당 20건 · 결과 원본 그대로 표시</p>
   <div className="table-page-summary"><span><Table2 size={16}/>{tableInfo?.label||'데이터'} · 전체 {tableInfo?.count??'미확인'}건</span><span>{rows.length?`${page*20+1}–${page*20+rows.length}건`:'현재 페이지 0건'} · {pageCount?`${page+1}/${pageCount}페이지`:'0페이지'}</span></div>
   {rowError?<div className="resource-error" role="alert"><CircleAlert size={17}/><span>{rowError}</span><button onClick={()=>setRetryKey(value=>value+1)}>재시도</button></div>:rowLoading?<div className="resource-loading" role="status"><LoaderCircle className="spin" size={19}/>기록을 불러옵니다.</div>:rows.length?<div className="resource-record-list">{rows.map((record,index)=><button key={`${displayKey(record,index)}-${index}`} onClick={()=>setSelectedRecord(record)}><span><strong>{displayKey(record,index)}</strong><small>{String(record.process??record.product_name??record.item_type??record.status??'원본 기록')}</small></span><ChevronRight size={16}/></button>)}</div>:<p className="attention-empty">이 페이지에서 조회한 샘플 기록이 없습니다.</p>}
   <nav className="resource-pagination" aria-label="기록 페이지"><button disabled={page===0||rowLoading} onClick={()=>setPage(value=>Math.max(0,value-1))}><ChevronLeft size={17}/>이전</button><span>{pageCount?`${page+1} / ${pageCount}페이지`:'기록 없음'}</span><button disabled={rowLoading||!tableInfo||page+1>=pageCount} onClick={()=>setPage(value=>value+1)}>다음<ChevronRight size={17}/></button></nav>
  </section>}
  {selectedDocument&&<ResourceDialog title={selectedDocument.title||cleanDocumentName(selectedDocument.filename)} onClose={()=>setSelectedDocument(null)}><div className="document-meta"><code>{selectedDocument.document_id}</code><span>{selectedDocument.status||'상태 미확인'}</span></div><div className="evidence-document-meta"><span>개정 {selectedDocument.revision||'미확인'}</span><span>담당 {selectedDocument.owner||'미확인'}</span><span>출처 {selectedDocument.source||'미확인'}</span></div><pre className="document-content">{selectedDocument.content}</pre></ResourceDialog>}
  {selectedRecord&&<ResourceDialog title="원본 데이터 기록" onClose={()=>setSelectedRecord(null)}><EvidenceRecord record={selectedRecord} kind={inferRecordKind(selectedRecord)}/></ResourceDialog>}
 </div>;
}
