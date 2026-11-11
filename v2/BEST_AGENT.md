# 평창꽃순이김치 에이전트

`make_best_agent`를 기존 평창꽃순이김치 V2에 적용했습니다. 현장 현황, LOT 조회, 자료 전체, 업무 저장·보고서 기능을 유지합니다.

- LangGraph: 원문 요청 보존 → 요청 분해 → 범위 확인·조회 → 답변 인용/근거 연결 검사 → 미확인 항목 최대 1회 보완.
- 데이터·지식베이스·복합질문 각 10개. 세척 CCP, 금속검출, PDA 이동, 수주·생산, 재고·출하 자료를 활용합니다.
- 후속 LOT는 사용자 발화에서만 확인합니다. 선택 LOT의 도구 조회는 연결 계보로 제한합니다.
- 음성과 글은 동일한 분석기를 사용합니다. 끼어들면 브라우저 요청과 출력 음성을 취소하고 이전 턴 응답을 격리합니다. 서버에서 이미 시작된 모델 호출의 비용까지 취소되지는 않습니다.
- 비교표는 원본 레코드만 사용하고 서로 다른 레코드 구조를 분리합니다. 0·미확인·단위를 보존합니다.
- 녹색·아이보리 회사 테마, 모바일 패널, 대화 영역 스크롤, 새 답변 첫 부분 유지.

## 실행

```sh
uv pip install --python .venv-v2/bin/python -r v2/requirements.lock
npm --prefix v2/web ci
npm --prefix v2/web run build
V2_SQLITE_PATH=/tmp/kkotsuni-best-agent-preview.db DATABASE_URL='' .venv-v2/bin/uvicorn v2.api:app --host 127.0.0.1 --port 8519
```

API 키는 기존 서버 `.env` 설정을 사용합니다. 키가 없으면 자료 조회를 사용하며, 답변 검증을 완료했다고 표시하지 않습니다. 현재 등록된 공정 DB와 지식문서는 샘플·미승인입니다. 날짜에 해당하는 기록이 없으면 미확인으로 처리합니다. 실제 운영 데이터 연결이나 운영 배포는 수행하지 않았습니다.

## 검증

- `.venv-v2/bin/python -m pytest v2/tests -q`: 29개 통과.
- `npm --prefix v2/web run build`: 통과.
- `browser-best-agent.cjs`: 데스크톱·390px 모바일, 추천질문, 비교표, 두 번째 답변 시작 위치.
- `browser-voice-upgrade.cjs`: 모의 WebRTC 연결 실패·재연결·끼어들기·이전 응답 차단·마이크 해제.
- 실제 OpenAI 복합질문(세척 CCP·금속검출) 응답 확인. 실제 마이크 음질·소음 환경은 미검증.

브라우저 테스트는 Playwright가 설치된 환경에서 실행합니다. `PLAYWRIGHT_MODULE`로 모듈 경로, `PLAYWRIGHT_CHANNEL`로 브라우저, `KKOTSUNI_URL`로 대상 URL을 지정할 수 있습니다. 기본 대상은 localhost:8519입니다.
