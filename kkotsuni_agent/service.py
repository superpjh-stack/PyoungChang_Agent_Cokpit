from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .citations import extract_evidence, extract_sources
from .factory_tools import KkotsuniToolRegistry
from .prompts import AGENT_INSTRUCTIONS


@dataclass(frozen=True)
class AgentAnswer:
    text: str
    sources: list[str]
    evidence: list[dict[str, Any]]
    response_id: str | None
    data_tools: list[str]
    searched_documents: bool = False
    tool_rounds: int = 0
    knowledge_base_connected: bool = False


class ManufacturingAgent:
    def __init__(self, client: Any, model: str = "gpt-5.6", factory_tools: KkotsuniToolRegistry | None = None) -> None:
        self.client = client
        self.model = model
        self.factory_tools = factory_tools

    def create_knowledge_base(self, name: str = "평창꽃순이김치 제조 지식베이스") -> str:
        return self.client.vector_stores.create(name=name).id

    def add_file(self, vector_store_id: str, file_path: str | Path) -> Any:
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(path)
        with path.open("rb") as handle:
            return self.client.vector_stores.files.upload_and_poll(vector_store_id=vector_store_id, file=handle)

    def ask(self, question: str, vector_store_id: str | None = None,
            previous_response_id: str | None = None, max_results: int = 6) -> AgentAnswer:
        if not question.strip():
            raise ValueError("질문을 입력해 주세요.")
        tools: list[dict[str, Any]] = []
        include: list[str] = []
        if self.factory_tools:
            tools.extend(self.factory_tools.definitions)
        if vector_store_id:
            tools.append({"type": "file_search", "vector_store_ids": [vector_store_id], "max_num_results": max_results})
            include.append("file_search_call.results")
        if not tools:
            raise ValueError("Data Hub 또는 지식문서를 연결해 주세요.")
        request: dict[str, Any] = {"model": self.model, "instructions": AGENT_INSTRUCTIONS,
                                   "input": question.strip(), "tools": tools, "parallel_tool_calls": False}
        if previous_response_id:
            request["previous_response_id"] = previous_response_id
        if include:
            request["include"] = include
        response = self.client.responses.create(**request)
        used_tools: list[str] = []
        sources: list[str] = []
        evidence: list[dict[str, Any]] = []
        searched_documents = False
        tool_rounds = 0

        def merge_response(current: Any) -> None:
            nonlocal searched_documents
            searched_documents = searched_documents or any(
                getattr(item, "type", None) == "file_search_call" for item in getattr(current, "output", [])
            )
            for source in extract_sources(current):
                if source not in sources:
                    sources.append(source)
            for item in extract_evidence(current, limit=max_results):
                marker = (item.get("filename"), item.get("text"))
                if marker not in {(row.get("filename"), row.get("text")) for row in evidence}:
                    evidence.append(item)

        merge_response(response)
        for round_index in range(4):
            calls = [item for item in getattr(response, "output", []) if getattr(item, "type", None) == "function_call"]
            if not calls:
                break
            tool_rounds += 1
            outputs = []
            for call in calls:
                used_tools.append(call.name)
                searched_documents = searched_documents or call.name == "search_knowledge"
                result = self.factory_tools.execute(call.name, call.arguments) if self.factory_tools else '{"error":"Data Hub not connected"}'
                if call.name == "search_knowledge":
                    try:
                        for row in json.loads(result).get("result", []):
                            item = {"filename": row.get("filename", row.get("document_id", "로컬 문서")),
                                    "score": row.get("score"), "text": row.get("body", "")[:900],
                                    "document_id": row.get("document_id"), "status": row.get("status")}
                            if (item["filename"], item["text"]) not in {(e.get("filename"), e.get("text")) for e in evidence}:
                                evidence.append(item)
                            if item["filename"] not in sources:
                                sources.append(item["filename"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                outputs.append({"type": "function_call_output", "call_id": call.call_id, "output": result})
            follow_up: dict[str, Any] = {"model": self.model, "instructions": AGENT_INSTRUCTIONS,
                                         "previous_response_id": response.id, "input": outputs,
                                         "tools": tools, "parallel_tool_calls": False}
            if include:
                follow_up["include"] = include
            if round_index == 3:
                follow_up["tool_choice"] = "none"
            response = self.client.responses.create(**follow_up)
            merge_response(response)
        answer_text = getattr(response, "output_text", "") or "근거 조회는 완료했지만 답변 문장을 생성하지 못했습니다. 다시 질문해 주세요."
        return AgentAnswer(answer_text, sources, evidence[:max_results], getattr(response, "id", None),
                           list(dict.fromkeys(used_tools)), searched_documents,
                           tool_rounds, bool(vector_store_id or self.factory_tools))
