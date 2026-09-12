from kkotsuni_agent import KkotsuniRepository, QUESTION_GROUPS, lot_snapshot, risk_label, user_question_history


def test_cockpit_helpers(tmp_path):
    repo = KkotsuniRepository(tmp_path / "demo.db")
    snapshot = lot_snapshot(repo, "PACK-260904-01")
    assert snapshot["trace"][0]["process"] == "원재료 입고·보관"
    assert snapshot["metal"][0]["result"] == "보류"
    assert risk_label(snapshot) == ("높음", "🔴")
    assert set(QUESTION_GROUPS) == {"지식문서", "MES·LOT", "판단규칙"}
    assert all(len(questions) == 10 for questions in QUESTION_GROUPS.values())
    history = user_question_history([{"role": "assistant", "content": "안내"}, {"role": "user", "content": "CCP", "created_at": "10:00"}])
    assert history == [{"content": "CCP", "created_at": "10:00"}]
