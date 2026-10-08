import {ChevronDown,FileJson} from 'lucide-react';
import type {Row} from '../types';

export type RecordKind='plan'|'actual'|'ccp'|'metal'|'movement'|'shipment'|'inventory'|'generic';
type Props={record:Row;kind:RecordKind;onOpenSource?:(record:Row)=>void};
const sets:Record<RecordKind,{label:string;fields:[string,string][]}>={
 plan:{label:'출하계획',fields:[['plan_id','계획 번호'],['business_date','업무일'],['product_name','제품'],['channel','배송 구분'],['quantity_kg','계획 수량'],['planned_at','예정 시각'],['quality_approval','품질 승인'],['source','출처']]},
 actual:{label:'출하실적',fields:[['dispatch_id','실적 번호'],['plan_id','연결 계획'],['business_date','업무일'],['product_name','제품'],['channel','배송 구분'],['quantity_kg','실제 출하 수량'],['shipped_at','출하 시각'],['status','출하 상태'],['source','출처']]},
 ccp:{label:'세척 CCP',fields:[['lot_id','LOT'],['washer_id','세척기'],['peroxide_ppm','과산화수소'],['water_l','투입 물량'],['contact_min','접촉 시간'],['result','기록 판정'],['recorded_at','기록 시각'],['source','출처']]},
 metal:{label:'금속검출',fields:[['lot_id','LOT'],['detector_id','검출기'],['pass_count','통과 수량'],['reject_count','불합격 수량'],['result','기록 판정'],['inspected_at','검사 시각'],['source','출처']]},
 movement:{label:'PDA 이동',fields:[['movement_id','이동 기록'],['lot_id','LOT'],['item_code','품목 코드'],['from_location','출발 위치'],['to_location','도착 위치'],['quantity','이동 수량'],['unit','단위'],['operator','작업자 기록'],['moved_at','이동 시각'],['capture_status','수집 상태']]},
 shipment:{label:'출하',fields:[['shipment_no','출하 번호'],['pack_lot','포장 LOT'],['order_no','수주 번호'],['channel','배송 구분'],['quantity_kg','수량'],['planned_at','예정 시각'],['status','출하 기록'],['quality_approval','품질 기록']]},
 inventory:{label:'재고',fields:[['item_code','품목 코드'],['item_name','품목'],['item_type','품목 구분'],['quantity','현재 수량'],['unit','단위'],['safety_stock','샘플 안전재고'],['location','보관 위치'],['updated_at','기록 시각']]},
 generic:{label:'원본 기록',fields:[]},
};
const valueText=(value:unknown)=>value===null||value===undefined||value===''?'미확인':typeof value==='object'?JSON.stringify(value):String(value);
const identify=(record:Row)=>String(record.dispatch_id??record.plan_id??record.lot_id??record.pack_lot??record.movement_id??record.shipment_no??record.item_name??record.check_id??record.inspection_id??'기록 식별자 미확인');
export function inferRecordKind(record:Row):RecordKind{
 if('dispatch_id'in record)return 'actual';
 if('plan_id'in record&&'planned_at'in record)return 'plan';
 if('peroxide_ppm'in record||'contact_min'in record)return 'ccp';
 if('inspection_id'in record||'reject_count'in record)return 'metal';
 if('movement_id'in record||'from_location'in record)return 'movement';
 if('shipment_no'in record||'quality_approval'in record)return 'shipment';
 if('item_code'in record||'safety_stock'in record)return 'inventory';
 return 'generic';
}
export default function EvidenceRecord({record,kind,onOpenSource}:Props){
 const config=sets[kind];
 const fields=kind==='generic'?Object.entries(record).map(([key])=>[key,key] as [string,string]):config.fields;
 const status=record.result??record.quality_approval??record.capture_status??record.status??record.stock_status;
 const statusIsMissing=status===undefined||status===null||status==='';
 const statusStyle=statusIsMissing?'unknown':['적합','승인','정상','완료','출하완료'].includes(String(status))?'good':'review';
 return <details className="evidence-record" onToggle={event=>{if(event.currentTarget.open)onOpenSource?.(record)}}>
  <summary><span className="evidence-record-icon"><FileJson size={16}/></span><span className="evidence-record-title"><strong>{identify(record)}</strong><small>{config.label} · {valueText(record.shipped_at??record.recorded_at??record.inspected_at??record.moved_at??record.planned_at??record.updated_at)}</small></span><span className={`evidence-status ${statusStyle}`}>{valueText(status)}</span><ChevronDown className="evidence-chevron" size={16}/></summary>
  <dl className="evidence-fields">{fields.filter(([key])=>key in record).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{valueText(record[key])}{key==='peroxide_ppm'?' ppm':key==='water_l'?' L':key==='contact_min'?'분':key==='quantity_kg'?' kg':key==='quantity'&&record.unit?` ${String(record.unit)}`:key==='safety_stock'&&record.unit?` ${String(record.unit)}`:''}</dd></div>)}</dl>
  <details className="evidence-raw"><summary>원본 값 열기</summary><pre>{JSON.stringify(record,null,2)}</pre></details>
 </details>;
}
