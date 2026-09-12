import json

from kkotsuni_agent import KkotsuniRepository, KkotsuniToolRegistry


def test_dashboard_and_production_plan(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    dashboard = repo.dashboard("2026-09-04")
    assert dashboard["planned_kg"] == 2100
    assert dashboard["ccp_alerts"] == 1
    assert dashboard["metal_holds"] == 1
    assert dashboard["provenance"] == "demo_data"


def test_lot_trace_and_ccp_are_linked(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    trace = repo.lot_trace("PACK-260904-01")
    assert trace[0]["lot_id"] == "RAW-260904-01"
    assert trace[-1]["lot_id"] == "PACK-260904-01"
    assert any(row["process"] == "자동버블세척" for row in trace)
    assert repo.ccp_status("WASH-260904-01", True)[0]["result"] == "주의"


def test_inventory_pda_and_shipping_exceptions(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    shortages = repo.inventory_status(None, True)
    assert {row["item_name"] for row in shortages} == {"배추", "맛김치"}
    assert any(row["capture_status"] == "PDA 미확정" for row in repo.pda_movements(None))
    assert len(repo.shipment_status(None, True)) == 2


def test_registry_is_strict_and_read_only(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    registry = KkotsuniToolRegistry(repo)
    assert len(registry.definitions) == 12
    assert all(tool["strict"] and tool["parameters"]["additionalProperties"] is False for tool in registry.definitions)
    assert all(not any(word in tool["name"] for word in ["approve", "release", "stop", "write", "update"]) for tool in registry.definitions)
    blocked = json.loads(registry.execute("approve_shipment", {}))
    assert "error" in blocked


def test_local_knowledge_rules_and_table_whitelist(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    results = repo.search_knowledge("세척 CCP 이탈", 5)
    assert results
    assert any(row["document_id"] == "KKT-KB-001" for row in results)
    assert len(repo.rules()) >= 7
    assert all(rule["source_document"] for rule in repo.rules())
    assert repo.browse_table("orders", 2, 0)
    try:
        repo.browse_table("sqlite_master")
        assert False, "화이트리스트 밖 테이블을 허용하면 안 됩니다."
    except ValueError:
        pass


def test_equipment_counts_are_labeled_as_demo(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    assert len(repo.equipment_status("자동버블세척기")) == 4
    assert len(repo.equipment_status("금속검출기")) == 2
    assert all("연계" in row["interface_status"] for row in repo.equipment_status(None))
