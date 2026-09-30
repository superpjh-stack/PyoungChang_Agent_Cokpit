import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ChevronRight,CircleAlert,GitBranch,LoaderCircle,Search} from 'lucide-react';
import type {Detail,Lot} from '../types';
import LotDetail from './LotDetail';

type Props={lots:Lot[];selectedLot:string|null;onSelectLot:(lotId:string)=>void;onAsk:(question:string,lotId:string)=>void};
const statusOf=(value:string)=>value?.trim()||'미확인';

export default function LotWorkspace({lots,selectedLot,onSelectLot,onAsk}:Props){
 const [query,setQuery]=useState('');
 const [process,setProcess]=useState('all');
 const [status,setStatus]=useState('all');
 const [detail,setDetail]=useState<Detail|null>(null);
 const [detailLoading,setDetailLoading]=useState(false);
 const [detailError,setDetailError]=useState('');
 const processes=useMemo(()=>Array.from(new Set(lots.map(lot=>lot.process).filter(Boolean))).sort(),[lots]);
 const statuses=useMemo(()=>Array.from(new Set(lots.map(lot=>lot.status).filter(Boolean))).sort(),[lots]);
 const filtered=useMemo(()=>lots.filter(lot=>`${lot.lot_id} ${lot.product_name} ${lot.process}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(process==='all'||lot.process===process)&&(status==='all'||lot.status===status)),[lots,process,query,status]);

 useEffect(()=>{
  if(!selectedLot){setDetail(null);setDetailError('');setDetailLoading(false);return}
  const controller=new AbortController();setDetail(null);setDetailError('');setDetailLoading(true);
  fetch(`/api/lots/${encodeURIComponent(selectedLot)}`,{signal:controller.signal}).then(async response=>{if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.detail||`LOT 조회에 실패했습니다 (${response.status}).`)}return response.json() as Promise<Detail>}).then(result=>{if(!controller.signal.aborted)setDetail(result)}).catch(reason=>{if(!controller.signal.aborted)setDetailError((reason as Error).message)}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false)});
  return()=>controller.abort();
 },[selectedLot]);

 if(selectedLot){
  if(detailLoading)return <div className="workspace-page"><button className="back-button" onClick={()=>onSelectLot('')}><ArrowLeft size={18}/>목록으로</button><div className="lot-message"><LoaderCircle className="spin" size={20}/> {selectedLot} 기록을 불러옵니다.</div></div>;
  if(detailError||!detail)return <div className="workspace-page"><button className="back-button" onClick={()=>onSelectLot('')}><ArrowLeft size={18}/>목록으로</button><div className="lot-message lot-error" role="alert"><CircleAlert size={19}/><span>{detailError||'선택한 LOT를 찾을 수 없습니다.'}</span></div></div>;
  return <LotDetail detail={detail} onBack={()=>onSelectLot('')} onAsk={onAsk}/>;
 }

 return <div className="workspace-page lot-workspace">
  <header className="page-heading"><div><p className="eyebrow">공정 기록 탐색</p><h1>LOT 기록</h1><p>LOT 번호·제품·공정 또는 상태로 기록을 찾아보세요.</p></div></header>
  <div className="lot-filters">
   <label className="lot-search"><Search size={17}/><span className="sr-only">LOT 또는 제품 검색</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="LOT 번호, 제품 또는 공정"/></label>
   <label>공정<select value={process} onChange={event=>setProcess(event.target.value)}><option value="all">전체 공정</option>{processes.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   <label>상태<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">전체 상태</option>{statuses.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   {(query||process!=='all'||status!=='all')&&<button className="clear-filter" onClick={()=>{setQuery('');setProcess('all');setStatus('all')}}>조건 지우기</button>}
  </div>
  <p className="lot-result-count" aria-live="polite">{filtered.length}개 기록</p>
  {filtered.length?<div className="lot-list">{filtered.map(lot=><button className="lot-list-row" key={lot.lot_id} onClick={()=>onSelectLot(lot.lot_id)}>
   <span className="lot-process-icon"><GitBranch size={18}/></span><span className="lot-list-copy"><strong>{lot.lot_id}</strong><span>{lot.product_name} · {lot.process}</span><small>{lot.created_at||'기록시각 미확인'} · {lot.quantity_kg??'미확인'} kg</small></span><span className="lot-status">{statusOf(lot.status)}</span><ChevronRight size={19}/>
  </button>)}</div>:<p className="attention-empty">검색·필터에 일치하는 LOT 기록이 없습니다.</p>}
 </div>;
}
