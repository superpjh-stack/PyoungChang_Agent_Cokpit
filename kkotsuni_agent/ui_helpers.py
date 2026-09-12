from __future__ import annotations

from datetime import datetime
from typing import Any


QUESTION_GROUPS = {
    "지식문서": [
        "자동버블세척 CCP 기록 항목과 이탈 대응 절차를 문서에서 찾아줘",
        "금속검출 보류 LOT의 격리·재검사·승인 절차를 알려줘",
        "PDA 재고이동 미확정 건의 확인 절차를 알려줘",
        "완제품 출하 전에 확인할 품질 승인 항목을 알려줘",
        "수주 기반 생산계획 작성 순서를 알려줘",
        "외국인 작업자용 안내문 작성 원칙을 알려줘",
        "세척 측정기 교정상태는 어디에 기록해야 하는지 알려줘",
        "택배·거래처 배송·B2C 주문과 LOT 연결 원칙을 알려줘",
        "문서 중 아직 미승인 샘플인 기준을 구분해줘",
        "현재 등록된 제조 지식문서와 담당자를 요약해줘",
    ],
    "MES·LOT": [
        "오늘 생산계획·CCP·금속검출·재고·출하 위험을 우선순위로 브리핑해줘",
        "오늘 사람이 승인해야 할 항목과 담당자를 정리해줘",
        "WASH-260904-01의 과산화수소 농도·물량·접촉시간을 확인해줘",
        "오늘 수주와 납기를 기준으로 생산계획 진행상태를 알려줘",
        "원료 부족이 생산계획에 미치는 영향을 알려줘",
        "PDA 미확정 재고이동과 현재고 차이 위험을 알려줘",
        "택배·배송·B2C 출하 승인대기 건을 정리해줘",
        "PACK-260904-01을 원재료까지 역추적하고 CCP·금속검출 결과를 알려줘",
        "금속검출 보류 LOT의 품질 확인사항을 알려줘",
        "자동버블세척기와 금속검출기의 데모 연계 상태를 알려줘",
    ],
    "판단규칙": [
        "세척 CCP 주의 규칙의 담당자와 다음 조치를 알려줘",
        "금속검출 보류 규칙이 적용되는 데모 데이터를 찾아줘",
        "안전재고 부족 규칙과 생산계획 영향 확인 순서를 알려줘",
        "PDA 이동 미확정 규칙의 담당자와 승인사항을 알려줘",
        "출하 승인대기 규칙과 연결 문서를 알려줘",
        "원료대기 생산계획의 후속조치 규칙을 알려줘",
        "다국어 작업안내 승인 규칙을 쉬운 한국어로 설명해줘",
        "오늘 데이터에 걸리는 샘플 규칙을 위험순으로 정리해줘",
        "규칙별 원본 테이블과 근거 문서를 표로 요약해줘",
        "자동 실행하면 안 되는 조치와 사람 승인자를 알려줘",
    ],
}

WELCOME_MESSAGE = {
    "role": "assistant",
    "content": "안녕하세요. 평창꽃순이김치 제조 Agent입니다.  \n수주·생산계획, 자동버블세척 CCP, 원재료 PDA 이동, 금속검출, 완제품재고와 택배·배송·B2C 출하를 LOT로 연결합니다.",
    "sources": [], "evidence": [], "data_tools": [], "created_at": "시작",
}


def timestamp() -> str:
    return datetime.now().strftime("%H:%M")


def user_question_history(messages: list[dict[str, Any]], limit: int = 8) -> list[dict[str, str]]:
    return [{"content": str(message.get("content", "")), "created_at": str(message.get("created_at", ""))}
            for message in reversed(messages) if message.get("role") == "user"][:limit]


def lot_snapshot(repository: Any, lot_id: str) -> dict[str, Any]:
    lot = next((row for row in repository.all_lots() if row["lot_id"] == lot_id), {})
    trace = repository.lot_trace(lot_id)
    related_ids = {row["lot_id"] for row in trace}
    ccp = [row for row in repository.ccp_status(None, False) if row["lot_id"] in related_ids]
    metal = [row for row in repository.metal_detection(None, False) if row["lot_id"] in related_ids]
    shipments = [row for row in repository.shipment_status(None, False) if row.get("pack_lot") == lot_id]
    movements = [row for row in repository.pda_movements(None) if row.get("lot_id") in related_ids]
    return {"lot": lot, "trace": trace, "ccp": ccp, "metal": metal, "shipments": shipments, "movements": movements}


def risk_label(snapshot: dict[str, Any]) -> tuple[str, str]:
    ccp_issue = any(row.get("result") != "적합" for row in snapshot["ccp"])
    metal_issue = any(row.get("result") != "적합" for row in snapshot["metal"])
    pending = any(row.get("quality_approval") != "승인" for row in snapshot["shipments"])
    pda_gap = any(row.get("capture_status") != "정상" for row in snapshot["movements"])
    score = int(ccp_issue) * 2 + int(metal_issue) * 2 + int(pending) + int(pda_gap)
    return ("높음", "🔴") if score >= 3 else (("주의", "🟠") if score else ("안정", "🟢"))
