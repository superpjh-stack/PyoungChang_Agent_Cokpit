import {useState,type ReactNode} from 'react';
import {ArrowUpRight, BookOpen, GitBranch, House, MessageCircle, Plus, History, PanelLeftClose, PanelRightClose, type LucideIcon} from 'lucide-react';
import type {Workspace} from '../types';

export type WorkspaceView='home'|'lots'|'assistant'|'library';
type Props={view:WorkspaceView;selectedLot:string|null;data:Workspace;headerActions?:ReactNode;children:ReactNode;assistant:ReactNode;resources:ReactNode;history:string[];onAsk:(question:string)=>void;onNewChat:()=>void;onNavigate:(view:WorkspaceView)=>void};
const navigation:{id:WorkspaceView;label:string;Icon:LucideIcon}[]=[
 {id:'assistant',label:'업무 대화',Icon:MessageCircle},
 {id:'home',label:'현장 현황',Icon:House},
 {id:'lots',label:'LOT 조회',Icon:GitBranch},
 {id:'library',label:'자료 전체',Icon:BookOpen},
];

export default function WorkspaceShell({view,selectedLot,data,headerActions,children,assistant,resources,history,onAsk,onNewChat,onNavigate}:Props){
 const [mobilePanel,setMobilePanel]=useState<'questions'|'resources'|null>(null);
 const chat=view==='assistant';
 return <div className={`flower-workspace ${chat?'is-chat':''}`}>
  <header className="flower-topbar">
   <a className="flower-brand" href="#/assistant" onClick={event=>{event.preventDefault();onNavigate('assistant')}}><span className="flower-mark">꽃</span><span><strong>평창꽃순이김치</strong><small>우리의 정성, 더 편한 업무</small></span></a>
   <nav aria-label="주요 화면">{navigation.map(({id,label,Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>{setMobilePanel(null);onNavigate(id)}}><Icon size={16}/><span>{label}</span></button>)}</nav>
   <div className="flower-actions">{headerActions}</div>
  </header>
  <div className="flower-mobile-tools"><button aria-expanded={mobilePanel==='questions'} onClick={()=>setMobilePanel(value=>value==='questions'?null:'questions')}><History size={17}/>질문 · 기록</button><span>샘플 데이터</span><button aria-expanded={mobilePanel==='resources'} onClick={()=>{onNavigate('assistant');setMobilePanel(value=>value==='resources'?null:'resources')}}><BookOpen size={17}/>지식 · DB</button></div>
  <div className="flower-layout">
   <aside className={`flower-questions ${mobilePanel==='questions'?'panel-open':''}`} aria-label="추천 질문과 질문 기록">
    <div className="panel-mobile-title"><strong>질문 · 기록</strong><button aria-label="질문 패널 닫기" onClick={()=>setMobilePanel(null)}><PanelLeftClose size={20}/></button></div>
    <button className="flower-new-chat" onClick={()=>{onNavigate('assistant');onNewChat();setMobilePanel(null)}}><Plus size={18}/>새 대화</button>
    <section className="flower-top-questions"><div className="flower-section-heading"><h2>오늘의 추천 질문</h2><span>TOP 3</span></div><p>자주 확인하는 업무, 한 번에 물어보세요.</p>{(data.questions['공정데이터']||[]).slice(0,3).map((question,index)=><button key={question} onClick={()=>{onAsk(question);setMobilePanel(null)}}><span className="question-number">0{index+1}</span><strong>{question}</strong><ArrowUpRight size={16}/></button>)}<small>회사 전체 기록 기준으로 조회합니다.</small></section>
    <section className="flower-history"><div className="flower-section-heading"><h2><History size={16}/>최근 질문</h2><span>{history.length}</span></div>{history.length?history.map((question,index)=><button key={question} onClick={()=>{onAsk(question);setMobilePanel(null)}}><MessageCircle size={15}/><span>{question}</span><span className="sr-only"> 다시 질문 {index+1}</span></button>):<p className="history-empty">아직 질문한 내용이 없어요.<br/>대화를 시작하면 이곳에 모아드려요.</p>}</section>
    <div className="flower-origin"><span>평창에서 담근 정성</span><p>원료에서 고객의 식탁까지,<br/>꼼꼼한 기록을 함께 확인합니다.</p><small>질문 기록은 이 브라우저 탭에 보관됩니다.</small></div>
   </aside>
   <main className="flower-main" hidden={chat}>{!chat&&children}</main>
   <main className="flower-chat" hidden={!chat}><div className="flower-chat-meta"><span><i/>기록을 근거로 답하는 업무 도우미</span><small>{selectedLot||'전체 기록'} · 데모</small></div>{assistant}</main>
   <aside className={`flower-resources ${mobilePanel==='resources'?'panel-open':''}`} aria-label="지식베이스와 DB 데이터"><div className="panel-mobile-title"><strong>지식 · DB</strong><button aria-label="자료 패널 닫기" onClick={()=>setMobilePanel(null)}><PanelRightClose size={20}/></button></div><div className="flower-data-notice"><strong>샘플 데이터 조회 중</strong><p>재고·출하 {data.meta.as_of}<br/>공정·LOT 2026-09-04</p><small>실제 운영 DB 연결 전 데모입니다.</small></div>{chat&&resources}</aside>
  </div>
  {chat&&<div className="flower-overlays">{children}</div>}
 </div>;
}
