import json
import pytest
from fastapi.testclient import TestClient
from v2.api import create_app, EvidenceRegistry
from v2.compat import KkotsuniV2Repository, QUESTION_GROUPS

@pytest.fixture
def client(tmp_path, monkeypatch):
    for key in ('OPENAI_API_KEY', 'COCKPIT_ACCESS_TOKEN', 'V2_REQUIRE_LOGIN', 'DATABASE_URL'):
        monkeypatch.delenv(key, raising=False)
    repo = KkotsuniV2Repository(tmp_path / 'test.db')
    with TestClient(create_app(repo)) as c:
        yield c


def test_workspace_and_sources(client):
    data = client.get('/api/workspace').json()
    assert data['meta']['company'] == '평창꽃순이김치'
    assert data['meta']['demo_data'] and not data['meta']['ai_configured']
    assert len(data['tables']) == 11
    assert data['fermentation'] == []
    for table in data['tables']:
        assert client.get('/api/tables/' + table['table']).status_code == 200
    docs = client.get('/api/documents').json()
    assert docs and all(d['content'] and '승인' in d['status'] for d in docs)
    assert client.get('/').status_code == 200


def test_lot_evidence_tracks_upstream(client):
    detail = client.get('/api/lots/PACK-260904-01').json()
    assert detail['trace'][0]['lot_id'] == 'RAW-260904-01'
    assert detail['ccp'][0]['lot_id'] == 'WASH-260904-01'
    assert detail['metal'][0]['result'] == '보류'
    answer = client.post('/api/chat', json={'question': 'PACK-260904-01의 CCP와 금속검출 확인', 'mode': 'demo'}).json()
    assert '72' in answer['text'] and '보류' in answer['text']
    assert answer['mode'] == 'demo' and answer['demo_data']
    assert any(r.get('movement_id') for r in answer['records'])

@pytest.mark.parametrize('url,expected', [('/api/lots/UNKNOWN',404),('/api/tables/v2_users',400),('/api/tables/lots?limit=101',422),('/api/tables/lots?offset=-1',422)])
def test_invalid_reads(client,url,expected):
    assert client.get(url).status_code == expected


def test_questions_and_reset(client):
    for questions in QUESTION_GROUPS.values():
        for question in questions:
            result = client.post('/api/chat',json={'question':question,'mode':'demo'})
            assert result.status_code == 200
            answer = result.json()
            assert answer['evidence'] or answer['records']
            assert '2026-09-04' in answer['text']
    assert client.post('/api/chat/reset').status_code == 200
    assert client.post('/api/chat',json={'question':'   '}).status_code == 422
    assert client.post('/api/chat',json={'question':'PACK-999999-99 확인'}).status_code == 404
    assert client.post('/api/chat',json={'question':'PACK-260904-03 확인','lot_id':'PACK-260904-01'}).status_code == 422


def test_paid_gates_and_origin(client, monkeypatch):
    assert client.post('/api/chat',json={'question':'CCP','mode':'ai'}).status_code == 503
    monkeypatch.setenv('OPENAI_API_KEY','test-server-secret')
    monkeypatch.setenv('COCKPIT_ACCESS_TOKEN','access-secret')
    with TestClient(create_app(client.app.state.repo),base_url='https://factory.example') as external:
        response = external.post('/api/chat',json={'question':'CCP','mode':'ai'})
        assert response.status_code == 401
        workspace = external.get('/api/workspace').text
        assert 'test-server-secret' not in workspace and 'access-secret' not in workspace
        assert external.post('/api/realtime/tool',json={'name':'get_orders','arguments':{}}).status_code == 401
    assert client.post('/api/chat/reset',headers={'Origin':'https://evil.example'}).status_code == 403


def test_voice_read_only_registry(client,monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY','test-key')
    result = client.post('/api/realtime/tool',json={'name':'get_wash_ccp_status','arguments':{'lot_id':'WASH-260904-01','deviations_only':False}})
    assert result.status_code == 200
    assert json.loads(result.json()['output'])['result'][0]['peroxide_ppm'] == 72
    assert client.post('/api/realtime/tool',json={'name':'delete_lot','arguments':{}}).status_code == 400
    registry = EvidenceRegistry(client.app.state.repo)
    registry.execute('get_metal_detection',{'lot_id':'PACK-260904-01','issues_only':True})
    assert registry.records[0]['result'] == '보류'


def test_demo_filters_pending_movement(client):
    answer = client.post('/api/chat', json={'question':'PDA 미확정 이동을 확인해줘','mode':'demo'}).json()
    assert len(answer['records']) == 1
    assert answer['records'][0]['movement_id'] == 'MV-003'
    assert '640.0kg' in answer['text']


def test_connection_check_is_local_and_does_not_call_provider(client, monkeypatch):
    assert client.get('/api/connection').status_code == 503
    monkeypatch.setenv('OPENAI_API_KEY', 'fake-server-key')
    monkeypatch.setenv('COCKPIT_ACCESS_TOKEN', 'correct-code')
    import openai
    monkeypatch.setattr(openai, 'OpenAI', lambda **kwargs: pytest.fail('No paid provider call expected'))
    assert client.get('/api/connection').json()['provider_verified'] is False
    with TestClient(create_app(client.app.state.repo), base_url='https://factory.example') as external:
        assert external.get('/api/connection').status_code == 401
        assert external.get('/api/connection', headers={'Authorization':'Bearer wrong'}).status_code == 401
        result = external.get('/api/connection', headers={'Authorization':'Bearer correct-code'})
        assert result.status_code == 200 and result.json()['status'] == 'ready'
        assert 'fake-server-key' not in result.text


def test_ai_receives_upstream_records_and_keeps_sample_date(client, monkeypatch):
    from kkotsuni_agent.service import AgentAnswer
    import openai
    import v2.api as api
    monkeypatch.setenv('OPENAI_API_KEY', 'fake-key')
    calls = []
    class FakeClient:
        def close(self):
            calls.append('closed')
    class FakeAgent:
        def __init__(self, client, model, factory_tools):
            pass
        def ask(self, question, previous_response_id):
            assert 'WASH-260904-01' in question
            assert 'peroxide_ppm' in question and '72.0' in question
            assert '보류' in question and '2026-09-04' in question
            return AgentAnswer('샘플 확인.\n근거: 사전 조회 기록', [], [], 'private-provider-id', [])
    monkeypatch.setattr(openai, 'OpenAI', lambda **kwargs: FakeClient())
    monkeypatch.setattr(api, 'ManufacturingAgent', FakeAgent)
    response = client.post('/api/chat',json={'question':'출하 확인사항', 'lot_id':'PACK-260904-01','mode':'ai'})
    assert response.status_code == 200
    answer = response.json()
    assert answer['context']['as_of'] == '2026-09-04'
    assert any(r.get('check_id') == 'CCP-W-001' for r in answer['records'])
    assert any(r.get('inspection_id') == 'MD-260904-01' for r in answer['records'])
    assert answer['demo_data'] and 'private-provider-id' not in response.text
    assert calls == ['closed']
