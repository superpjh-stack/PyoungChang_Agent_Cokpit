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
    monkeypatch.setattr('v2.daily.today_kst', lambda: '2026-10-10')
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


def test_month_coverage_and_shipment_integrity(repo):
    from datetime import date, timedelta
    start = date(2026, 9, 9)
    inventory_totals = set()
    for offset in range(31):
        day = (start + timedelta(days=offset)).isoformat()
        stock = repo.daily_operations('inventory', day)
        plans = repo.daily_operations('plans', day)
        actuals = repo.daily_operations('actuals', day)
        assert (len(stock), len(plans), len(actuals)) == (6, 4, 2)
        assert all(r['source'] == 'demo_data' and r['business_date'] == day for r in stock + plans + actuals)
        assert all(r['quantity'] >= 0 for r in stock)
        inventory_totals.add(sum(r['quantity'] for r in stock))
        by_id = {r['plan_id']: r for r in plans}
        for row in actuals:
            plan = by_id[row['plan_id']]
            assert 0 < row['quantity_kg'] <= plan['quantity_kg']
            assert row['product_name'] == plan['product_name']
            assert row['channel'] == plan['channel']
            assert row['shipped_at'] >= plan['planned_at']
        assert actuals[1]['quantity_kg'] < by_id[actuals[1]['plan_id']]['quantity_kg']
        assert len(daily_answer(repo, f'{day} 재고현황')['records']) == 6
    assert len(inventory_totals) == 31
    assert not repo.daily_operations('inventory', '2026-09-08')
    assert not repo.daily_operations('inventory', '2026-10-10')


def test_seed_preserves_existing_rows(repo):
    with repo._connect() as connection:
        connection.execute("UPDATE daily_inventory SET quantity=1234 WHERE snapshot_id='DEMO-2026-10-08-RM-CABBAGE'")
    KkotsuniV2Repository(repo.db_path)
    rows = repo.daily_operations('inventory', SAMPLE_DATE)
    assert next(r for r in rows if r['item_code'] == 'RM-CABBAGE')['quantity'] == 1234
