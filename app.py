from pathlib import Path

from cockpit_runtime import render_cockpit
from kkotsuni_agent import (DEMO_DATE, QUESTION_GROUPS, WELCOME_MESSAGE, KkotsuniRepository,
                            KkotsuniToolRegistry, ManufacturingAgent, lot_snapshot, risk_label,
                            timestamp, user_question_history)


BASE_DIR = Path(__file__).parent
repository = KkotsuniRepository(BASE_DIR / "data" / "kkotsuni_demo.db")
registry = KkotsuniToolRegistry(repository)
kpi = repository.dashboard(DEMO_DATE)


def agent_factory(client, model, tools):
    return ManufacturingAgent(client, model=model, factory_tools=tools)


def snapshot(lot_id):
    data = lot_snapshot(repository, lot_id)
    lot = data["lot"]
    risk, icon = risk_label(data)
    approvals = []
    if any(row.get("result") != "적합" for row in data["ccp"]):
        approvals.append("HACCP·품질: 세척 CCP 판정")
    if any(row.get("result") != "적합" for row in data["metal"]):
        approvals.append("품질·생산: 금속검출 보류 처분")
    if any(row.get("capture_status") != "정상" for row in data["movements"]):
        approvals.append("자재·물류: PDA 이동 확정")
    if any(row.get("quality_approval") != "승인" for row in data["shipments"]):
        approvals.append("품질·물류: 출하 승인")
    return {
        "risk": risk,
        "icon": icon,
        "primary_label": "제품·공정",
        "primary": f"{lot.get('product_name', '-')} · {lot.get('process', '-')}",
        "progress": None,
        "caption": f"상태 {lot.get('status', '-')} · {lot.get('quantity_kg', 0):,.0f} kg",
        "counts": [("계보", len(data["trace"])), ("CCP", len(data["ccp"])), ("검출", len(data["metal"]))],
        "approvals": approvals,
        "brief": f"{lot_id}의 원재료 계보·세척 CCP·금속검출·PDA 이동·완제품재고·출하 승인사항을 브리핑해줘",
    }


render_cockpit(
    base_dir=BASE_DIR,
    page_title="평창꽃순이김치 Agent Cockpit",
    icon="🥬",
    title="평창꽃순이김치 AI Agent",
    subtitle="세척수 한 방울부터 출하 한 상자까지, 수주·CCP·LOT·재고의 흐름을 한 대화로 잇습니다.",
    repository=repository,
    registry=registry,
    agent_factory=agent_factory,
    question_groups=QUESTION_GROUPS,
    welcome_message=WELCOME_MESSAGE,
    timestamp=timestamp,
    history_fn=user_question_history,
    metrics=[
        ("오늘 계획", f"{kpi['planned_kg']:,.0f} kg"),
        ("현재 실적", f"{kpi['actual_kg']:,.0f} kg"),
        ("진척률", f"{kpi['completion_rate']}%"),
        ("CCP 주의", f"{kpi['ccp_alerts']}건"),
        ("금속검출 보류", f"{kpi['metal_holds']}건"),
        ("출하 승인대기", f"{kpi['shipment_pending']}건"),
    ],
    entity_label="LOT",
    entity_ids=[row["lot_id"] for row in repository.all_lots()],
    snapshot_builder=snapshot,
    knowledge_label="HACCP·세척기준·생산·포장·다국어 작업안내",
    knowledge_base_name="평창꽃순이김치 제조 지식베이스",
    source_label="평창꽃순이김치 MES/Data Hub",
    chat_placeholder="수주·생산계획·CCP·LOT·재고·출하에 질문하세요",
    safety_note="수치와 설비상태는 데모입니다. CCP 판정·계획 확정·재고조정·설비제어·출하는 사람 승인 없이 실행하지 않습니다.",
)
