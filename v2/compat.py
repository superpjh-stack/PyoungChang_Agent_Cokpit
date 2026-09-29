"""V2 HTTP adapter backed by the existing Kkotsuni records, without reseeding V1."""
import os
from kkotsuni_agent.data_hub import KkotsuniRepository
from kkotsuni_agent.ui_helpers import QUESTION_GROUPS as GROUPS, lot_snapshot as snapshot

DEFAULT_MODEL = 'gpt-5.6'
QUESTION_GROUPS = {'공정데이터': GROUPS['MES·LOT'], '일반질의': GROUPS['지식문서']}
TABLE_LABELS = dict(zip(KkotsuniRepository.BROWSEABLE_TABLES, [
    '수주', '생산계획', 'LOT 계보', '세척 CCP', '금속검출', '원재료·완제품 재고',
    'PDA 재고이동', '출하 승인', '설비 연계', '판단규칙', '지식문서']))

class KkotsuniV2Repository(KkotsuniRepository):
    def fermentation_status(self, lot_id=None):
        # No fermentation prediction is registered for this company.
        return []

    def ccp_deviations(self, date=None):
        rows = self.ccp_status(None, True)
        return [r for r in rows if not date or r['recorded_at'].startswith(date)]

    def shipment_readiness(self, lot_id=None):
        return [r for r in self.shipment_status() if not lot_id or r['pack_lot'] == lot_id]

    def get_rules(self):
        return [dict(r, condition=r['condition_text']) for r in self.rules()]

    def table_inventory(self):
        return [dict(table=r['table'], label=TABLE_LABELS[r['table']], count=r['rows'], exists=True)
                for r in self.table_counts()]

    def table_records(self, table, limit=50, offset=0):
        return self.browse_table(table, limit, offset)

    def knowledge_documents(self):
        return [dict(r, content=r['body']) for r in self.browse_table('knowledge_documents', 200)]

    def process_measurements(self, lot_id=None):
        return [*self.ccp_status(lot_id), *self.metal_detection(lot_id)]


def lot_snapshot(repository, lot_id):
    return dict(snapshot(repository, lot_id), fermentation=[])


def create_repository(database_path, database_url=None):
    if database_url or os.getenv('DATABASE_URL'):
        raise RuntimeError('이 V2는 SQLite 데모입니다. DATABASE_URL을 제거하거나 검증된 PostgreSQL 어댑터를 연결하세요.')
    return KkotsuniV2Repository(database_path)
