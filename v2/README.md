# 평창꽃순이김치 AI Agent V2

임진강김치의 2026-09-29 로컬 최종 화면과 `skill-2-react`를 기준으로 기존 평창꽃순이 프로젝트를 확장했습니다. React·TypeScript·FastAPI를 사용하며, 기존 Streamlit V1과 원본 DB는 유지합니다.

## 실행

프로젝트 루트에서:

```bash
python3 -m venv .venv-v2
.venv-v2/bin/pip install -r v2/requirements.lock
npm ci --prefix v2/web
npm run build --prefix v2/web
.venv-v2/bin/uvicorn v2.api:app --host 127.0.0.1 --port 8512
```

접속: http://127.0.0.1:8512

V2는 `data/kkotsuni_v2_demo.db`를 별도로 생성하며 `sample_docs/`를 인덱싱합니다. 개발 서버는 `npm run dev --prefix v2/web`로 실행합니다. Vite는 `/api`를 8512로 전달합니다.

## 현재 기능

- 왼쪽 지식문서 검색·본문과 11개 허용 테이블 원본 조회, 중앙 대화·LOT·음성, 오른쪽 이력·20개 추천질문.
- 직접 질문·추천질문·이력 질문이 같은 처리 경로를 사용합니다. LOT 전환·초기화 시 진행 중 응답과 음성을 취소합니다.
- API 키 없는 데모 조회와 서버 키를 사용하는 AI 모드를 구분합니다. 데모 조회는 고정된 기록 검색이며 임의의 원인 분석이나 승인 판단을 하지 않습니다.
- 포장 LOT의 상위 세척 CCP·금속검출·PDA 이동·출하 근거를 함께 조회합니다. 답변의 문서와 원본 레코드를 펼치고 JSON으로 내려받을 수 있습니다.
- 실시간 WebRTC 음성, 발화 종료 감지·끼어들기·음소거·종료, 서버의 읽기 전용 제조 도구와 답변 읽기 경로를 연결했습니다.
- 모바일 자료·질문 패널, 본문 모달, 오류·빈 결과·로딩 상태를 제공합니다.

## AI 연결

`v2/.env.example`을 참고해 루트 `.env`에 필요한 설정을 넣습니다. API 키는 서버에만 저장합니다. `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`를 환경변수로 설정할 수 있습니다. 기본 모델명은 기준 프로젝트 값이며 계정의 사용 가능 여부는 별도로 확인해야 합니다.

외부에서 유료 AI를 사용하려면 `COCKPIT_ACCESS_TOKEN`이 필요합니다. UI의 접근 코드는 OpenAI 키와 다르며 브라우저 sessionStorage에 보관됩니다. localhost와 로컬 클라이언트가 모두 확인된 요청만 코드 없이 서버 키를 사용할 수 있습니다. 마이크는 HTTPS 또는 localhost에서 사용합니다.

현재 화면에는 조직 로그인·업무 인계 UI가 없습니다. 원본 프로젝트의 업무·계측 서버 모듈은 확장용으로 유지하되, 화면 저장 기능은 파일 내려받기로 제공합니다. `V2_REQUIRE_LOGIN=1`은 서버를 보호하지만 로그인 화면이 연결되기 전에는 일반 화면을 사용할 수 없습니다. `/work/{id}`도 업무 이어보기 완성을 의미하지 않습니다.

## 데이터 범위

모든 제조 기록은 **2026-09-04 샘플**, 문서·규칙은 **미승인**입니다. 농도나 시간은 관측 예시이며 승인 한계기준이 아닙니다. 발효 예측, 실시간 센서, MES/PDA 실연계, 생산·출하 승인, PostgreSQL 어댑터는 구현 범위에 포함하지 않았습니다. `DATABASE_URL`이 있으면 미연결을 명시하고 시작을 거절합니다.

## Docker

```bash
docker compose --env-file v2/.env.example -f v2/docker-compose.yml config --quiet
docker compose --env-file .env -f v2/docker-compose.yml up -d --build
```

8512는 localhost에만 바인딩되며 SQLite는 전용 named volume에 보관됩니다. 외부 서비스는 별도 인증·HTTPS 구성이 필요합니다. 기존 V1 Compose와 다른 프로젝트 이름을 사용합니다.

## 검증 결과 (2026-09-29)

- `npm run build --prefix v2/web`: 통과.
- `.venv-v2/bin/python -m pytest v2/tests -q`: 12개 통과. LOT 상위 근거, 모든 추천질문, ID/페이지/테이블 거절, 유료 호출 보호, 키 비노출, 음성 조회 도구 허용 목록, 정적 HTML 확인.
- `.venv/bin/python -m pytest tests -q`: 기존 V1 11개 통과.
- Chrome 데스크톱/390px: 추천질문 응답, 근거 펼침, 초기화, 문서 본문, 데이터 상세 확인.
- 실제 유료 AI·음성 통화, 휴대전화 마이크, Docker 이미지 빌드, 외부 서버 배포는 검증하지 않았습니다.

## 후속 보완

- 연결 설정의 **연결 확인·적용**은 서버 키 유무와 접근 권한만 검증합니다. 비용이 발생하는 모델 호출은 하지 않으며 실제 모델 사용 가능 여부와 구분해 표시합니다.
- AI 질문에도 선택 LOT의 상위 세척 CCP·금속검출·PDA·출하 원본을 사전 전달하고 답변 근거에 보존합니다. 샘플 기준일과 조회시각을 구분합니다.
- 음성 오류 및 문자 질문 전환 시 진행 중인 실시간 음성을 종료합니다.
- AI 사전 문맥과 연결 권한은 모의 클라이언트 테스트로 확인했습니다. 실제 유료 AI·마이크 검증은 포함하지 않습니다.
