import { isVerbatim } from "./text.mjs";

// ontology/doctrine-graph.schema.json 의 controlled vocab (런타임 게이트용 미러).
const DOMAINS = ["command", "fire", "accident", "ems", "situation", "safety"];
const NODE_TYPES = ["procedure", "decision", "hazard", "standard"];
const MODALITIES = ["mandatory", "recommended", "discretionary", "informational"];
const RELATIONS = ["contains", "sequence", "dependency", "exception", "reference"];
const GAP_TYPES = ["doctrine", "execution"];
const OUTPUT_KINDS = ["sop_amendment", "retraining_drill"];
const ID_RE = /^(SOP-\d{3}|SSG-\d+)(-\d+(\.\d+)*)?$/;

const mk = () => {
  const issues = [];
  return {
    issues,
    err: (code, msg) => issues.push({ level: "error", code, msg }),
    warn: (code, msg) => issues.push({ level: "warn", code, msg }),
  };
};

// ① 교리 지도(Layer A) 검증. sourceText 주면 provenance verbatim 게이트까지.
export function validateDoctrineGraph(graph, sourceText = null) {
  const r = mk();
  if (graph?.doc_type !== "doctrine_graph") r.err("doc_type", `doc_type=${graph?.doc_type}`);
  const nodeIds = new Set();

  for (const n of graph?.nodes ?? []) {
    const id = n?.id ?? "?";
    for (const f of ["id", "type", "domain", "sop", "clause", "label", "text", "modality", "provenance"])
      if (n?.[f] == null) r.err("missing_field", `${id}.${f} 누락`);
    if (!NODE_TYPES.includes(n?.type)) r.err("enum_type", `${id} type=${n?.type}`);
    if (!DOMAINS.includes(n?.domain)) r.err("enum_domain", `${id} domain=${n?.domain}`);
    if (!MODALITIES.includes(n?.modality)) r.err("enum_modality", `${id} modality=${n?.modality}`);
    if (!ID_RE.test(n?.id ?? "")) r.err("id_pattern", `${id} 패턴 불일치`);
    if (n?.sop && n?.clause && n?.id !== `${n.sop}-${n.clause}`)
      r.err("id_determinism", `${id} ≠ ${n.sop}-${n.clause} (id는 결정론적이어야)`);

    const q = n?.provenance?.quote;
    if (!q) r.err("provenance_missing", `${id} provenance.quote 없음`);
    else if (sourceText && !isVerbatim(q, sourceText))
      r.err("provenance_unfaithful", `${id} 인용이 원문에 없음 — 환각 의심`);

    nodeIds.add(n?.id);
  }

  for (const e of graph?.edges ?? []) {
    if (!RELATIONS.includes(e?.relation)) r.err("edge_relation", `${e?.from}→${e?.to} relation=${e?.relation}`);
    for (const ep of [e?.from, e?.to]) if (!ID_RE.test(ep ?? "")) r.err("edge_id_pattern", `엣지 끝 ${ep} 패턴 불일치`);
    // contains 부모는 섹션 노드일 수 있음(노드 목록에 없을 수 있음). 비-contains는 양 끝이 노드여야.
    if (e?.relation !== "contains")
      for (const ep of [e?.from, e?.to]) if (!nodeIds.has(ep)) r.warn("edge_dangling", `${e?.relation} 엣지의 ${ep} 가 노드 아님`);
  }

  return { issues: r.issues, nodeIds: [...nodeIds] };
}

// ② 복기 오버레이(Layer B) 검증. debriefText 주면 grounding 인용 verbatim 체크(권장).
export function validateOverlay(overlay, debriefText = null, knownNodeIds = []) {
  const r = mk();
  const known = new Set(knownNodeIds);
  if (overlay?.doc_type !== "debrief_overlay") r.err("doc_type", `doc_type=${overlay?.doc_type}`);

  for (const l of overlay?.lessons ?? []) {
    const id = l?.id ?? "?";
    for (const g of l?.grounding ?? [])
      if (known.size && !known.has(g?.node_id)) r.warn("grounding_unknown_node", `${id} grounding node ${g?.node_id} 가 그래프에 없음`);

    if (!GAP_TYPES.includes(l?.gap?.type)) r.err("gap_type", `${id} gap.type=${l?.gap?.type}`);
    if (l?.output) {
      if (!OUTPUT_KINDS.includes(l.output.kind)) r.err("output_kind", `${id} output.kind=${l.output.kind}`);
      const expect = l?.gap?.type === "doctrine" ? "sop_amendment" : "retraining_drill";
      if (l.output.kind && l.output.kind !== expect)
        r.warn("gap_output_mismatch", `${id} gap=${l.gap.type} 인데 output=${l.output.kind} (기대: ${expect})`);
    }
    // 복기 인용 verbatim — grounding은 편집 가능성이 있어 WARN.
    if (debriefText && l?.quote && !isVerbatim(l.quote, debriefText))
      r.warn("debrief_quote_nonverbatim", `${id} quote 가 복기 원문과 정확히 일치하지 않음`);
  }
  return { issues: r.issues };
}

export const summarize = (issues) => ({
  errors: issues.filter((i) => i.level === "error").length,
  warnings: issues.filter((i) => i.level === "warn").length,
});
