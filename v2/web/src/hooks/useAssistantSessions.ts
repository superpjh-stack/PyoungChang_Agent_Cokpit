import {useCallback,useMemo,useState,type Dispatch,type SetStateAction} from 'react';
import type {Answer} from '../types';

export type Exchange={question:string;answer:Answer};
export type AssistantSession={messages:Exchange[];text:string;transcribed:boolean};
type Setter<T>=Dispatch<SetStateAction<T>>;
const empty:AssistantSession={messages:[],text:'',transcribed:false};
const sessionKey=(lot:string|null|undefined,mode:'ai'|'demo')=>JSON.stringify([lot||null,mode]);

/** Conversation state follows the selected evidence context for the life of this browser tab. */
export function useAssistantSessions(lot:string|null|undefined,mode:'ai'|'demo'):{session:AssistantSession;setMessages:Setter<Exchange[]>;setText:Setter<string>;setTranscribed:Setter<boolean>;clear:()=>void}{
 const [sessions,setSessions]=useState<Record<string,AssistantSession>>({});
 const key=useMemo(()=>sessionKey(lot,mode),[lot,mode]);
 const session=sessions[key]??empty;
 const update=useCallback((patch:Partial<AssistantSession>)=>setSessions(previous=>({ ...previous,[key]:{...(previous[key]??empty),...patch}})),[key]);
 const setMessages=useCallback<Setter<Exchange[]>>(value=>setSessions(previous=>{const current=previous[key]??empty;const messages=typeof value==='function'?value(current.messages):value;return {...previous,[key]:{...current,messages}}}),[key]);
 const setText=useCallback<Setter<string>>(value=>setSessions(previous=>{const current=previous[key]??empty;const text=typeof value==='function'?value(current.text):value;return {...previous,[key]:{...current,text}}}),[key]);
 const setTranscribed=useCallback<Setter<boolean>>(value=>setSessions(previous=>{const current=previous[key]??empty;const transcribed=typeof value==='function'?value(current.transcribed):value;return {...previous,[key]:{...current,transcribed}}}),[key]);
 return {session:{...session},setMessages,setText,setTranscribed,clear:()=>update(empty)};
}
