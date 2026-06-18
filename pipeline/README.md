# FI:RECALL Pipeline — SOP → 교리 그래프 + 평가 하니스

`app/`(UI·인증)과 **독립** 레인. 의존성 0 (Node 빌트인 + `pdftotext` + `fetch`).
오프라인(API 키 없음)에서도 **검증·평가**가 돌도록 설계.

## 실행

```bash
cd pipeline
node eval.mjs                          # ★ 평가: 충실성/스키마/결정론 게이트 (API 불필요)
node slice.mjs SOP-107                 # SOP 섹션 원문 추출 검수
node build-index.mjs                   # TOC → out/sop-index.json (triage 라우팅용)
node extract.mjs --sop SOP-107 \
     --debrief ../input/01_아파트화재_핫워시.md   # 복기-스코프 추출 (키 있으면 라이브)
```

`ANTHROPIC_API_KEY` 있으면 `extract.mjs`가 `claude-opus-4-8`로 라이브 추출,
없으면 골든을 stand-in으로 plumbing만 점검. `eval.mjs`는 키와 무관하게 항상 채점.

## 게이트 (모델 출력이 통과해야 하는 불변식)

`lib/validate.mjs` — 라이브 출력과 골든에 **동일** 적용:
- **충실성**: 모든 `provenance.quote` 가 PDF 원문에 verbatim 존재 (환각 차단, ERROR)
- **결정론 ID**: `id === ${sop}-${clause}` (모델이 ID를 짓지 않음, ERROR)
- **스키마**: type/domain/modality/relation enum, 필수 필드, ID 패턴 (ERROR)
- **격차 정합**: `gap.type=doctrine→sop_amendment`, `execution→retraining_drill` (WARN)
- **복기 인용**: overlay quote 가 복기 원문과 일치 (WARN)

## 흐름

```
input/*.pdf ─sliceSection→ SOP 텍스트 ─callStructured(claude-opus-4-8)→ 모델출력
            └ assemble(id/provenance 결정론 조립) → ontology DoctrineGraph
            └ validateDoctrineGraph(원문 대비) → out/doctrine-graph.<sop>.json
```

계약: `../ontology/doctrine-graph.schema.json` · few-shot/골든: `../ontology/example.sop-107.json`

## app 연동(다른 세션 완료 후)

`out/doctrine-graph.*.json` → `app/src/data/fixtures.ts`의 `MapNode/Feedback` 형태로 project.
교체 지점은 `Workbench.tsx`의 `generateMap()`·`applyDoc()` 두 함수.
