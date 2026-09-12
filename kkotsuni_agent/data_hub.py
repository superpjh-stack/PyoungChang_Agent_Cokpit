from __future__ import annotations

import sqlite3
import re
from pathlib import Path
from typing import Any


DEMO_DATE = "2026-09-04"


class KkotsuniRepository:
    """Replaceable read-only adapter for the 꽃순이김치 demo Data Hub."""

    BROWSEABLE_TABLES = (
        "orders", "production_plans", "lots", "wash_ccp", "metal_detection",
        "inventory", "pda_movements", "shipments", "equipment", "rules",
        "knowledge_documents",
    )

    def __init__(self, db_path: str | Path, documents_dir: str | Path | None = None) -> None:
        self.db_path = Path(db_path)
        self.documents_dir = Path(documents_dir) if documents_dir else Path(__file__).parents[1] / "sample_docs"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _rows(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
        return [dict(row) for row in rows]

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS orders (
                    order_no TEXT PRIMARY KEY, channel TEXT, product_name TEXT,
                    order_qty_kg REAL, due_date TEXT, priority TEXT, status TEXT
                );
                CREATE TABLE IF NOT EXISTS production_plans (
                    plan_id TEXT PRIMARY KEY, order_no TEXT, product_name TEXT,
                    planned_qty_kg REAL, actual_qty_kg REAL, planned_start TEXT,
                    planned_end TEXT, line_name TEXT, status TEXT
                );
                CREATE TABLE IF NOT EXISTS lots (
                    lot_id TEXT PRIMARY KEY, parent_lot_id TEXT, process TEXT,
                    product_name TEXT, quantity_kg REAL, status TEXT, created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS wash_ccp (
                    check_id TEXT PRIMARY KEY, lot_id TEXT, washer_id TEXT,
                    peroxide_ppm REAL, water_l REAL, contact_min REAL,
                    result TEXT, recorded_at TEXT, source TEXT
                );
                CREATE TABLE IF NOT EXISTS metal_detection (
                    inspection_id TEXT PRIMARY KEY, lot_id TEXT, detector_id TEXT,
                    pass_count INTEGER, reject_count INTEGER, result TEXT,
                    inspected_at TEXT, source TEXT
                );
                CREATE TABLE IF NOT EXISTS inventory (
                    item_code TEXT PRIMARY KEY, item_name TEXT, item_type TEXT,
                    quantity REAL, unit TEXT, safety_stock REAL, location TEXT,
                    updated_at TEXT
                );
                CREATE TABLE IF NOT EXISTS pda_movements (
                    movement_id TEXT PRIMARY KEY, item_code TEXT, lot_id TEXT,
                    from_location TEXT, to_location TEXT, quantity REAL, unit TEXT,
                    operator TEXT, moved_at TEXT, capture_status TEXT
                );
                CREATE TABLE IF NOT EXISTS shipments (
                    shipment_no TEXT PRIMARY KEY, order_no TEXT, pack_lot TEXT,
                    channel TEXT, quantity_kg REAL, planned_at TEXT, status TEXT,
                    quality_approval TEXT
                );
                CREATE TABLE IF NOT EXISTS equipment (
                    equipment_id TEXT PRIMARY KEY, equipment_type TEXT, process TEXT,
                    operating_state TEXT, interface_status TEXT, last_seen TEXT, note TEXT
                );
                CREATE TABLE IF NOT EXISTS knowledge_documents (
                    document_id TEXT PRIMARY KEY, filename TEXT UNIQUE, title TEXT,
                    revision TEXT, owner TEXT, effective_date TEXT, status TEXT,
                    keywords TEXT, body TEXT, source TEXT
                );
                CREATE TABLE IF NOT EXISTS rules (
                    rule_id TEXT PRIMARY KEY, name TEXT, source_table TEXT,
                    condition_text TEXT, owner TEXT, action TEXT,
                    source_document TEXT, revision TEXT, status TEXT
                );
                """
            )
            if connection.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 0:
                self._seed(connection)
            self._seed_documents(connection)
            self._seed_rules(connection)

    def _seed_documents(self, connection: sqlite3.Connection) -> None:
        if not self.documents_dir.exists():
            return
        for path in sorted(self.documents_dir.glob("*.md")):
            body = path.read_text(encoding="utf-8")
            metadata: dict[str, str] = {}
            for line in body.splitlines()[:20]:
                match = re.match(r"[-*]\s*([^:：]+)[:：]\s*(.+)", line.strip())
                if match:
                    metadata[match.group(1).strip()] = match.group(2).strip()
            title = next((line.lstrip("# ").strip() for line in body.splitlines() if line.startswith("#")), path.stem)
            document_id = metadata.get("문서번호", path.stem.upper())
            connection.execute(
                """INSERT INTO knowledge_documents VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(document_id) DO UPDATE SET filename=excluded.filename,
                   title=excluded.title, revision=excluded.revision, owner=excluded.owner,
                   effective_date=excluded.effective_date, status=excluded.status,
                   keywords=excluded.keywords, body=excluded.body, source=excluded.source""",
                (document_id, path.name, title, metadata.get("개정", "0"), metadata.get("담당", "미지정"),
                 metadata.get("시행일", "검증 전"), metadata.get("상태", "샘플/미승인"),
                 metadata.get("검색어", ""), body, "local_sample_document"),
            )

    @staticmethod
    def _seed_rules(connection: sqlite3.Connection) -> None:
        rules = [
            ("KKT-R-001", "세척 CCP 주의·이탈", "wash_ccp", "result != '적합'", "HACCP·품질", "측정방법과 투입량을 재확인하고 영향 LOT 처분을 승인한다.", "KKT-KB-001", "1", "샘플/미승인"),
            ("KKT-R-002", "금속검출 보류", "metal_detection", "result != '적합'", "품질·생산", "LOT를 격리하고 재검사 및 처분을 승인한다.", "KKT-KB-002", "1", "샘플/미승인"),
            ("KKT-R-003", "안전재고 부족", "inventory", "quantity < safety_stock", "자재·생산관리", "실물재고와 입고예정을 확인하고 계획 변경을 승인한다.", "KKT-KB-003", "1", "샘플/미승인"),
            ("KKT-R-004", "PDA 이동 미확정", "pda_movements", "capture_status != '정상'", "자재·물류", "실물 위치와 스캔 이력을 대조한 뒤 이동을 확정한다.", "KKT-KB-003", "1", "샘플/미승인"),
            ("KKT-R-005", "출하 승인 대기", "shipments", "quality_approval != '승인'", "품질·물류", "CCP·금속검출·완제품 입고를 확인한 뒤 출하를 승인한다.", "KKT-KB-003", "1", "샘플/미승인"),
            ("KKT-R-006", "생산계획 원료대기", "production_plans", "status = '원료대기'", "생산관리·구매", "원료 가용량과 납기를 재확인하고 계획을 조정한다.", "KKT-KB-004", "1", "샘플/미승인"),
            ("KKT-R-007", "다국어 작업안내 승인", "knowledge_documents", "작업언어 안내 필요", "생산·품질", "자동번역을 검토하고 승인된 현장 번역문만 배포한다.", "KKT-KB-004", "1", "샘플/미승인"),
        ]
        connection.executemany("INSERT OR IGNORE INTO rules VALUES (?,?,?,?,?,?,?,?,?)", rules)

    @staticmethod
    def _seed(connection: sqlite3.Connection) -> None:
        connection.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?,?)", [
            ("SO-260904-01", "B2C 택배", "포기김치", 1200, "2026-09-05", "긴급", "생산중"),
            ("SO-260904-02", "거래처 배송", "총각김치", 900, "2026-09-06", "일반", "계획확정"),
            ("SO-260904-03", "온라인몰", "맛김치", 650, "2026-09-05", "긴급", "출하검토"),
        ])
        connection.executemany("INSERT INTO production_plans VALUES (?,?,?,?,?,?,?,?,?)", [
            ("PLAN-260904-01", "SO-260904-01", "포기김치", 1200, 760, "2026-09-04 07:00", "2026-09-04 15:00", "김치라인-1", "진행"),
            ("PLAN-260904-02", "SO-260904-02", "총각김치", 900, 0, "2026-09-04 13:00", "2026-09-04 20:00", "김치라인-2", "원료대기"),
            ("PLAN-260904-03", "SO-260904-03", "맛김치", 650, 640, "2026-09-03 13:00", "2026-09-04 09:00", "김치라인-1", "포장완료"),
        ])
        connection.executemany("INSERT INTO lots VALUES (?,?,?,?,?,?,?)", [
            ("RAW-260904-01", None, "원재료 입고·보관", "배추", 1500, "사용중", "2026-09-04 06:20"),
            ("WASH-260904-01", "RAW-260904-01", "자동버블세척", "배추", 1460, "CCP 주의", "2026-09-04 07:10"),
            ("SALT-260904-01", "WASH-260904-01", "절임·탈수", "절임배추", 1320, "완료", "2026-09-04 09:00"),
            ("MIX-260904-01", "SALT-260904-01", "양념·혼합", "포기김치", 1240, "진행", "2026-09-04 10:20"),
            ("FILL-260904-01", "MIX-260904-01", "충진", "포기김치", 1200, "대기", "2026-09-04 11:40"),
            ("PACK-260904-01", "FILL-260904-01", "금속검출·포장", "포기김치", 1188, "품질검토", "2026-09-04 13:10"),
            ("RAW-260903-03", None, "원재료 입고·보관", "배추", 800, "사용완료", "2026-09-03 08:00"),
            ("WASH-260903-03", "RAW-260903-03", "자동버블세척", "배추", 770, "정상", "2026-09-03 09:10"),
            ("PACK-260904-03", "WASH-260903-03", "금속검출·포장", "맛김치", 640, "출하검토", "2026-09-04 08:50"),
        ])
        connection.executemany("INSERT INTO wash_ccp VALUES (?,?,?,?,?,?,?,?,?)", [
            ("CCP-W-001", "WASH-260904-01", "BUBBLE-01", 72, 850, 6, "주의", "2026-09-04 07:18", "demo_data"),
            ("CCP-W-002", "WASH-260903-03", "BUBBLE-02", 55, 820, 7, "적합", "2026-09-03 09:18", "demo_data"),
        ])
        connection.executemany("INSERT INTO metal_detection VALUES (?,?,?,?,?,?,?,?)", [
            ("MD-260904-01", "PACK-260904-01", "METAL-01", 1187, 1, "보류", "2026-09-04 13:30", "demo_data"),
            ("MD-260904-03", "PACK-260904-03", "METAL-02", 640, 0, "적합", "2026-09-04 09:05", "demo_data"),
        ])
        connection.executemany("INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?)", [
            ("RM-CABBAGE", "배추", "원재료", 420, "kg", 500, "원재료창고", "2026-09-04 10:30"),
            ("RM-SEASON", "양념", "원재료", 610, "kg", 300, "냉장창고", "2026-09-04 10:30"),
            ("FG-POGI", "포기김치", "완제품", 1188, "kg", 800, "완제품창고", "2026-09-04 13:20"),
            ("FG-MAT", "맛김치", "완제품", 640, "kg", 700, "완제품창고", "2026-09-04 09:10"),
        ])
        connection.executemany("INSERT INTO pda_movements VALUES (?,?,?,?,?,?,?,?,?,?)", [
            ("MV-001", "RM-CABBAGE", "RAW-260904-01", "원재료창고", "세척대기", 1500, "kg", "작업자01", "2026-09-04 06:50", "정상"),
            ("MV-002", "RM-SEASON", "MIX-260904-01", "냉장창고", "양념대차", 280, "kg", "작업자02", "2026-09-04 10:00", "정상"),
            ("MV-003", "FG-MAT", "PACK-260904-03", "포장라인", "완제품창고", 640, "kg", "작업자03", "2026-09-04 09:10", "PDA 미확정"),
        ])
        connection.executemany("INSERT INTO shipments VALUES (?,?,?,?,?,?,?,?)", [
            ("SHP-260904-01", "SO-260904-01", "PACK-260904-01", "B2C 택배", 1188, "2026-09-05 08:00", "품질보류", "미승인"),
            ("SHP-260904-03", "SO-260904-03", "PACK-260904-03", "온라인몰", 640, "2026-09-04 16:00", "출하대기", "승인대기"),
        ])
        equipment_rows = []
        for index in range(1, 5):
            equipment_rows.append((f"BUBBLE-{index:02d}", "자동버블세척기", "세척", "가동" if index < 3 else "도입 검토", "데모/연계 필요", "2026-09-04 13:40", "총 4대 도입 검토"))
        for index in range(1, 3):
            equipment_rows.append((f"METAL-{index:02d}", "금속검출기", "금속검출", "가동", "데모/연계 필요", "2026-09-04 13:35", "총 2대 도입 검토"))
        equipment_rows.extend([
            ("SCALE-01", "저울", "CCP·계량", "가동", "연계 필요", "2026-09-04 13:20", "일부 CCP 계량"),
            ("CART-SCALE-01", "양념대차저울", "양념·혼합", "가동", "연계 필요", "2026-09-04 13:20", "현장 확인 필요"),
            ("COLD-SENSOR-01", "냉장고 센서", "보관", "가동", "연계 필요", "2026-09-04 13:25", "현장 확인 필요"),
            ("TAPER-01", "자동테이핑기", "포장", "가동", "연계 필요", "2026-09-04 13:25", "현장 확인 필요"),
            ("PBOX-WASH-01", "피박스세척기", "세척", "가동", "연계 필요", "2026-09-04 13:25", "현장 확인 필요"),
            ("FILLER-01", "충진기", "충진", "가동", "연계 필요", "2026-09-04 13:25", "현장 확인 필요"),
        ])
        connection.executemany("INSERT INTO equipment VALUES (?,?,?,?,?,?,?)", equipment_rows)

    def _query(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self._connect() as connection:
            return self._rows(connection.execute(sql, params).fetchall())

    def dashboard(self, date: str = DEMO_DATE) -> dict[str, Any]:
        plans = self.production_plans(date)
        planned = sum(float(row["planned_qty_kg"]) for row in plans)
        actual = sum(float(row["actual_qty_kg"]) for row in plans)
        return {
            "planned_kg": planned,
            "actual_kg": actual,
            "completion_rate": round(actual / planned * 100, 1) if planned else 0,
            "ccp_alerts": len(self.ccp_status(None, True)),
            "metal_holds": len(self.metal_detection(None, True)),
            "stock_shortages": len(self.inventory_status(None, True)),
            "shipment_pending": len(self.shipment_status(None, True)),
            "provenance": "demo_data",
        }

    def orders(self, order_no: str | None = None) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM orders WHERE (? IS NULL OR order_no=?) ORDER BY due_date, priority", (order_no, order_no))

    def production_plans(self, date: str | None = None) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM production_plans WHERE (? IS NULL OR substr(planned_start,1,10)=?) ORDER BY planned_start", (date, date))

    def all_lots(self) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM lots ORDER BY created_at DESC")

    def lot_trace(self, lot_id: str) -> list[dict[str, Any]]:
        by_id = {row["lot_id"]: row for row in self.all_lots()}
        trace: list[dict[str, Any]] = []
        current = by_id.get(lot_id)
        visited: set[str] = set()
        while current and current["lot_id"] not in visited:
            visited.add(current["lot_id"])
            trace.append(current)
            current = by_id.get(current.get("parent_lot_id"))
        return list(reversed(trace))

    def ccp_status(self, lot_id: str | None = None, deviations_only: bool = False) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM wash_ccp WHERE (? IS NULL OR lot_id=?) AND (?=0 OR result!='적합') ORDER BY recorded_at DESC", (lot_id, lot_id, int(deviations_only)))

    def metal_detection(self, lot_id: str | None = None, issues_only: bool = False) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM metal_detection WHERE (? IS NULL OR lot_id=?) AND (?=0 OR result!='적합') ORDER BY inspected_at DESC", (lot_id, lot_id, int(issues_only)))

    def inventory_status(self, item: str | None = None, shortage_only: bool = False) -> list[dict[str, Any]]:
        return self._query("SELECT *, CASE WHEN quantity<safety_stock THEN '부족' ELSE '정상' END AS stock_status FROM inventory WHERE (? IS NULL OR item_name LIKE '%'||?||'%') AND (?=0 OR quantity<safety_stock) ORDER BY item_type, item_name", (item, item, int(shortage_only)))

    def pda_movements(self, item_code: str | None = None) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM pda_movements WHERE (? IS NULL OR item_code=?) ORDER BY moved_at DESC", (item_code, item_code))

    def shipment_status(self, order_no: str | None = None, pending_only: bool = False) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM shipments WHERE (? IS NULL OR order_no=?) AND (?=0 OR quality_approval!='승인') ORDER BY planned_at", (order_no, order_no, int(pending_only)))

    def equipment_status(self, equipment_type: str | None = None) -> list[dict[str, Any]]:
        return self._query("SELECT * FROM equipment WHERE (? IS NULL OR equipment_type LIKE '%'||?||'%') ORDER BY equipment_type, equipment_id", (equipment_type, equipment_type))

    def rules(self, source_table: str | None = None, active_only: bool = True) -> list[dict[str, Any]]:
        return self._query(
            "SELECT * FROM rules WHERE (? IS NULL OR source_table=?) AND (?=0 OR status NOT LIKE '%폐기%') ORDER BY rule_id",
            (source_table, source_table, int(active_only)),
        )

    @staticmethod
    def _search_terms(query: str) -> set[str]:
        tokens = re.findall(r"[가-힣A-Za-z0-9]+", query.lower())
        terms = {token for token in tokens if len(token) >= 2}
        for token in tokens:
            if len(token) >= 3:
                terms.update(token[index:index + 2] for index in range(len(token) - 1))
        return terms

    def search_knowledge(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        terms = self._search_terms(query)
        if not terms:
            return []
        scored: list[tuple[int, dict[str, Any]]] = []
        for row in self._query("SELECT * FROM knowledge_documents ORDER BY document_id"):
            haystack = " ".join(str(row.get(key, "")) for key in ("filename", "title", "keywords", "body")).lower()
            score = sum(haystack.count(term) for term in terms)
            if score:
                scored.append((score, row))
        scored.sort(key=lambda item: (-item[0], item[1]["document_id"]))
        return [dict(row, score=score) for score, row in scored[:max(1, min(int(limit), 10))]]

    def table_counts(self) -> list[dict[str, Any]]:
        return [{"table": table, "rows": self._query(f"SELECT COUNT(*) AS count FROM {table}")[0]["count"]}
                for table in self.BROWSEABLE_TABLES]

    def browse_table(self, table: str, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        if table not in self.BROWSEABLE_TABLES:
            raise ValueError(f"조회가 허용되지 않은 테이블: {table}")
        safe_limit = max(1, min(int(limit), 200))
        safe_offset = max(0, int(offset))
        return self._query(f"SELECT * FROM {table} ORDER BY rowid LIMIT ? OFFSET ?", (safe_limit, safe_offset))
