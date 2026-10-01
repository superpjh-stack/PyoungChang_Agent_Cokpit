import {AlertTriangle, ArrowRight, CircleHelp, PackageSearch, Truck, Boxes, ShieldCheck} from 'lucide-react';
import {buildAttentionItems,type AttentionCategory} from '../operations';
import type {Row,Workspace} from '../types';

type Props={data:Workspace;metalRecords:Row[];metalError:string;onOpenLot:(lotId:string)=>void;onAsk:(question:string,lotId?:string)=>void};
const groups:{category:AttentionCategory;description:string}[]=[
 {category:'CCP 주의',description:'샘플 세척 기록에서 판정 확인이 필요한 항목'},
 {category:'금속검출 보류',description:'샘플 금속검출 기록에서 판정 확인이 필요한 항목'},
 {category:'출하 승인 대기',description:'품질 승인 기록을 다시 확인할 항목'},
 {category:'재고 부족',description:'샘플 안전재고보다 수량이 적은 품목'},
];
const tasks=[
 {title:'출하 확인',description:'품질 승인 상태와 배송 예정 기록을 확인해요.',question:'출하 승인 대기 기록과 배송 예정일을 확인해줘',Icon:Truck},
 {title:'재고 확인',description:'재고가 부족한 품목과 수량을 찾아요.',question:'재고 부족 품목과 현재 수량을 확인해줘',Icon:Boxes},
 {title:'품질 문의',description:'세척 검사와 금속검출 기록을 함께 살펴봐요.',question:'세척 CCP와 금속검출 보류 기록을 확인해줘',Icon:ShieldCheck},
];
const display=(record:Row,key:string,suffix='')=>{const value=record[key];return value===null||value===undefined||value===''?'미확인':`${String(value)}${suffix}`};

function AttentionRow({category,item,onOpenLot,onAsk}:{category:AttentionCategory;item:ReturnType<typeof buildAttentionItems>[number];onOpenLot:(lotId:string)=>void;onAsk:(question:string,lotId?:string)=>void}){
 const record=item.record as Row;
 const measure=category==='CCP 주의'?`${display(record,'peroxide_ppm','ppm')} · ${display(record,'water_l','L')} · ${display(record,'contact_min','분')}`:category==='금속검출 보류'?`불합격 ${display(record,'reject_count','건')} · ${display(record,'inspected_at')}`:category==='출하 승인 대기'?`품질 ${display(record,'quality_approval')} · ${display(record,'planned_at')}`:`재고 ${display(record,'quantity',String(record.unit||''))} · 안전재고 ${display(record,'safety_stock',String(record.unit||''))}`;
 return <article className="attention-row"><div className="attention-marker" aria-hidden="true"><AlertTriangle size={17}/></div><div className="attention-body"><div className="attention-title"><strong>{item.label}</strong><span className={item.status==='미확인'?'attention-status unknown':'attention-status'}>{item.status}</span></div><p>{measure}</p><div className="attention-actions">{item.lotId?<button onClick={()=>onOpenLot(item.lotId!)}>LOT 기록 보기 <ArrowRight size={14}/></button>:<button onClick={()=>onAsk(`${item.label}의 현재 재고 원본과 샘플 안전재고 근거를 확인해줘`)}>품목 원본 질문 <ArrowRight size={14}/></button>}{item.lotId&&<button onClick={()=>onAsk(`${item.lotId}의 ${category} 연결 기록과 근거를 확인해줘`,item.lotId||undefined)}>LOT에 질문 <ArrowRight size={14}/></button>}</div></div></article>;
}

export default function OperationsHome({data,metalRecords,metalError,onOpenLot,onAsk}:Props){
 const items=buildAttentionItems(data,metalRecords);
 return <div className="workspace-page operations-home">
  <header className="page-heading"><div><p className="eyebrow">현장 확인 목록 · 샘플 기록</p><h1>어떤 업무를 도와드릴까요?</h1><p>기록 기준일 {data.meta.as_of} · 조회 {new Date(data.meta.retrieved_at).toLocaleString('ko-KR')} · 실시간 설비 연결 아님</p></div><button className="home-lot-action" onClick={()=>onOpenLot('')}>생산 묶음 찾기 <ArrowRight size={16}/></button></header>
  <section className="task-start" aria-label="업무 바로 시작"><h2>원하는 업무부터 시작하세요</h2><p>업무를 누르면 전체 샘플 기록에서 관련 내용을 찾아드립니다.</p><div className="task-start-list">{tasks.map(({title,description,question,Icon})=><button key={title} onClick={()=>onAsk(question,'')}><Icon size={23}/><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={18}/></button>)}</div></section>
  <details className="plain-language-help"><summary>처음 사용하시나요? 용어와 이용 순서</summary><p>① 업무 선택 → ② 답변과 다음 할 일 확인 → ③ 근거 확인 후 복사·보고서 저장</p><dl><div><dt>LOT · 생산 묶음 번호</dt><dd>함께 생산·관리하는 제품 묶음을 구분하는 번호입니다.</dd></div><div><dt>CCP · 중요관리점</dt><dd>식품 안전을 위해 중점 확인하는 공정입니다.</dd></div><div><dt>PDA · 현장 휴대 단말기</dt><dd>원료나 제품의 입출고·이동을 기록하는 기기입니다.</dd></div></dl></details>
  <h2 className="records-heading">추가 확인이 필요한 기록</h2>
  <div className="operations-intro"><PackageSearch size={19}/><p>분류별 기록을 열어 원본과 LOT 연결을 확인하세요. 목록의 수는 분류별 기록 건수입니다.</p></div>
  <section className="attention-groups" aria-label="확인할 기록 분류">
   {groups.map(group=>{const categoryItems=items.filter(item=>item.category===group.category);const isMetal=group.category==='금속검출 보류';return <section className="attention-group" key={group.category} aria-labelledby={`group-${group.category}`}>
    <header><div><h2 id={`group-${group.category}`}>{group.category}</h2><p>{group.description}</p></div><span aria-label={`${categoryItems.length}개 기록`}>{isMetal&&metalError?'—':categoryItems.length}</span></header>
    {isMetal&&metalError?<p className="attention-empty" role="status"><CircleHelp size={16}/>기록을 불러오지 못했습니다. 0건으로 해석하지 않습니다.</p>:categoryItems.length?categoryItems.map(item=><AttentionRow key={item.key} item={item} category={group.category} onOpenLot={onOpenLot} onAsk={onAsk}/>):<p className="attention-empty"><CircleHelp size={16}/>일치하는 샘플 기록이 없습니다. 적합 판정이나 실시간 상태를 의미하지 않습니다.</p>}
   </section>})}
  </section>
  <p className="sample-note">모든 제조 기록은 {data.meta.as_of} 샘플입니다. 이 목록은 승인 판단이나 자동 조치를 수행하지 않습니다.</p>
 </div>;
}
