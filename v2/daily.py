"""Dated, explicitly synthetic logistics examples. Never roll old rows into today."""
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

SAMPLE_DATE = '2026-10-08'  # Preserve the original snapshot and its IDs.
SAMPLE_START = '2026-09-09'
SAMPLE_END = '2026-10-09'
SAMPLE_RANGE = f'{SAMPLE_START}~{SAMPLE_END}'
TOP_QUESTIONS = ['오늘의 재고는 어떻게 돼?', '오늘은 출하계획은 어떻게 돼?', '오늘의 실제 출하현황을 어떻게 돼?']
DAILY_LABELS = {'daily_inventory': '일별 재고 스냅샷', 'shipment_plans': '일별 출하계획', 'shipment_actuals': '실제 출하실적 기록'}


def today_kst():
    return datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()


def seed_daily(connection):
    connection.executescript('''
        CREATE TABLE IF NOT EXISTS daily_inventory (
            snapshot_id TEXT PRIMARY KEY, business_date TEXT, item_code TEXT,
            item_name TEXT, item_type TEXT, quantity REAL, unit TEXT,
            safety_stock REAL, location TEXT, updated_at TEXT, source TEXT);
        CREATE TABLE IF NOT EXISTS shipment_plans (
            plan_id TEXT PRIMARY KEY, business_date TEXT, product_name TEXT,
            channel TEXT, quantity_kg REAL, planned_at TEXT,
            quality_approval TEXT, source TEXT);
        CREATE TABLE IF NOT EXISTS shipment_actuals (
            dispatch_id TEXT PRIMARY KEY, plan_id TEXT, business_date TEXT,
            product_name TEXT, channel TEXT, quantity_kg REAL,
            shipped_at TEXT, status TEXT, source TEXT);
    ''')
    current = date.fromisoformat(SAMPLE_START)
    while current <= date.fromisoformat(SAMPLE_END):
        _seed_day(connection, current)
        current += timedelta(days=1)


def _seed_day(connection, day):
    business_date = day.isoformat()
    date_id = day.strftime('%y%m%d')
    offset = (day - date.fromisoformat(SAMPLE_DATE)).days
    # Fixed historical examples, never regenerated relative to the server clock.
    stock_factor = 1 + offset * 0.007
    for code, name, kind, qty, safety, location in [
        ('RM-CABBAGE', '배추', '원재료', 2400, 1500, '원재료 냉장창고'),
        ('RM-RADISH', '무', '원재료', 650, 800, '원재료 냉장창고'),
        ('RM-SEASON', '양념', '원재료', 720, 400, '양념 냉장창고'),
        ('FG-POGI', '포기김치', '완제품', 1800, 800, '완제품 냉장창고'),
        ('FG-MAT', '맛김치', '완제품', 950, 500, '완제품 냉장창고'),
        ('FG-CHONGGAK', '총각김치', '완제품', 420, 500, '완제품 냉장창고'),
    ]:
        qty = round(qty * stock_factor / 10) * 10
        connection.execute('INSERT OR IGNORE INTO daily_inventory VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                           (f'DEMO-{business_date}-{code}', business_date, code, name, kind, qty, 'kg', safety, location, business_date+' 14:00', 'demo_data'))
    for index, product, channel, qty, time, approval in [
        (1, '포기김치', '온라인몰 · 택배', 800, '10:00', '승인'),
        (2, '맛김치', '거래처 배송', 600, '13:00', '승인'),
        (3, '총각김치', '거래처 배송', 300, '16:00', '승인대기'),
        (4, '포기김치', 'B2C 택배', 500, '17:00', '승인'),
    ]:
        qty += offset * 5
        connection.execute('INSERT OR IGNORE INTO shipment_plans VALUES (?,?,?,?,?,?,?,?)',
                           (f'DEMO-SP-{date_id}-{index:02}', business_date, product, channel, qty, business_date+' '+time, approval, 'demo_data'))
    for index, product, channel, qty, time in [(1, '포기김치', '온라인몰 · 택배', 800, '10:12'), (2, '맛김치', '거래처 배송', 400, '13:20')]:
        qty += offset * (5 if index == 1 else 3)
        connection.execute('INSERT OR IGNORE INTO shipment_actuals VALUES (?,?,?,?,?,?,?,?,?)',
                           (f'DEMO-OUT-{date_id}-{index:02}', f'DEMO-SP-{date_id}-{index:02}', business_date, product, channel, qty, business_date+' '+time, '출하완료', 'demo_data'))


def daily_answer(repo, question, lot_id=None):
    date_match = re.search(r'\d{4}-\d{2}-\d{2}', question)
    if not any(word in question for word in ('재고', '출하')) or not (date_match or any(word in question for word in ('오늘', '실제', '실적', '출하계획', '출하 계획'))):
        return None
    date = date_match.group() if date_match else today_kst()
    kind = 'inventory' if '재고' in question else 'actuals' if any(w in question for w in ('실제', '실적', '현황')) else 'plans'
    rows = repo.daily_operations(kind, date) if not lot_id else []
    lines = [f'{date} 조회 · 데모 데이터입니다. 실제 운영 현황이 아닙니다.']
    if lot_id:
        lines.append('선택 LOT에 연결된 일별 재고·출하 기록은 미확인입니다. 전체 기록을 선택하면 회사 전체 샘플을 조회할 수 있습니다.')
    elif not rows:
        lines.append(f'해당 날짜의 기록이 없습니다. 등록된 데모 기간은 {SAMPLE_RANGE}이며, 이전 기록을 오늘 현황으로 표시하지 않습니다.')
    elif kind == 'inventory':
        for group in ('완제품', '원재료'):
            lines.append(f"{group} 재고 합계 {sum(r['quantity'] for r in rows if r['item_type']==group):,.0f}kg")
        lines.extend(f"{r['item_name']} {r['quantity']:,.0f}{r['unit']} · {r['location']}" + (' · 샘플 안전재고 미달' if r['quantity'] < r['safety_stock'] else '') for r in rows)
        lines.append('14:00 재고 스냅샷입니다. 출하실적을 다시 차감하지 않습니다.')
    else:
        plans = repo.daily_operations('plans', date)
        actuals = repo.daily_operations('actuals', date)
        planned = sum(r['quantity_kg'] for r in plans)
        shipped = sum(r['quantity_kg'] for r in actuals)
        if kind == 'plans':
            lines.append(f'출하계획 {len(plans)}건 · 총 {planned:,.0f}kg')
            lines.extend(f"{r['planned_at'][11:]} {r['product_name']} · {r['channel']} · {r['quantity_kg']:,.0f}kg · 품질 {r['quality_approval']}" for r in plans)
        else:
            lines.append(f'실제 출하 기록 {len(actuals)}건 · {shipped:,.0f}kg / 계획 {planned:,.0f}kg' + (f' · 달성률 {shipped/planned*100:.1f}%' if planned else ''))
            lines.extend(f"{r['shipped_at'][11:]} {r['product_name']} · {r['quantity_kg']:,.0f}kg · {r['status']}" for r in actuals)
            if plans:
                lines.append(f'계획 대비 미출하 {max(0,planned-shipped):,.0f}kg. 부분 출하를 포함하며 배송 완료를 뜻하지 않습니다.')
            rows = [*actuals, *plans]
        lines.append('14:00 기준 샘플입니다. 출하 승인은 담당자가 확인합니다.')
    lines.append('근거: get_daily_operations · 일별 재고 / 출하계획 / 출하실적 DB')
    return dict(text='\n'.join(lines), sources=[], evidence=[], data_tools=['get_daily_operations'], records=rows,
                searched_documents=False, mode='demo', demo_data=True, as_of=date)
