# FI:RECALL 백엔드

키를 **서버에 보관**하고 패스코드를 **서버에서 검증**하는 의존성 0 Node 프록시.
`pipeline/lib`를 재사용. 정적 프론트(neomakes.com/projects/firecall)가 안전하게 Claude를 호출하는 경계.

## 왜 필요한가
정적 SPA의 PasscodeGate는 번들에 비번이 들어가 우회 가능 → **토큰 비용 보호 안 됨**.
서버가 비번을 검증하고 키를 쥐어야 실제 보호가 성립(PasscodeGate.tsx 주석이 명시).

## 실행
```bash
cp server/.env.example server/.env     # ANTHROPIC_API_KEY, FIRECALL_PASSCODE 채우기
node --env-file=server/.env server/server.mjs
# → http://localhost:8787
```
`ANTHROPIC_API_KEY` 없으면 **offline 모드**(골든 stand-in)로 떠서 프론트 연동을 키 없이 테스트 가능.
키 넣으면 자동으로 `claude-opus-4-8` 라이브 추출 + 충실성 게이트.

## 엔드포인트
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/health` | — | `{ok, mode}` |
| POST | `/api/extract` | `x-firecall-passcode` | `{sop, debrief?}` → `{map:{nodes,edges}}` (앱 MapNode 형태) |
| POST | `/api/reflect` | `x-firecall-passcode` | `{debrief, nodes, priorCounts}` → `{applied:{litNodes,recurrence,revisions,drills}}` |

`/api/extract`는 라이브 시 **충실성 게이트 실패하면 422**(환각 노드를 프론트로 안 보냄).

## 프론트 연동
`app/src/lib/api.ts` 클라이언트가 위 형태를 그대로 반환.
- `app/.env`에 `VITE_API_BASE=http://localhost:8787` 추가 → `apiConfigured()` true.
- (선택) PasscodeGate가 입력 코드를 `sessionStorage.setItem("firecall_passcode", value)` 하면 서버 검증과 연결.
- Workbench 교체점: `generateMap()` → `api.extract`, `applyDoc()` 업로드 분기 → `api.reflect`.

## 배포(추후)
`server.mjs`의 핸들러는 런타임 독립 — neomakes.com 서버리스(/api)로 옮길 때 라우팅만 감싸면 됨.
