import json
import pytest
from v2.compat import KkotsuniV2Repository
from v2.daily import SAMPLE_DATE, daily_answer
from kkotsuni_agent.factory_tools import KkotsuniToolRegistry

@pytest.fixture
def repo(tmp_path, monkeypatch):
    monkeypatch.setattr('v2.daily.today_kst', lambda: SAMPLE_DATE)
    return KkotsuniV2Repository(tmp_path / 'daily.db')


def test_daily_stock_is_separate_from_legacy_inventory(repo):
    answer = daily_answer(repo, '오늘의 재고는 어떻게 돼?')
    assert len(answer['records']) == 6
    assert '3,170kg' in answer['text'] and '3,770kg' in answer['text']
    assert '무 650kg' in answer['text'] and '총각김치 420kg' in answer['text']
    assert all(r['business_date'] == SAMPLE_DATE for r in answer['records'])
    assert len(repo.inventory_status()) == 4


def test_plan_is_not_production_or_actuals(repo):
    answer = daily_answer(repo, '오늘은 출하계획은 어떻게 돼?')
    assert len(answer['records']) == 4 and '2,200kg' in answer['text']
    assert all('planned_at' in r for r in answer['records'])
    assert '생산계획' not in answer['text']


def test_actuals_include_partial_dispatch_and_plan_evidence(repo):
    answer = daily_answer(repo, '오늘의 실제 출하현황을 어떻게 돼?')
    assert '1,200kg' in answer['text'] and '54.5%' in answer['text'] and '미출하 1,000kg' in answer['text']
    actuals = [r for r in answer['records'] if 'dispatch_id' in r]
    assert len(actuals) == 2
    assert sum(r['quantity_kg'] for r in actuals) == 1200
    plans = {r['plan_id']: r for r in answer['records'] if 'planned_at' in r}
    assert all(r['plan_id'] in plans for r in actuals)
    assert actuals[1]['quantity_kg'] < plans[actuals[1]['plan_id']]['quantity_kg']


def test_no_silent_date_rollover_or_lot_mixing(repo, monkeypatch):
    monkeypatch.setattr('v2.daily.today_kst', lambda: '2026-10-09')
    answer = daily_answer(repo, '오늘의 재고는 어떻게 돼?')
    assert answer['records'] == [] and '기록이 없습니다' in answer['text']
    assert daily_answer(repo, '2026-10-08 실제 출하현황')['records']
    assert daily_answer(repo, '오늘의 재고는 어떻게 돼?', 'PACK-260904-01')['records'] == []


def test_seed_idempotence_and_read_only_tool(repo):
    counts = repo.table_counts()
    KkotsuniV2Repository(repo.db_path)
    assert counts == repo.table_counts()
    registry = KkotsuniToolRegistry(repo)
    result = json.loads(registry.execute('get_daily_operations', {'kind':'actuals', 'date':SAMPLE_DATE}))
    assert result['demo_data'] and len(result['result']) == 2
    assert 'error' in json.loads(registry.execute('get_daily_operations', {'kind':'drop table', 'date':SAMPLE_DATE}))
