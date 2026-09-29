"""Bounded local retrieval. No inference, live data or manufacturing approvals."""
from .compat import lot_snapshot


def demo_answer(repo, question, lot_id=None):
    docs = repo.search_knowledge(question)
    evidence = [dict(filename=d['filename'], document_id=d['document_id'], text=d['body'],
                     status=d['status'], revision=d['revision'], owner=d['owner']) for d in docs]
    records, tools, findings = [], [], []

    def add(name, rows, label):
        tools.append(name)
        records.extend(r for r in rows if r not in records)
        findings.append(f'{label} {len(rows)}건')

    if lot_id:
        snap = lot_snapshot(repo, lot_id)
        for name, key, label in [('get_lot_trace', 'trace', '연결 공정'),
                                  ('get_wash_ccp_status', 'ccp', '세척 CCP'),
                                  ('get_metal_detection', 'metal', '금속검출'),
                                  ('get_pda_movements', 'movements', 'PDA 이동'),
                                  ('get_shipment_status', 'shipments', '출하')]:
            add(name, snap[key], label)
        for row in snap['ccp']:
            findings.append(f"{row['lot_id']}: 과산화수소 {row['peroxide_ppm']}ppm · 물량 {row['water_l']}L · 접촉 {row['contact_min']}분 · 기록 판정 {row['result']}")
        for row in snap['metal']:
            findings.append(f"{row['lot_id']}: 금속검출 {row['result']} · 불합격 {row['reject_count']}건")
    else:
        overview = any(w in question for w in ('브리핑', '위험', '승인해야'))
        routes = [
            (('수주', '납기'), 'get_orders', repo.orders, '수주'),
            (('생산', '계획'), 'get_production_plans', repo.production_plans, '생산계획'),
            (('세척', 'CCP', '농도'), 'get_wash_ccp_status', repo.ccp_status, '세척 CCP'),
            (('금속',), 'get_metal_detection', repo.metal_detection, '금속검출'),
            (('재고', '원료', '부족'), 'get_inventory_status', repo.inventory_status, '재고'),
            (('PDA', '이동'), 'get_pda_movements', repo.pda_movements, 'PDA 이동'),
            (('출하', '택배', '배송'), 'get_shipment_status', repo.shipment_status, '출하'),
            (('설비', '세척기', '검출기'), 'get_equipment_status', repo.equipment_status, '설비 연계'),
            (('규칙', '담당', '승인해야'), 'get_rules', repo.rules, '샘플 판단규칙'),
        ]
        for keywords, name, query, label in routes:
            if overview or any(w in question for w in keywords):
                rows = query()
                if name == 'get_pda_movements' and '미확정' in question:
                    rows = [r for r in rows if r['capture_status'] != '정상']
                elif name == 'get_inventory_status' and '부족' in question:
                    rows = [r for r in rows if r['quantity'] < r['safety_stock']]
                elif name == 'get_shipment_status' and any(w in question for w in ('대기', '미승인')):
                    rows = [r for r in rows if r['quality_approval'] != '승인']
                elif name == 'get_metal_detection' and '보류' in question:
                    rows = [r for r in rows if r['result'] != '적합']
                add(name, rows, label)
                for row in rows[:3]:
                    if name == 'get_pda_movements':
                        findings.append(f"{row['movement_id']} · {row['lot_id']}: {row['from_location']} → {row['to_location']} · {row['quantity']}{row['unit']} · {row['capture_status']}")
                    elif name == 'get_inventory_status':
                        findings.append(f"{row['item_name']}: 재고 {row['quantity']}{row['unit']} · 샘플 안전재고 {row['safety_stock']}{row['unit']}")
                    elif name == 'get_shipment_status':
                        findings.append(f"{row['shipment_no']} · {row['pack_lot']}: {row['status']} · 품질 {row['quality_approval']}")
    lines = ['데모 조회 · 2026-09-04 샘플 기록입니다. 실시간 현황이나 AI 분석이 아닙니다.']
    lines.extend(findings)
    if not findings:
        lines.append(f'관련 문서 {len(docs)}개를 찾았습니다.' if docs else '일치하는 기록·문서는 미확인입니다.')
    lines.append('아래 근거를 펼쳐 원본 값을 확인하세요. 원인 분석·공정 변경·출하 승인 판단은 수행하지 않았습니다.')
    lines.append('근거: ' + (', '.join(tools + [d['document_id'] for d in docs]) or '미확인'))
    return dict(text='\n'.join(lines), sources=[d['filename'] for d in docs], evidence=evidence,
                data_tools=tools, records=records, searched_documents=True, mode='demo', demo_data=True)
