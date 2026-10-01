import {useEffect,useRef,type ReactNode} from 'react';
import {BookOpen, GitBranch, House, MessageCircle, type LucideIcon} from 'lucide-react';
import type {Workspace} from '../types';

export type WorkspaceView='home'|'lots'|'assistant'|'library';
type Props={view:WorkspaceView;selectedLot:string|null;data:Workspace;headerActions?:ReactNode;children:ReactNode;assistant:ReactNode;onNavigate:(view:WorkspaceView)=>void};
const navigation:{id:WorkspaceView;label:string;Icon:LucideIcon}[]=[
 {id:'home',label:'현장',Icon:House},
 {id:'lots',label:'LOT',Icon:GitBranch},
 {id:'assistant',label:'AI',Icon:MessageCircle},
 {id:'library',label:'자료',Icon:BookOpen},
];

export default function WorkspaceShell({view,selectedLot,data,headerActions,children,assistant,onNavigate}:Props){
 const isDemo=data.meta.demo_data;
 const shell=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const viewport=window.visualViewport;
  const update=()=>{
   // Pin the mobile conversation to the visible area above the software keyboard.
   // Leave pinch zoom native; zooming must not keep reflowing the application.
   if(viewport&&viewport.scale!==1)return;
   if(shell.current)shell.current.dataset.compactHeight=String((viewport?.height??window.innerHeight)<=550);
   shell.current?.style.setProperty('--visible-height',`${viewport?.height??window.innerHeight}px`);
   shell.current?.style.setProperty('--visible-top',`${viewport?.offsetTop??0}px`);
  };
  update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update)};
 },[]);
 return <div ref={shell} className={`workspace-shell ${view==='assistant'?'show-assistant':''}`}>
  <header className="workspace-topbar">
   <a className="workspace-brand" href="#/home" onClick={event=>{event.preventDefault();onNavigate('home')}} aria-label="평창꽃순이김치 AI Agent 현장 홈">
    <span className="brand-mark">꽃</span><span><strong>평창꽃순이김치</strong><small>AI Agent v2.0</small></span>
   </a>
   <div className="workspace-source" role="status"><span className={isDemo?'source-mark sample':'source-mark'}/><span>{isDemo?'샘플 기록':'운영 기록'}</span><time dateTime={data.meta.as_of}>기준 {data.meta.as_of}</time></div>
   <div className="workspace-actions">{headerActions}</div>
  </header>
  <div className="workspace-layout">
   <nav className="workspace-nav" aria-label="주요 화면">
    {navigation.map(({id,label,Icon})=><button key={id} type="button" aria-current={view===id?'page':undefined} onClick={()=>onNavigate(id)}>
     <Icon size={20} strokeWidth={1.8}/><span>{label}</span>
    </button>)}
    <div className="nav-current-context" aria-live="polite">{selectedLot?<><span>선택 LOT</span><strong>{selectedLot}</strong></>:<><span>제조 현장</span><strong>기록 근거 조회</strong></>}</div>
   </nav>
   <main className={`workspace-main screen-${view}`} key={view}>{children}</main>
   <aside className={`workspace-assistant ${view==='assistant'?'assistant-current':''}`} aria-label="AI 제조 업무 도우미">{assistant}</aside>
  </div>
  <nav className="workspace-bottom-nav" aria-label="모바일 주요 화면">
   {navigation.map(({id,label,Icon})=><button key={id} type="button" aria-current={view===id?'page':undefined} onClick={()=>onNavigate(id)}><Icon size={20} strokeWidth={1.8}/><span>{label}</span></button>)}
  </nav>
 </div>;
}
