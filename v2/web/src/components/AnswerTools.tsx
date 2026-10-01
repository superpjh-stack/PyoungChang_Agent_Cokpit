import {useState} from 'react';
import {Copy, Download} from 'lucide-react';
import type {Answer} from '../types';
import {answerReport,downloadText,nextChecks} from '../answerReport';

export function AnswerNextSteps({answer}:{answer:Answer}){
 return <section className="answer-next-steps" aria-label="다음 할 일"><h3>다음 할 일 <span>확인 안내</span></h3><ul>{nextChecks(answer).map(step=><li key={step}>{step}</li>)}</ul></section>;
}

export default function AnswerTools({question,answer}:{question:string;answer:Answer}){
 const [status,setStatus]=useState('');
 const [manualCopy,setManualCopy]=useState(false);
 const report=answerReport(question,answer);
 async function copy(){
  try{await navigator.clipboard.writeText(report);setManualCopy(false);setStatus('질문·답변·근거를 복사했습니다.');}
  catch{setManualCopy(true);setStatus('자동 복사를 사용할 수 없습니다. 아래 내용을 선택해 복사하세요.');}
 }
 return <div className="answer-sharing"><div className="answer-actions"><button onClick={()=>void copy()}><Copy size={16}/>답변 복사</button><button onClick={()=>{downloadText(report,`꽃순이김치-확인보고서-${answer.context?.lot_id||'전체'}.txt`);setStatus('텍스트 보고서 다운로드를 시작했습니다.')}}><Download size={16}/>보고서 내려받기</button></div><p className="copy-status" role="status">{status}</p>{manualCopy&&<label className="manual-copy">복사할 보고서<textarea readOnly rows={6} value={report} onFocus={event=>event.currentTarget.select()}/></label>}</div>;
}
