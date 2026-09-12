from __future__ import annotations

import json
from typing import Any, Callable

from .data_hub import KkotsuniRepository


def nullable_string(description: str) -> dict[str, Any]:
    return {"type": ["string", "null"], "description": description}


class KkotsuniToolRegistry:
    def __init__(self, repository: KkotsuniRepository) -> None:
        self.repository = repository
        self.handlers: dict[str, Callable[..., Any]] = {
            "get_orders": repository.orders,
            "get_production_plans": repository.production_plans,
            "get_lot_trace": repository.lot_trace,
            "get_wash_ccp_status": repository.ccp_status,
            "get_metal_detection": repository.metal_detection,
            "get_inventory_status": repository.inventory_status,
            "get_pda_movements": repository.pda_movements,
            "get_shipment_status": repository.shipment_status,
            "get_equipment_status": repository.equipment_status,
            "get_rules": repository.rules,
            "search_knowledge": repository.search_knowledge,
            "browse_data_table": repository.browse_table,
        }

    @property
    def definitions(self) -> list[dict[str, Any]]:
        specs = [
            ("get_orders", "B2B·택배·온라인몰 수주와 납기·우선순위를 조회한다.", {"order_no": nullable_string("주문번호, 전체이면 null")}),
            ("get_production_plans", "수주에 연결된 일자별 생산계획과 실적·진척을 조회한다.", {"date": nullable_string("생산일 YYYY-MM-DD, 전체이면 null")}),
            ("get_lot_trace", "원재료 입고부터 세척·절임·혼합·충진·금속검출·포장까지 LOT 계보를 조회한다.", {"lot_id": {"type": "string", "description": "정확한 LOT ID"}}),
            ("get_wash_ccp_status", "자동버블세척의 과산화수소 농도·물량·접촉시간과 CCP 결과를 조회한다.", {"lot_id": nullable_string("세척 LOT ID, 전체이면 null"), "deviations_only": {"type": "boolean", "description": "주의·이탈만 조회할지"}}),
            ("get_metal_detection", "금속검출기별 검사수량·불합격수량·보류 상태를 조회한다.", {"lot_id": nullable_string("포장 LOT ID, 전체이면 null"), "issues_only": {"type": "boolean", "description": "보류·부적합만 조회할지"}}),
            ("get_inventory_status", "원재료·완제품의 위치·현재고·안전재고 부족을 조회한다.", {"item": nullable_string("품목명, 전체이면 null"), "shortage_only": {"type": "boolean", "description": "부족 품목만 조회할지"}}),
            ("get_pda_movements", "PDA로 기록된 원재료·완제품 이동과 미확정 이력을 조회한다.", {"item_code": nullable_string("품목코드, 전체이면 null")}),
            ("get_shipment_status", "택배·배송·온라인몰 출하와 품질 승인 상태를 조회한다.", {"order_no": nullable_string("주문번호, 전체이면 null"), "pending_only": {"type": "boolean", "description": "승인대기·미승인만 조회할지"}}),
            ("get_equipment_status", "자동버블세척기·금속검출기·저울·냉장고 센서·포장설비의 연계 상태를 조회한다.", {"equipment_type": nullable_string("설비 유형, 전체이면 null")}),
            ("get_rules", "CCP·품질·재고·생산·출하 관련 샘플 판단 규칙과 담당자·후속조치를 조회한다.", {"source_table": nullable_string("연결 테이블명, 전체이면 null"), "active_only": {"type": "boolean", "description": "폐기되지 않은 규칙만 조회할지"}}),
            ("search_knowledge", "승인 상태와 출처가 표시된 로컬 제조·HACCP 지식문서를 검색한다.", {"query": {"type": "string", "description": "절차·기준·검사·승인 관련 검색어"}, "limit": {"type": "integer", "minimum": 1, "maximum": 10, "description": "최대 검색 건수"}}),
            ("browse_data_table", "화이트리스트에 등록된 데모 Data Hub 테이블을 읽기 전용으로 조회한다.", {"table": {"type": "string", "enum": list(self.repository.BROWSEABLE_TABLES)}, "limit": {"type": "integer", "minimum": 1, "maximum": 200}, "offset": {"type": "integer", "minimum": 0}}),
        ]
        return [{"type": "function", "name": name, "description": description, "strict": True,
                 "parameters": {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}}
                for name, description, properties in specs]

    def execute(self, name: str, arguments: str | dict[str, Any]) -> str:
        if name not in self.handlers:
            return json.dumps({"error": f"허용되지 않은 읽기 도구: {name}"}, ensure_ascii=False)
        try:
            values = json.loads(arguments) if isinstance(arguments, str) else arguments
            result = self.handlers[name](**values)
            return json.dumps({"status": "ok", "demo_data": True, "source": "평창꽃순이김치 MES/Data Hub", "provenance": "demo_data", "tool": name, "result": result}, ensure_ascii=False, default=str)
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            return json.dumps({"error": str(exc), "tool": name}, ensure_ascii=False)
