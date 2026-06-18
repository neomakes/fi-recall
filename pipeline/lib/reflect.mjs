// 기능2(복기 반영): 교리 그래프 + 복기 → grounding·격차분류·생성 → 앱 Applied 형태.
// 라이브는 Claude가 앱 렌더 형태를 직접 출력(프론트가 먹는 언어로). 오프라인은 골든 오버레이 투영.
import { callStructured, hasApiKey } from "./anthropic.mjs";

export const REFLECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["litNodes", "recurrence", "revisions", "drills"],
  properties: {
    litNodes: { type: "array", items: { type: "string" } }, // 복기가 닿은 노드 id
    recurrence: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["nodeId", "count"],
        properties: { nodeId: { type: "string" }, count: { type: "integer" } } },
    },
    revisions: { // 교리 격차 → SOP 수정안(diff)
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["nodeId", "currentText", "proposedText", "justification"],
        properties: { nodeId: { type: "string" }, currentText: { type: "string" }, proposedText: { type: "string" }, justification: { type: "string" } } },
    },
    drills: { // 실행 격차 → 재훈련 drill
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["nodeId", "title", "objective", "steps", "successCriteria"],
        properties: { nodeId: { type: "string" }, title: { type: "string" }, objective: { type: "string" },
          steps: { type: "array", items: { type: "string" } }, successCriteria: { type: "string" } } },
    },
  },
};

const REFLECT_RULES = `너는 소방 현장 복기를 교리 지도에 반영해 학습 루프를 닫는다.
1) grounding: 복기가 닿는 교리 노드 id를 litNodes에 담는다(주어진 노드 목록의 id만).
2) 재발: priorCounts에 이미 기록이 있는 노드는 recurrence에 누적 count로 표시.
3) 격차 분류(경첩 = 대상 노드의 modality):
   - mandatory/recommended인데 위반 → 실행 격차 → drills 생성(체화 훈련).
   - discretionary/부재인데 안전 직결 → 교리 격차 → revisions 생성(원문 대비 수정안).
   currentText는 대상 노드의 원문(text)을 그대로, proposedText는 충실한 개정안.
충실성=안전요건. 노드 원문을 왜곡하지 마라.`;

export async function runReflectLive({ debrief, nodes, priorCounts = {} }) {
  const slim = nodes.map((n) => ({ id: n.id, label: n.label, text: n.text ?? n.quote, modality: n.modality }));
  const out = await callStructured({
    system: REFLECT_RULES,
    userContent: `<핫워시_복기>\n${debrief}\n</핫워시_복기>\n\n<교리노드>\n${JSON.stringify(slim)}\n</교리노드>\n\n<과거재발카운트>\n${JSON.stringify(priorCounts)}\n</과거재발카운트>`,
    schema: REFLECT_SCHEMA,
    maxTokens: 8000,
  });
  return { ...out.parsed, heuristic: false };
}

// 오프라인: 골든 debrief_overlay(Lesson) → 앱 Applied 형태 투영(데모용 best-effort).
export function overlayToApplied(overlay, nodesById = {}) {
  const litNodes = [...new Set((overlay.lessons ?? []).flatMap((l) => (l.grounding ?? []).map((g) => g.node_id)))];
  const recurrence = (overlay.lessons ?? [])
    .filter((l) => l.recurrence?.count >= 2)
    .map((l) => ({ nodeId: l.grounding?.[0]?.node_id, count: l.recurrence.count }));
  const revisions = (overlay.lessons ?? [])
    .filter((l) => l.output?.kind === "sop_amendment")
    .map((l) => ({
      nodeId: l.output.target_node,
      currentText: nodesById[l.output.target_node]?.text ?? "",
      proposedText: l.output.proposal,
      justification: l.gap?.rationale ?? "",
    }));
  const drills = (overlay.lessons ?? [])
    .filter((l) => l.output?.kind === "retraining_drill")
    .map((l) => ({
      nodeId: l.output.target_node,
      title: `재훈련 — ${nodesById[l.output.target_node]?.label ?? l.output.target_node}`,
      objective: l.gap?.rationale ?? "",
      steps: l.output.proposal.split(/(?:[.。]\s*|\n)/).map((s) => s.trim()).filter(Boolean),
      successCriteria: "훈련담당관 판정",
    }));
  return { litNodes, recurrence, revisions, drills, heuristic: false };
}

export { hasApiKey };
