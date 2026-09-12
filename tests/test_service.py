from types import SimpleNamespace

import pytest

from kkotsuni_agent import KkotsuniRepository, KkotsuniToolRegistry, ManufacturingAgent


class FakeResponses:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            call = SimpleNamespace(type="function_call", name="get_wash_ccp_status", call_id="call-1",
                                   arguments='{"lot_id":"WASH-260904-01","deviations_only":true}')
            return SimpleNamespace(id="resp-1", output=[call], output_text="")
        return SimpleNamespace(id="resp-2", output=[], output_text="세척 CCP 주의 건이 1건입니다.")


class FakeClient:
    def __init__(self):
        self.responses = FakeResponses()


def test_agent_executes_read_only_tool_loop(tmp_path):
    client = FakeClient()
    registry = KkotsuniToolRegistry(KkotsuniRepository(tmp_path / "demo.db"))
    answer = ManufacturingAgent(client, factory_tools=registry).ask("세척 CCP 주의 건은?")
    assert answer.data_tools == ["get_wash_ccp_status"]
    assert answer.response_id == "resp-2"
    assert client.responses.calls[1]["input"][0]["type"] == "function_call_output"


def test_agent_rejects_blank_question(tmp_path):
    registry = KkotsuniToolRegistry(KkotsuniRepository(tmp_path / "demo.db"))
    with pytest.raises(ValueError):
        ManufacturingAgent(FakeClient(), factory_tools=registry).ask("  ")


class KnowledgeResponses:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            call = SimpleNamespace(type="function_call", name="search_knowledge", call_id="call-kb",
                                   arguments='{"query":"세척 CCP 이탈","limit":3}')
            return SimpleNamespace(id="resp-kb-1", output=[call], output_text="")
        return SimpleNamespace(id="resp-kb-2", output=[], output_text="문서 기준은 샘플이며 담당자 승인이 필요합니다.")


def test_local_knowledge_evidence_is_preserved(tmp_path):
    client = SimpleNamespace(responses=KnowledgeResponses())
    registry = KkotsuniToolRegistry(KkotsuniRepository(tmp_path / "demo.db"))
    answer = ManufacturingAgent(client, factory_tools=registry).ask("세척 CCP 이탈 절차는?")
    assert answer.searched_documents is True
    assert answer.evidence
    assert "KKT-KB-001_wash_ccp.md" in answer.sources
