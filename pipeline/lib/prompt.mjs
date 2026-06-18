// 모델 출력 스키마 — output_config.format(json_schema)용. 제약(pattern/maxLength)은 빼고
// additionalProperties:false + enum만. id/provenance는 모델이 짓지 않고 코드가 결정론적으로 조립.
export const MODEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sop", "sop_title", "domain", "nodes", "edges"],
  properties: {
    sop: { type: "string" },        // "SOP-107"
    sop_title: { type: "string" },
    domain: { type: "string", enum: ["command", "fire", "accident", "ems", "situation", "safety"] },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clause", "type", "modality", "actor", "label", "text", "tags", "page", "quote"],
        properties: {
          clause: { type: "string" },     // "2.6" — 원문 십진 번호 그대로
          type: { type: "string", enum: ["procedure", "decision", "hazard", "standard"] },
          modality: { type: "string", enum: ["mandatory", "recommended", "discretionary", "informational"] },
          actor: { type: "string" },
          label: { type: "string" },
          text: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          page: { type: "integer" },
          quote: { type: "string" },      // 원문 verbatim 인용 (검증 게이트)
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from_clause", "to_clause", "relation"],
        properties: {
          from_clause: { type: "string" },
          to_clause: { type: "string" },
          relation: { type: "string", enum: ["contains", "sequence", "dependency", "exception", "reference"] },
          note: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
  },
};

export const EXTRACTION_RULES = `너는 소방 SOP 원문을 교리 그래프로 구조화한다. 충실성=안전요건(환각=인명 위험).

규칙:
- clause는 원문 십진 번호를 그대로 쓴다(예: "2.6"). 새 번호를 짓지 마라.
- quote는 원문 문장을 verbatim으로 인용한다. 요약/변형/생략 금지.
- type 판정 단서: procedure(행동 단계 "…한다"), decision(판단·선택·고려·분기 "…판단한다/할 수 있다"),
  hazard(대원안전·긴급탈출·붕괴·고립·위험), standard(규범적 의무·원칙·우선순위 "…해야 한다/책임을 진다").
- modality 판정 단서: mandatory("…해야 한다/책임을 진다/삼가야 한다"), recommended("…원칙으로 한다/노력한다"),
  discretionary("…할 수 있다/고려한다/필요시"), informational("예)"·정의·배경).
- edges: 계층은 contains(부모 절 번호 → 자식), 그 외 선후=sequence/의존=dependency/예외=exception/교차참조=reference.
- 복기(핫워시)가 함께 주어지면, 복기가 닿는 조항 + 그 직계 부모/이웃만 노드화한다(섹션 전체를 다 뽑지 마라).`;

export function buildUserContent({ fewshot, sopText, debrief = null }) {
  const parts = [`<예시_출력>\n${JSON.stringify(fewshot)}\n</예시_출력>`];
  if (debrief) parts.push(`<핫워시_복기>\n${debrief}\n</핫워시_복기>`);
  parts.push(`<SOP_원문>\n${sopText}\n</SOP_원문>`);
  parts.push(
    debrief
      ? "위 복기가 닿는 교리 조항만 그래프화하라."
      : "위 SOP 원문 전체를 교리 그래프로 구조화하라."
  );
  return parts.join("\n\n");
}
