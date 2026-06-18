// ontology DoctrineGraph → 앱(Workbench)이 렌더하는 MapNode/MapEdge 형태로 투영.
// = 스키마 통합 브리지. provenance/modality는 보존(node에 동봉)하되 렌더 좌표 x/y를 부여.

const REL_TO_EDGE = { contains: "sequence", sequence: "sequence", dependency: "dependency", exception: "exception", reference: "dependency" };

// 결정론적 계층 레이아웃: clause 깊이(점 개수)를 레벨로, 같은 레벨은 x로 균등 분산.
function layout(nodes) {
  const level = (n) => n.clause.split(".").length; // "2" → 1, "2.6" → 2
  const byLevel = new Map();
  for (const n of nodes) (byLevel.get(level(n)) ?? byLevel.set(level(n), []).get(level(n))).push(n);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const pos = {};
  levels.forEach((lv, li) => {
    const row = byLevel.get(lv).sort((a, b) => a.clause.localeCompare(b.clause, undefined, { numeric: true }));
    const y = levels.length === 1 ? 50 : 16 + (li * 68) / Math.max(1, levels.length - 1);
    row.forEach((n, i) => {
      const x = row.length === 1 ? 50 : 12 + (i * 76) / Math.max(1, row.length - 1);
      pos[n.id] = { x: Math.round(x), y: Math.round(y) };
    });
  });
  return pos;
}

export function doctrineToMap(graph) {
  const pos = layout(graph.nodes);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodes = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    sopRef: n.provenance?.clause_path ?? `${n.sop} ${n.clause}`,
    x: pos[n.id].x,
    y: pos[n.id].y,
    // 신뢰 데모용 메타(렌더 툴팁/감사): 원문 추적
    modality: n.modality,
    quote: n.provenance?.quote,
  }));
  const edges = (graph.edges ?? [])
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)) // 양 끝이 노드인 엣지만(섹션 부모 제외)
    .map((e) => ({ from: e.from, to: e.to, type: REL_TO_EDGE[e.relation] ?? "sequence" }));
  return { title: graph.scope ?? graph.domain, nodes, edges };
}
