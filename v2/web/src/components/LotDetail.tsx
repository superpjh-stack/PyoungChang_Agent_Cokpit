import {useMemo} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronRight,CircleHelp,GitBranch,MessageCircle} from 'lucide-react';
import type {Detail,Row} from '../types';
import EvidenceRecord from './EvidenceRecord';

type Props={detail:Detail;onAsk:(question:string,lotId:string)=>void;onBack:()=>void};
const steps=[{name:'원재료 입고·보관',matches:['원재료 입고']},{name:'세척',matches:['세척']},{name:'절임·탈수',matches:['절임']},{name:'양념·혼합',matches:['혼합','양념']},{name:'충진',matches:['충진']},{name:'금속검출·포장',matches:['금속검출','포장']}];
const text=(record:Row,...keys:string[])=>{for(const key of keys){const value=record[key];if(value!==undefined&&value!==null&&value!=='')return String(value)}return '미확인'};
function RecordList({title,rows,kind,emptyNote}:{title:string;rows:Row[];kind:'ccp'|'metal'|'movement'|'shipment';emptyNote:string}){
 return <section className="lot-evidence-group"><header><h3>{title}</h3><span>{rows.length}건</span></header>{rows.length?<div className="lot-evidence-list">{rows.map((record,index)=><EvidenceRecord key={`${text(record,'lot_id','shipment_no','check_id','inspection_id','movement_id')}-${index}`} record={record} kind={kind}/>)}</div>:<p className="lot-no-record"><CircleHelp size={16}/>{emptyNote}</p>}</section>;
}

export default function LotDetail({detail,onAsk,onBack}:Props){
 const {lot}=detail;
 const chain=detail.trace?.length?detail.trace:[lot];
 const staged=useMemo(()=>new Map(steps.map(step=>[step.name,chain.filter(record=>step.matches.some(match=>record.process.includes(match)))])),[chain]);
 const extras=chain.filter(record=>!steps.some(step=>step.matches.some(match=>record.process.includes(match))));
 return <div className="workspace-page lot-detail">
  <button className="back-button" onClick={onBack}><ArrowLeft size={18}/>LOT 목록</button>
  <header className="lot-detail-heading"><div><p className="eyebrow">공정 계보 · 샘플 원본</p><h1>{lot.lot_id}</h1><p>{lot.product_name} · {lot.process}</p></div><span className={lot.status==='완료'?'lot-status':'lot-status lot-status-review'}>{lot.status||'상태 미확인'}</span></header>
  <div className="lot-facts"><div><span>제품</span><strong>{lot.product_name||'미확인'}</strong></div><div><span>공정</span><strong>{lot.process||'미확인'}</strong></div><div><span>기록 수량</span><strong>{lot.quantity_kg??'미확인'} kg</strong></div><div><span>기록시각</span><strong>{lot.created_at||'미확인'}</strong></div></div>
  <section className="lineage-section"><header><div><p className="eyebrow">LOT 계보</p><h2>연결된 공정 기록</h2></div><GitBranch size={20}/></header>
   <ol className="lineage-list">{steps.map(step=>{const records=staged.get(step.name)??[];return <li key={step.name} className={records.length?'lineage-present':'lineage-missing'}><span className="lineage-icon" aria-hidden="true">{records.length?<Check size={15}/>:<CircleHelp size={15}/>}</span><div className="lineage-copy"><strong>{step.name}</strong>{records.length?records.map(record=>record.lot_id===lot.lot_id?<span className="lineage-link" key={record.lot_id}>{record.lot_id} · {record.status||'판정 미확인'}</span>:<button className="lineage-link" key={record.lot_id} onClick={()=>onAsk(`${record.lot_id} 기록을 확인해줘`,record.lot_id)}>{record.lot_id} · {record.status||'판정 미확인'}<ArrowRight size={13}/></button>):<small>연결된 LOT 기록이 없습니다 · 미확인</small>}</div></li>})}</ol>
   {extras.length>0&&<div className="lineage-extras"><h3>추가 연결 기록</h3>{extras.map(record=><p key={record.lot_id}>{record.lot_id} · {record.process} · {record.status||'미확인'}</p>)}</div>}
  </section>
  <section className="lot-question-callout"><div><MessageCircle size={19}/><span><strong>이 LOT의 근거를 확인하세요</strong><small>질문은 전송 전에 검토할 수 있습니다.</small></span></div><button onClick={()=>onAsk(`공정 계보와 연결된 세척 CCP, 금속검출, PDA 이동, 출하 기록을 확인해줘`,lot.lot_id)}>이 LOT에 질문 <ArrowRight size={16}/></button></section>
  <section className="lot-records-section"><header><p className="eyebrow">원본 기록</p><h2>연결 공정별 자료</h2></header>
   <div className="lot-evidence-grid"><RecordList title="세척 CCP" kind="ccp" rows={detail.ccp??[]} emptyNote="연결된 세척 CCP 기록을 찾을 수 없습니다 · 미확인"/><RecordList title="금속검출" kind="metal" rows={detail.metal??[]} emptyNote="연결된 금속검출 기록을 찾을 수 없습니다 · 미확인"/><RecordList title="PDA 이동" kind="movement" rows={detail.movements??[]} emptyNote="연결된 PDA 이동 기록을 찾을 수 없습니다 · 미확인"/><RecordList title="출하" kind="shipment" rows={detail.shipments??[]} emptyNote="연결된 출하 기록을 찾을 수 없습니다 · 미확인"/></div>
  </section>
 </div>;
}
