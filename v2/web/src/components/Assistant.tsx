import {forwardRef,useEffect,useId,useImperativeHandle,useRef,useState} from 'react';
import {ChevronDown,Send,X,Volume2,RotateCcw,Download,LoaderCircle} from 'lucide-react';
import {request,track,type Answer,type Workspace,type User,type WorkItem} from '../types';
import VoiceControls from './VoiceControls';
import {useVoice} from '../hooks/useVoice';
import {useRealtimeVoice} from '../hooks/useRealtimeVoice';
import {useAssistantSessions} from '../hooks/useAssistantSessions';
import AnswerTools,{AnswerNextSteps} from './AnswerTools';
import EvidenceRecord,{inferRecordKind} from './EvidenceRecord';

export type AssistantHandle={ask:(text:string,lot?:string)=>void;focus:()=>void;reset:()=>void};
type Props={data:Workspace;token:string;user:User|null;lot:string;onLot:(lot:string)=>void;onSettings:()=>void;onSave:(answer:Answer,question:string)=>void;work:WorkItem|null;open:boolean;mobileActive?:boolean;recommendations?:string[];history?:string[];onClose:()=>void;voiceFirst?:boolean;onQuestion?:(question:string)=>void};
export const Assistant=forwardRef<AssistantHandle,Props>(function Assistant({data,token,user,lot,onLot,onSettings,work,open,mobileActive=false,recommendations=[],history=[],onClose,voiceFirst=false,onQuestion},ref){
 const contextId=useId();
 const [contextOpen,setContextOpen]=useState(false);
 const [mode,setMode]=useState<'demo'|'ai'>('demo');
 const sessionState=useAssistantSessions(lot||null,mode),{messages,text,transcribed}=sessionState.session;
 const {setMessages,setText,setTranscribed,clear:clearSession}=sessionState;
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pendingQuestion,setPendingQuestion]=useState('');
 const [liveTurns,setLiveTurns]=useState<{role:'user'|'assistant';text:string}[]>([]);
 const staged=useRef<string|null>(null),heard=useRef('');
 const lock=useRef(false),epoch=useRef(0),abort=useRef<AbortController|null>(null),input=useRef<HTMLTextAreaElement>(null),panel=useRef<HTMLElement>(null),chatScroll=useRef<HTMLDivElement>(null);
 const voice=useVoice(token,value=>{setText(value);heard.current=value;setTranscribed(true);input.current?.focus()});
 const realtime=useRealtimeVoice(token||(data.meta.local_dev_ai?'local':''),lot,turn=>setLiveTurns(items=>[...items,turn]));
 const voiceAvailable=data.meta.ai_configured&&(!!token||!!data.meta.local_dev_ai);
 function cancel(){epoch.current++;abort.current?.abort();lock.current=false;setBusy(false);setPendingQuestion('');voice.cancel();realtime.stop()}
 useEffect(()=>{cancel();setLiveTurns([]);setError('');if(staged.current){setText(staged.current);staged.current=null;setTranscribed(false)}},[lot,work?.id,user?.id,token,mode]);
 useEffect(()=>()=>{epoch.current++;abort.current?.abort()},[]);
 useEffect(()=>{if(!open&&!mobileActive){voice.cancel();realtime.stop()}},[open,mobileActive]);
 useEffect(()=>{if(!open&&!mobileActive)return;const previous=document.activeElement as HTMLElement|null;if(open)input.current?.focus();else panel.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true})}},[open,mobileActive]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const node=chatScroll.current;if(!node)return;if(!messages.length&&!pendingQuestion&&!liveTurns.length){node.scrollTop=0;return}const latest=node.querySelector<HTMLElement>('.exchange:last-of-type');if(latest&&!busy&&!liveTurns.length)node.scrollTop+=latest.getBoundingClientRect().top-node.getBoundingClientRect().top;else node.scrollTop=node.scrollHeight});return()=>cancelAnimationFrame(frame)},[messages,pendingQuestion,busy,error,liveTurns]);
 async function ask(question:string,explicitLot?:string,source:'text'|'suggestion'='suggestion'){
   if(lock.current||!question.trim())return;
   setContextOpen(false);
   onQuestion?.(question.trim());
   const selected=explicitLot??lot;
   if(explicitLot!==undefined&&(explicitLot!==lot||work)){staged.current=question;onLot(explicitLot);return}
   lock.current=true;setBusy(true);setPendingQuestion(question.trim());setError('');voice.cancel();realtime.stop();const run=epoch.current;abort.current=new AbortController();
   const spoken=transcribed&&source==='text';if(spoken&&question!==heard.current)track('transcript_edited');track('question_submitted',{source:spoken?'voice':source,mode});const began=performance.now();
   try{
    const answer=await request<Answer>('/chat',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({question,lot_id:selected||null,work_id:work?.id||null,mode}),signal:abort.current.signal});
    if(run!==epoch.current)return;
    track('answer_ready',{mode,duration_ms:performance.now()-began});
    setMessages(m=>[...m,{question,answer}]);setPendingQuestion('');setText('');setTranscribed(false);
   }catch(e){if(run===epoch.current&&(e as Error).name!=='AbortError'){setPendingQuestion('');setError((e as Error).message);setText(question)}}
   finally{if(run===epoch.current){setBusy(false);lock.current=false}}
 }
 useImperativeHandle(ref,()=>({ask,focus:()=>input.current?.focus(),reset}));
 async function reset(){cancel();clearSession();setLiveTurns([]);setError('');try{await request('/chat/reset',{method:'POST'})}catch(e){setError((e as Error).message)}}
 function trap(e:React.KeyboardEvent){if(!open&&!mobileActive)return;if(e.key==='Escape'){voice.cancel();realtime.stop();onClose()}if(open&&e.key==='Tab'){const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')??[]).filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}
 return <aside ref={panel} tabIndex={-1} className={`assistant-panel ${open?'mobile-open':''} ${voiceFirst?'voice-first':''}`} role={open?'dialog':'region'} aria-modal={open||undefined} aria-label="업무 에이전트" onKeyDown={trap}>
  <header className="agent-header"><div><span className="eyebrow">평창의 정성, 매일의 업무에</span><h2>꽃순이 업무 도우미</h2><p>재고부터 출하까지, 기록을 찾아 함께 확인해요.</p></div><button className="icon-btn" aria-label="대화 초기화" onClick={reset}><RotateCcw size={18}/></button><button className="icon-btn agent-close" aria-label="대화 닫기" onClick={()=>{voice.cancel();onClose()}}><X/></button></header>
  <div className="answer-mode-switch" role="group" aria-label="답변 방식 선택"><button aria-pressed={mode==='demo'} disabled={busy||realtime.active||voice.state!=='idle'} onClick={()=>setMode('demo')}>샘플 DB 조회</button><button aria-pressed={mode==='ai'} disabled={busy||realtime.active||voice.state!=='idle'} onClick={()=>{if(!voiceAvailable){onSettings();return}setMode('ai')}}>OpenAI 답변</button><span>{mode==='demo'?'등록된 기록을 바로 확인':'AI가 기록과 문서를 해석'}</span></div>
  <div className="assistant-context">
  <button type="button" className="context-toggle" aria-expanded={contextOpen} aria-controls={contextId} onClick={()=>setContextOpen(value=>!value)}><span><strong>{lot||'전체 기록'}</strong><small>{mode==='demo'?'샘플 조회':'AI 답변'} · 대상·질문 설정</small></span><ChevronDown size={18}/></button>
  <div id={contextId} className={`assistant-context-fields ${contextOpen?'is-open':''}`}>
  <label className="context-picker">답변 방식<select aria-label="답변 방식" value={mode} disabled={busy||realtime.active||voice.state!=='idle'} onChange={e=>setMode(e.target.value as 'demo'|'ai')}><option value="demo">데모 조회 · API 키 없이</option><option value="ai" disabled={!voiceAvailable}>AI 분석 · 서버 연결 필요</option></select></label>
  <label className="context-picker">생산 묶음 번호(LOT)<select value={lot} disabled={busy||!!work} onChange={e=>onLot(e.target.value)}><option value="">전체 기록</option>{data.lots.map(l=><option value={l.lot_id} key={l.lot_id}>{l.lot_id} · {l.product_name}</option>)}</select></label>
  {(recommendations.length>0||history.length>0)&&<details className="assistant-shortcuts"><summary>추천 질의 · 질의 이력 <ChevronDown size={15}/></summary><div className="assistant-shortcut-columns">{recommendations.length>0&&<section><h3>추천 질의</h3>{recommendations.slice(0,6).map((question,index)=><button key={`${question}-${index}`} disabled={busy} onClick={()=>ask(question)}>{question}</button>)}</section>}{history.length>0&&<section><h3>최근 질문</h3>{history.slice(0,6).map((question,index)=><button key={`${question}-${index}`} disabled={busy} onClick={()=>ask(question)}>{question}</button>)}</section>}</div></details>}
  </div></div>
  {work&&<p className="context-note">이어 보는 업무: {work.title}</p>}
  <div className="chat-scroll" ref={chatScroll}>
    {!messages.length&&!pendingQuestion&&<div className="agent-welcome"><span className="kimchi-emblem" aria-hidden="true">🥬</span><span className="welcome-kicker">평창꽃순이김치 · 업무 대화</span><h3>오늘도 맛있는 하루,<br/>어떤 업무를 도와드릴까요?</h3><p>궁금한 내용을 물어보세요. 재고와 출하 기록을 찾아 알기 쉽게 정리하고, 확인한 근거도 함께 보여드려요.</p><div className="suggestions">{recommendations.slice(0,3).map(q=><button disabled={busy} onClick={()=>ask(q)} key={q}>{q}</button>)}</div></div>}
    {messages.map((m,i)=><article className="exchange" key={`${m.answer.answer_id??m.answer.captured_at??i}-${i}`}><p className="user-message">{m.question}</p><div className="assistant-message"><div className="answer-label">{m.answer.mode==='demo'?'데모 조회 · 샘플 근거':'AI 답변 · 샘플 근거'}</div><h3 className="answer-section-title">확인 결과</h3><p>{m.answer.text}</p><AnswerNextSteps answer={m.answer}/><small>질문 대상: {m.answer.context?.lot_id||'전체 기록'}</small><details className="answer-evidence" onToggle={e=>{if(e.currentTarget.open)track('evidence_opened')}}><summary>근거 {m.answer.evidence.length+m.answer.records.length}건 확인 <ChevronDown size={15}/></summary>{m.answer.evidence.map((ev,j)=><details className="source-detail" key={`${ev.document_id??ev.filename}-${j}`}><summary>{ev.filename} · {ev.status||'상태 미확인'}</summary><div className="evidence-document-meta"><span>문서 번호 {ev.document_id||'미확인'}</span><span>개정 {ev.revision||'미확인'}</span><span>담당 {ev.owner||'미확인'}</span><span>상태 {ev.status||'미확인'}</span></div><pre>{ev.text}</pre></details>)}{m.answer.records.map((row,j)=><EvidenceRecord key={`${row.lot_id??row.item_name??row.shipment_no??'record'}-${j}`} record={row} kind={inferRecordKind(row)}/>)}{!m.answer.evidence.length&&!m.answer.records.length&&<p>연결된 근거가 없습니다.</p>}</details><div className="answer-actions"><button disabled={!voiceAvailable||busy||!['idle','ready','playing'].includes(voice.state)} onClick={()=>{realtime.stop();void voice.speak(m.answer.summary||m.answer.text)}}><Volume2 size={16}/>답변 듣기</button><button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({question:m.question,answer:m.answer},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='꽃순이김치-질의근거.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}><Download size={16}/>근거 내려받기</button></div><AnswerTools question={m.question} answer={m.answer}/>{m.answer.captured_at&&<small>근거 보존: {new Date(m.answer.captured_at).toLocaleString('ko-KR')}</small>}</div></article>)}
    {liveTurns.map((turn,i)=>turn.role==='user'?<p className="user-message live-caption" key={`live-${i}`}>{turn.text}</p>:<div className="assistant-message live-caption" key={`live-${i}`}><div className="answer-label">실시간 음성 · AI 답변</div><p>{turn.text}</p></div>)}
    {pendingQuestion&&<p className="user-message pending-message">{pendingQuestion}</p>}
    {busy&&<p role="status" className="thinking"><LoaderCircle className="spin" size={18}/>기록을 확인하고 있습니다. <button onClick={cancel}>대기 취소</button></p>}
  </div>
  <VoiceControls voice={voice} realtime={realtime} available={voiceAvailable} busy={busy} onSettings={onSettings} onLiveStart={()=>setLiveTurns([])}/>
  {voice.error&&<p className="voice-error" role="alert">{voice.error}</p>}
  {realtime.error&&<p className="voice-error" role="alert">{realtime.error}</p>}
  {error&&<p className="voice-error" role="alert">{error}</p>}
  <form className="composer" onSubmit={e=>{e.preventDefault();ask(text,undefined,'text')}}>{transcribed&&<p className="transcript-notice">인식한 문장과 LOT·수치를 확인한 뒤 보내세요.</p>}<textarea ref={input} aria-label="에이전트에게 질문" value={text} onChange={e=>setText(e.target.value)} rows={3} maxLength={2000} placeholder="오늘 궁금한 재고, 출하, 김치 제조 업무를 물어보세요" disabled={busy||realtime.active||voice.state!=='idle'}/><div><small>{mode==='demo'?'데모 조회 · 정해진 기록 검색':'AI 지식 응답'}</small><button className="send-button" aria-label="질문 보내기" disabled={!text.trim()||busy||realtime.active||voice.state!=='idle'}><Send size={18}/></button></div></form>
  <p className="assistant-disclaimer">{voiceAvailable?'마이크 음성은 실시간 처리되며 앱에 녹음 파일로 저장하지 않습니다.':'음성 사용은 설정에서 AI 연결이 필요합니다.'}<br/>공정 변경·출하 승인은 담당자가 결정합니다.</p>
 </aside>
});
