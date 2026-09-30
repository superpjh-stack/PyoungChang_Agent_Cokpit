import {request, type Lot, type Row, type Workspace} from './types';

export type AttentionCategory='CCP 주의'|'금속검출 보류'|'출하 승인 대기'|'재고 부족';
export type AttentionItem={
 category:AttentionCategory;
 key:string;
 label:string;
 status:string;
 lotId:string|null;
 record:Lot|Row;
};

const usableNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const labelFor=(row:Row,index:number)=>String(row.lot_id??row.pack_lot??row.item_name??row.order_no??row.shipment_no??row.check_id??row.inspection_id??`기록 ${index+1}`);

/** Read every bounded page so the overview count never silently omits later metal records. */
export async function loadAllMetalRecords():Promise<Row[]> {
 const limit=100;
 const all:Row[]=[];
 for(let offset=0;;offset+=limit){
  const page=await request<Row[]>(`/tables/metal_detection?limit=${limit}&offset=${offset}`);
  all.push(...page);
  if(page.length<limit)return all;
 }
}

export function buildAttentionItems(workspace:Workspace,metal:Row[]):AttentionItem[]{
 const items:AttentionItem[]=[];
 function add(category:AttentionCategory,rows:Row[],statusKey:string,lotKey:string|null='lot_id'){
  rows.forEach((record,index)=>{
   const recorded=record[statusKey];
   const status=typeof recorded==='string'&&recorded.trim()?recorded:'미확인';
   if(status!=='미확인'&&((statusKey==='result'&&status==='적합')||(statusKey==='quality_approval'&&status==='승인')))return;
   items.push({category,key:String(record.check_id??record.inspection_id??record.shipment_no??`${category}-${index}`),label:labelFor(record,index),status,lotId:lotKey?String(record[lotKey]||'')||null:null,record});
  });
 }
 add('CCP 주의',workspace.ccp,'result');
 add('금속검출 보류',metal,'result');
 add('출하 승인 대기',workspace.shipments,'quality_approval','pack_lot');
 workspace.inventory.forEach((record,index)=>{
  const quantity=record.quantity;
  const safety=record.safety_stock;
  if(usableNumber(quantity)&&usableNumber(safety)&&quantity<safety){
   items.push({category:'재고 부족',key:String(record.item_code??`inventory-${index}`),label:labelFor(record,index),status:'부족',lotId:null,record});
  }
 });
 const order:AttentionCategory[]=['CCP 주의','금속검출 보류','출하 승인 대기','재고 부족'];
 return items.sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category));
}
