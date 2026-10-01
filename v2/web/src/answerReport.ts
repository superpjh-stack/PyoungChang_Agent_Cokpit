import type {Answer} from './types';

const recordLabels:Record<string,string>={
 lot_id:'생산 묶음 번호(LOT)',parent_lot_id:'상위 생산 묶음',pack_lot:'포장 생산 묶음',
 product_name:'제품명',process:'공정',quantity_kg:'수량(kg)',status:'상태',source:'출처',
 item_code:'품목 코드',item_name:'품목명',item_type:'품목 구분',quantity:'수량',unit:'단위',
 safety_stock:'샘플 안전재고',location:'보관 위치',updated_at:'갱신 시각',created_at:'생성 시각',
 shipment_no:'출하 번호',order_no:'수주 번호',channel:'배송 구분',planned_at:'예정 시각',quality_approval:'품질 승인 기록',
 check_id:'검사 번호',washer_id:'세척기',peroxide_ppm:'과산화수소(ppm)',water_l:'투입 물량(L)',
 contact_min:'접촉 시간(분)',result:'기록 판정',recorded_at:'기록 시각',
 inspection_id:'검출 기록 번호',detector_id:'금속검출기',pass_count:'통과 수량',reject_count:'불합격 수량',inspected_at:'검사 시각',
 movement_id:'이동 기록 번호',from_location:'출발 위치',to_location:'도착 위치',operator:'작업자',moved_at:'이동 시각',capture_status:'수집 상태',
};

/** Follow-up guidance, not inferred manufacturing findings or approval decisions. */
export function nextChecks(answer:Answer):string[]{
 if(!answer.records.length&&!answer.evidence.length)return ['제품명이나 생산 묶음 번호(LOT)를 확인해 다시 질문하세요.', '등록된 근거가 없으면 담당자에게 원본 기록을 요청하세요.'];
 const checks:string[]=[];
 if(answer.data_tools.includes('get_shipment_status'))checks.push('출하 기록의 품질 승인 상태와 배송 예정일을 담당자에게 확인하세요.');
 if(answer.data_tools.includes('get_inventory_status'))checks.push('조회 수량을 실제 재고와 대조하고, 부족 품목의 입고 일정을 확인하세요.');
 if(answer.data_tools.some(tool=>['get_wash_ccp_status','get_metal_detection'].includes(tool)))checks.push('세척·금속검출 원본 기록과 승인된 현장 기준을 품질 담당자와 확인하세요.');
 if(!checks.length)checks.push('아래 근거를 열어 대상 제품, 기록 시각과 문서 승인 상태를 확인하세요.');
 return checks;
}

export function answerReport(question:string,answer:Answer):string{
 const time=answer.retrieved_at||answer.captured_at;
 return [
  '평창꽃순이김치 · 업무 확인 보고서',
  `질문: ${question}`,
  `질문 대상: ${answer.context?.lot_id||'전체 기록'}`,
  `샘플 기준일: ${answer.context?.as_of||'미확인'}`,
  `조회 시각: ${time?new Date(time).toLocaleString('ko-KR'):'미확인'}`,
  `답변 방식: ${answer.mode==='demo'?'데모 기록 조회':'AI 답변'}`,
  '\n[확인 결과]',answer.text,
  '\n[다음 할 일 · 확인 안내]',...nextChecks(answer).map((step,index)=>`${index+1}. ${step}`),
  '\n[문서 근거]',
  ...(answer.evidence.length?answer.evidence.map(ev=>`${ev.document_id||ev.filename} · ${ev.filename}\n상태: ${ev.status||'미확인'} / 개정: ${ev.revision||'미확인'} / 담당: ${ev.owner||'미확인'}\n${ev.text}`):['연결된 문서 없음']),
  '\n[원본 기록]',
  ...(answer.records.length?answer.records.map((row,index)=>`기록 ${index+1}\n${Object.entries(row).map(([key,value])=>`${recordLabels[key]||key}: ${value===null||value===''?'미확인':value}`).join('\n')}`):['연결된 기록 없음']),
  '\n[용어 안내]','LOT: 함께 생산·관리하는 제품 묶음 번호 / CCP: 식품 안전을 위해 중점 확인하는 공정 / PDA: 현장에서 입출고·이동을 기록하는 휴대 단말기',
  '\n샘플 기록을 바탕으로 작성한 확인용 보고서입니다. 실제 현황과 다를 수 있으며, 공정 변경·출하 승인은 담당자가 결정합니다.',
 ].join('\n');
}

export function downloadText(text:string,filename:string,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob(['\ufeff',text],{type}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
