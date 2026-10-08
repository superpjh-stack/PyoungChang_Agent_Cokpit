import {useState} from 'react';
import {CheckCircle2, Mic, ShieldCheck, ExternalLink} from 'lucide-react';
import {request,type Workspace} from '../types';

type Props={data:Workspace;token:string;onApply:(token:string)=>Promise<void>;onClear:()=>void};
export default function ConnectionSetup({data,token,onApply,onClear}:Props){
 const [draft,setDraft]=useState(token),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [models,setModels]=useState<{label:string;model:string;available:boolean}[]>([]);
 const local=data.meta.local_dev_ai;
 const microphone=window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia;
 async function connect(verify=false){
  setBusy(true);setMessage('');setModels([]);
  try{
   const headers=draft.trim()?{Authorization:'Bearer '+draft.trim()}:undefined;
   const check=await request<{message:string}>('/connection',{headers});
   await onApply(draft.trim());
   if(verify){const result=await request<{message:string;models:typeof models}>('/connection/verify',{method:'POST',headers});setModels(result.models);setMessage(result.message)}
   else setMessage(check.message+' 이제 창을 닫고 AI 답변이나 음성을 선택하세요.');
  }catch(error){setMessage((error as Error).message)}finally{setBusy(false)}
 }
 return <div className="connection-setup">
  <p>한 번 연결하면 문자 질문, 녹음 입력, 실시간 음성을 같은 화면에서 사용할 수 있어요.</p>
  <div className="connection-checklist"><div><ShieldCheck size={20}/><span><strong>OpenAI 서버 설정</strong><small>{data.meta.ai_configured?'설정 있음 · 실제 API 연결은 아래에서 확인':'설정 필요 · 아래 관리자 안내를 확인하세요'}</small></span></div><div><Mic size={20}/><span><strong>이 브라우저의 마이크</strong><small>{microphone?'사용 가능한 환경 · 시작할 때 권한을 요청합니다':'HTTPS 또는 localhost에서 열어 주세요'}</small></span></div></div>
  {local?<p className="connection-local"><CheckCircle2 size={17}/>이 컴퓨터에서는 접근 코드 없이 사용할 수 있어요.</p>:data.meta.ai_configured?<label className="form-label">관리자에게 받은 접근 코드<input type="password" autoComplete="off" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="OpenAI API 키가 아닌 회사 접근 코드"/><small>API 키는 서버에 보관합니다. 이 칸에는 회사 접근 코드만 입력하세요.</small></label>:null}
  <div className="connection-buttons"><button className="primary-button" disabled={busy} onClick={()=>void connect(false)}>{busy?'확인 중…':'연결 적용'}</button><button className="secondary-button" disabled={busy} onClick={()=>void connect(true)}>OpenAI 연결 검사</button>{token&&<button disabled={busy} onClick={()=>{setDraft('');onClear();setModels([]);setMessage('이 탭의 접근 코드를 지웠습니다.')}}>접근 코드 지우기</button>}</div>
  <p className="connection-result" role="status">{message||'연결 검사는 키와 모델 접근을 확인하며 답변·음성을 생성하지 않습니다.'}</p>
  {models.length>0&&<ul>{models.map(item=><li key={item.label}>{item.label}: {item.available?'모델 조회 성공':'모델 접근 확인 필요'} <small>({item.model})</small></li>)}</ul>}
  <details className="setup-admin" open={!data.meta.ai_configured}><summary>처음 사용하는 관리자: API 키 설정 방법</summary><ol><li><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI API 키 발급 화면 <ExternalLink size={12}/></a>에서 키를 준비합니다.</li><li>프로젝트 폴더의 터미널에서 아래 명령을 실행하고 키를 입력합니다. 입력값은 화면에 표시되지 않습니다.<pre>.venv-v2/bin/python -m v2.setup_openai</pre></li><li>앱 서버를 다시 시작한 후 이 창에서 <strong>OpenAI 연결 검사</strong>를 누릅니다.</li></ol><p>음성 및 AI 답변 사용에는 API 사용료가 발생할 수 있습니다. 외부 접속용 접근 코드는 관리자 설정에서 함께 등록합니다.</p></details>
 </div>;
}
