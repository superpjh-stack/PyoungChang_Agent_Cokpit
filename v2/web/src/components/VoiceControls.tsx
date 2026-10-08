import {useRef} from 'react';
import {Mic,MicOff,PhoneOff,Upload,Square,Play,LoaderCircle} from 'lucide-react';
import type {useVoice} from '../hooks/useVoice';
import type {useRealtimeVoice} from '../hooks/useRealtimeVoice';

type Props={voice:ReturnType<typeof useVoice>;realtime:ReturnType<typeof useRealtimeVoice>;available:boolean;busy:boolean;onSettings:()=>void;onLiveStart:()=>void};
export default function VoiceControls({voice,realtime,available,busy,onSettings,onLiveStart}:Props){
 const file=useRef<HTMLInputElement>(null);
 const recording=['permission','recording','stopping','review','transcribing'].includes(voice.state);
 return <section className="easy-voice" aria-label="음성 질문">
  <div className="easy-voice-heading"><strong>말로 물어보세요</strong><button onClick={onSettings}>{available?'음성·API 설정':'연결하고 시작'}</button></div>
  {!recording&&!realtime.active&&<div className="easy-voice-options">
   <button disabled={busy} onClick={()=>{if(!available){onSettings();return}realtime.stop();void voice.start()}}><Mic size={18}/><span><strong>눌러서 녹음</strong><small>말한 내용을 확인 후 질문</small></span></button>
   <button disabled={busy} onClick={()=>{if(!available){onSettings();return}voice.cancel();onLiveStart();void realtime.start()}}><Mic size={18}/><span><strong>실시간 대화</strong><small>말하면 바로 음성으로 답변</small></span></button>
   <button className="voice-upload" aria-label="음성 파일로 질문 입력" title="음성 파일로 질문 입력" disabled={busy} onClick={()=>{if(!available){onSettings();return}voice.cancel();realtime.stop();file.current?.click()}}><Upload size={18}/></button>
  </div>}
  <input ref={file} type="file" accept="audio/*,.webm,.m4a,.mp3,.wav" hidden onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected){realtime.stop();void voice.transcribe(selected)}}}/>
  {recording&&<div className="voice-session" role="status">
   <span>{voice.state==='recording'?`녹음 중 ${voice.seconds}초 / 최대 60초`:voice.state==='permission'?'브라우저에서 마이크를 허용해 주세요':voice.state==='review'?'변환을 다시 시도하거나 직접 입력해 주세요':'음성을 문자로 바꾸고 있어요…'}</span>
   {voice.state==='recording'&&<button onClick={voice.stop}><Square size={15}/>완료·문자로 변환</button>}
   {voice.state==='review'&&<button onClick={()=>void voice.convert()}>변환 재시도</button>}
   <button onClick={voice.cancel}>취소</button>
  </div>}
  {realtime.active&&<div className="voice-session" role="status"><span>{realtime.state==='permission'?'마이크 허용을 기다려요':realtime.state==='connecting'?'음성 연결 중…':realtime.muted?'마이크가 꺼져 있어요':realtime.state==='responding'?'답변을 준비하고 있어요':'듣고 있어요. 편하게 말씀하세요.'}</span><button aria-label={realtime.muted?'마이크 켜기':'마이크 끄기'} onClick={realtime.toggleMute}>{realtime.muted?<MicOff size={18}/>:<Mic size={18}/>}</button>{realtime.needsPlay&&<button onClick={()=>void realtime.play()}><Play size={16}/>재생</button>}<button onClick={realtime.stop}><PhoneOff size={16}/>종료</button></div>}
  {['generating','ready','playing'].includes(voice.state)&&<div className="voice-session" role="status"><span>{voice.state==='generating'?<><LoaderCircle size={15} className="spin"/>답변 음성 준비 중</>:voice.state==='playing'?'답변을 읽어드리고 있어요':'음성이 준비됐어요'}</span>{voice.state==='ready'&&<button onClick={()=>void voice.play()}>재생</button>}<button onClick={voice.cancel}>소리 중지</button></div>}
  {!recording&&!realtime.active&&<small className="voice-help">녹음·음성 파일은 OpenAI에서 문자로 변환합니다. 실시간 대화는 AI 음성이며 API 사용료가 발생할 수 있어요.</small>}
 </section>;
}
