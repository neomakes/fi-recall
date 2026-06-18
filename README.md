# FI:RECALL

### 복기는 끝나도, 훈련은 끝나지 않는다 — *From the fire call to total recall.*

> **FI:RECALL converts firefighter debriefs into doctrine-grounded retraining drills.**
> Closing the training loop for firefighters. By [NeoMakes](https://neomakes.com).

---

## The problem

소방관은 세상에서 가장 훈련을 많이 하는 직업군 중 하나입니다. 그런데 정작 **실제 현장에서 배운 것은 다음 훈련에 거의 반영되지 않습니다** — 가장 값비싼 교훈이 가장 빨리 잊힙니다.

군·소방 모두 사후검토(AAR)를 의무화하고 학습 루프는 *설계상* 닫혀 있지만(美 육군 FM 7-0), 실무에선 **"교훈 포착"과 "교리·훈련 갱신" 사이가 끊깁니다.** IAFC에 따르면 정식 사후보고서는 *"작성되는 데 수년이 걸리거나, 아예 작성되지 않습니다."*

## What it does

**① 교리 지도화** — 텍스트로 흩어진 SOP 교리집을 한눈에 보이는 **교리 지도**(절차·판단점·위험·표준의 노드 + 선후·의존·예외 연결)로 구조화. 압박 속에서도 빠르게 이해되는 교리.

**② 복기 반영** — 훈련자·현장 피드백을 입력하면, 교리 지도의 어느 지점에 닿는지 자동 태깅하고, 과거 같은 지점의 교훈과 대조해 재발을 표시한 뒤, 격차를 두 갈래로 분류해 고리를 닫습니다:
- **교리 격차**(*아는 것*의 문제) → **SOP 수정 제안**
- **실행 격차**(*몸이 따르는 것*의 문제) → **재훈련 drill**

기술적으로 교리 지도는 **SOP 온톨로지**이며, 핵심 로직은 *개념 추출 + 엣지 최적화* 와 *피드백의 확률적 노드 grounding · 재발/종결 상태 추적* 입니다 — "교리 온톨로지 위에서 도는 credit-assignment 최적화."

## Repo layout

```
input/        제품 입력 — SOP 교리집 (예: 재난현장 표준작전절차)
reference/    1차 자료: FM 7-0 부록 K · IAFC 핫워시 양식 · 8-step 모델 · 소방 AAR (원문 + 한국어 + 비교 분석)
submission/   해커톤 제출물 (description, tracker, 산출물)
  └ tracker.html   제출 진행 실시간 트래커 (단일 HTML, 브라우저에서 열기)
```

## AI

핵심 추론 엔진은 **Claude (Anthropic)** — 지저분한 자연어 디브리핑을 구조화된 교리 지도에 매핑하는 의미 추론이 제품의 병목이자 핵심 가치이며, 출력이 *소방관의 플레이북을 편집*하므로 **faithfulness(충실성)가 곧 안전요건**입니다.

---

*Hackathon work in progress.*
