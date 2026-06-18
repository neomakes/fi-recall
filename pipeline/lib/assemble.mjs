import { basename } from "node:path";
import { PDF } from "./paths.mjs";

// 모델 출력(clause 중심) → ontology DoctrineGraph. id/provenance를 코드가 결정론적으로 조립
// = 설계결정 1(출처 고정 결정론적 ID). 모델은 의미만, 식별·출처는 우리가 소유.
export function assemble(model) {
  const sop = model.sop;
  const nodes = (model.nodes ?? []).map((n) => ({
    id: `${sop}-${n.clause}`,
    type: n.type,
    domain: model.domain,
    sop,
    sop_title: model.sop_title,
    clause: n.clause,
    label: n.label,
    text: n.text,
    modality: n.modality,
    actor: n.actor,
    tags: n.tags ?? [],
    provenance: {
      source: basename(PDF),
      page: n.page,
      clause_path: `${sop.replace("-", " ")} > ${n.clause.split(".").join(" > ")}`,
      quote: n.quote,
    },
  }));
  const edges = (model.edges ?? []).map((e) => ({
    from: `${sop}-${e.from_clause}`,
    to: `${sop}-${e.to_clause}`,
    relation: e.relation,
    ...(e.note ? { note: e.note } : {}),
    ...(e.confidence != null ? { confidence: e.confidence } : {}),
  }));
  return {
    doc_type: "doctrine_graph",
    version: "1.0.0",
    domain: model.domain,
    source: basename(PDF),
    scope: `${sop} ${model.sop_title}`,
    nodes,
    edges,
  };
}
