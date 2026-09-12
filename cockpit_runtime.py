from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Callable

import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI


STYLE = """<style>
:root{--ink:#17191c;--steel:#343a40;--paper:#f4f2ed;--line:#d5d1c8;--safety:#ef7d00}
.stApp{background:linear-gradient(180deg,#f5f3ee 0,#fff 310px)}
.block-container{padding-top:1.1rem;max-width:1600px}
[data-testid=stMetric]{background:#fff;border:1px solid var(--line);border-top:3px solid var(--safety);border-radius:4px;padding:11px 13px}
[data-testid=stMetricValue]{font-size:clamp(1.2rem,2vw,1.8rem)}
[data-testid=stChatMessage]{border-radius:4px;padding:.45rem .7rem;margin-bottom:.55rem;border-left:3px solid #687078;background:#fff}
[data-testid=stChatMessage]:has([data-testid=stChatMessageAvatarUser]){border-left-color:var(--safety);background:#fff7ed}
.kicker{font-size:.75rem;letter-spacing:.13em;color:#6b7280;font-weight:800}.title{font-size:1.75rem;font-weight:850;color:var(--ink)}
.subtitle,.tiny{color:#62676d}.tiny{font-size:.76rem}.card{border:1px solid var(--line);border-radius:4px;padding:12px;background:#faf9f6;margin-bottom:9px}.label{font-size:.73rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}.value{font-size:1.05rem;font-weight:780}
div.stButton>button{border-radius:4px;text-align:left;justify-content:flex-start;white-space:normal;height:auto;min-height:2.75rem}
@media(max-width:700px){.block-container{padding:.65rem .6rem 5.2rem;max-width:100%;overflow-x:hidden}.title{font-size:1.3rem}[data-testid=stMetric],.kicker,.subtitle{display:none}.st-key-workspace>div>div[data-testid=stHorizontalBlock]>div[data-testid=stColumn]:first-child,.st-key-workspace>div>div[data-testid=stHorizontalBlock]>div[data-testid=stColumn]:last-child{display:none}.st-key-workspace>div>div[data-testid=stHorizontalBlock]>div[data-testid=stColumn]{width:100%;flex:1 1 100%}.stChatFloatingInputContainer{padding-bottom:max(.45rem,env(safe-area-inset-bottom))}}
</style>"""


def render_cockpit(*, base_dir: Path, page_title: str, icon: str, title: str, subtitle: str,
                   repository: Any, registry: Any, agent_factory: Callable[[Any, str, Any], Any],
                   question_groups: dict[str, list[str]], welcome_message: dict[str, Any],
                   timestamp: Callable[[], str], history_fn: Callable[..., list[dict[str, str]]],
                   metrics: list[tuple[str, str]], entity_label: str, entity_ids: list[str],
                   snapshot_builder: Callable[[str], dict[str, Any]], knowledge_label: str,
                   knowledge_base_name: str, source_label: str, chat_placeholder: str,
                   safety_note: str) -> None:
    load_dotenv()
    st.set_page_config(page_title=page_title, page_icon=icon, layout="wide", initial_sidebar_state="collapsed")
    st.markdown(STYLE, unsafe_allow_html=True)
    first_group = next(iter(question_groups))
    server_key = os.getenv("OPENAI_API_KEY", "")
    default_model = os.getenv("OPENAI_MODEL", "gpt-5.6")
    for key, default in {"messages":[welcome_message.copy()],"vector_store_id":None,"uploaded_names":[],"previous_response_id":None,"pending_question":None,"question_group":first_group,
                         "agent_settings":{"api_key":server_key,"key_source":"server" if server_key else "none","model":default_model,"max_results":6}}.items():
        if key not in st.session_state: st.session_state[key] = default

    with st.sidebar:
        st.header("⚙️ Agent 설정")
        settings = st.session_state.agent_settings
        masked = f"••••{settings['api_key'][-4:]}" if settings["api_key"] else "연결 안 됨"
        source = "서버 기본값" if settings["key_source"] == "server" else ("현재 세션 재정의" if settings["key_source"] == "session" else "없음")
        st.caption(f"API 키: {masked} · {source}")
        with st.form("agent_settings_form", clear_on_submit=True):
            key_override = st.text_input("세션 API 키", value="", type="password", help="비워 두면 현재 키를 유지합니다.")
            model_value = st.text_input("모델", value=settings["model"])
            results_value = st.slider("문서 검색 결과", 1, 10, int(settings["max_results"]))
            if st.form_submit_button("설정 적용", width="stretch"):
                if key_override:
                    settings["api_key"] = key_override
                    settings["key_source"] = "session"
                    st.session_state.previous_response_id = None
                settings["model"] = model_value.strip() or default_model
                settings["max_results"] = results_value
                st.rerun()
        if st.button("서버 기본 키로 돌아가기", width="stretch", disabled=settings["key_source"] != "session"):
            settings["api_key"] = server_key
            settings["key_source"] = "server" if server_key else "none"
            st.session_state.previous_response_id = None
            st.rerun()
        api_key, model, max_results = settings["api_key"], settings["model"], settings["max_results"]
        st.divider(); st.subheader("📚 지식문서")
        uploads = st.file_uploader(knowledge_label, accept_multiple_files=True, type=["pdf","docx","txt","md","csv"])
        upload_agent = agent_factory(OpenAI(api_key=api_key, timeout=30.0, max_retries=2), model, registry) if api_key else None
        if st.button("문서 인덱싱", width="stretch", disabled=not uploads or not upload_agent):
            try:
                if not st.session_state.vector_store_id: st.session_state.vector_store_id = upload_agent.create_knowledge_base(knowledge_base_name)
                for uploaded in uploads:
                    temp_path = None
                    try:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded.name).suffix) as temp:
                            temp.write(uploaded.getbuffer()); temp_path = temp.name
                        upload_agent.add_file(st.session_state.vector_store_id, temp_path)
                        if uploaded.name not in st.session_state.uploaded_names: st.session_state.uploaded_names.append(uploaded.name)
                    finally:
                        if temp_path: Path(temp_path).unlink(missing_ok=True)
                st.success(f"{len(uploads)}개 문서 연결 완료")
            except Exception as exc: st.error(f"문서 인덱싱 실패: {exc}")
        st.caption("연결 문서: " + (", ".join(st.session_state.uploaded_names) if st.session_state.uploaded_names else "없음"))
        st.divider(); st.caption(safety_note)

    agent = agent_factory(OpenAI(api_key=api_key, timeout=30.0, max_retries=2), model, registry) if api_key else None
    st.markdown('<div class="kicker">MANUFACTURING AGENT COCKPIT</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="title">{title}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="subtitle">{subtitle}</div>', unsafe_allow_html=True)
    metric_cols = st.columns(len(metrics))
    for column, (label, value) in zip(metric_cols, metrics): column.metric(label, value)
    workspace = st.container(key="workspace")
    left, chat, context = workspace.columns([1.05,2.35,1.2], gap="medium")

    with left:
        with st.container(border=True):
            st.markdown("#### 대화 이력")
            if st.button("＋ 새 대화", width="stretch"):
                st.session_state.messages=[welcome_message.copy()]; st.session_state.previous_response_id=None; st.rerun()
            history=history_fn(st.session_state.messages)
            if not history: st.caption("아직 질문이 없습니다.")
            for i,item in enumerate(history):
                label=item["content"] if len(item["content"])<=38 else item["content"][:38]+"…"
                if st.button(f"💬 {label}", key=f"history_{i}", width="stretch", help=item["created_at"]): st.session_state.pending_question=item["content"]; st.rerun()
        with st.container(border=True):
            st.markdown("#### 추천 질문")
            group=st.segmented_control("업무 영역",list(question_groups),default=st.session_state.question_group,label_visibility="collapsed")
            if group: st.session_state.question_group=group
            for i,q in enumerate(question_groups[st.session_state.question_group]):
                if st.button(q, key=f"suggestion_{st.session_state.question_group}_{i}", width="stretch"): st.session_state.pending_question=q; st.rerun()
            st.markdown('<div class="tiny">추천질문은 채팅으로 전달되며, 위험 조치는 승인 담당자와 함께 안내됩니다.</div>',unsafe_allow_html=True)

    with context:
        with st.container(border=True):
            st.markdown(f"#### {entity_label} 상황")
            entity_id=st.selectbox(entity_label,entity_ids,label_visibility="collapsed")
            snap=snapshot_builder(entity_id)
            st.markdown(f'<div class="card"><div class="label">종합 위험</div><div class="value">{snap["icon"]} {snap["risk"]}</div></div>',unsafe_allow_html=True)
            st.markdown(f'<div class="card"><div class="label">{snap["primary_label"]}</div><div class="value">{snap["primary"]}</div></div>',unsafe_allow_html=True)
            if snap.get("progress") is not None: st.progress(float(snap["progress"])/100,text=f"진척 {float(snap['progress']):.0f}%")
            st.caption(snap["caption"])
            count_cols=st.columns(len(snap["counts"]))
            for column,(label,value) in zip(count_cols,snap["counts"]): column.metric(label,value)
            if st.button(f"이 {entity_label} 브리핑", width="stretch", type="primary"): st.session_state.pending_question=snap["brief"]; st.rerun()
        with st.container(border=True):
            st.markdown("#### 승인 대기")
            if snap["approvals"]:
                for item in snap["approvals"]: st.write("• "+item)
            else: st.success("현재 주요 승인 대기 없음")
            st.markdown('<div class="tiny">Agent는 조회·분석·권고만 수행합니다.</div>',unsafe_allow_html=True)
        with st.expander("Data Hub · 지식 탐색"):
            counts = repository.table_counts()
            selected_table = st.selectbox("읽기 전용 테이블", [row["table"] for row in counts], key="data_table")
            selected_count = next(row["rows"] for row in counts if row["table"] == selected_table)
            st.caption(f"{selected_count}개 레코드 · demo_data")
            rows = repository.browse_table(selected_table, 20, 0)
            if rows:
                st.dataframe(rows, hide_index=True, width="stretch")
            else:
                st.info("표시할 레코드가 없습니다.")

    with chat:
        with st.container(border=True,height=690):
            st.markdown("#### Agent 대화")
            if not agent: st.info("API 키를 설정하면 자연어 대화를 시작할 수 있습니다. 추천질문과 현장 상황은 미리 볼 수 있습니다.")
            for msg in st.session_state.messages:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"]); grounds=list(msg.get("sources",[]))
                    if msg.get("data_tools"): grounds.append(source_label+": "+", ".join(msg["data_tools"]))
                    if grounds: st.caption("근거 · "+" · ".join(grounds))
                    if msg.get("evidence"):
                        with st.expander("검색 문서 근거"):
                            for evidence in msg["evidence"]: st.markdown(f"**{evidence['filename']}**"); st.write(evidence.get("text") or "검색 텍스트 미제공")
                    if msg.get("role") == "assistant" and msg.get("searched_documents") is False:
                        st.caption("⚠️ 이 답변에서는 지식문서 검색이 실행되지 않았습니다.")
        typed=st.chat_input(chat_placeholder,disabled=agent is None)

    question=st.session_state.pop("pending_question",None) or typed
    if question:
        if not agent: st.toast("질문을 실행하려면 API 키를 먼저 설정하세요.",icon="🔑")
        else:
            st.session_state.messages.append({"role":"user","content":question,"created_at":timestamp()})
            try:
                answer=agent.ask(question,vector_store_id=st.session_state.vector_store_id,previous_response_id=st.session_state.previous_response_id,max_results=max_results)
                st.session_state.messages.append({"role":"assistant","content":answer.text,"sources":answer.sources,"evidence":answer.evidence,"data_tools":answer.data_tools,"searched_documents":answer.searched_documents,"created_at":timestamp()}); st.session_state.previous_response_id=answer.response_id
            except Exception as exc: st.session_state.messages.append({"role":"assistant","content":f"답변 생성에 실패했습니다: {exc}","created_at":timestamp()})
            st.rerun()
