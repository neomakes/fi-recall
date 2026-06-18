// ontology DoctrineGraph → 앱(Workbench)이 렌더하는 MapNode/MapEdge 형태로 투영.
// = 스키마 통합 브리지. provenance/modality는 보존(node에 동봉)하되 렌더 좌표 x/y를 부여.

const REL_TO_EDGE = { contains: "sequence", sequence: "sequence", dependency: "dependency", exception: "exception", reference: "dependency" };

// 결정론적 2D 레이아웃: 주(主) 섹션 번호(clause 첫 정수)를 열(column)로,
// 같은 섹션의 하위 조항을 행(row)으로 분산.
// 예) "1.1","1.3"→1열 / "2.6"→2열 / "3.1","3.2"→3열.
// (이전 버전은 점 개수를 레벨로 써서, SOP-107처럼 clause가 모두 단일 점이면
//  전부 한 줄에 겹쳐 깨졌다.)
function layout(nodes) {
  const section = (n) => parseInt(String(n.clause), 10) || 0; // "2.6" → 2, "2.6.1" → 2
  const byCol = new Map();
  for (const n of nodes) {
    const c = section(n);
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c).push(n);
  }
  const cols = [...byCol.keys()].sort((a, b) => a - b);
  const X0 = 14, X1 = 86, Y0 = 16, Y1 = 84;
  const pos = {};
  cols.forEach((c, ci) => {
    const x = cols.length === 1 ? 50 : Math.round(X0 + (ci * (X1 - X0)) / (cols.length - 1));
    const rows = byCol
      .get(c)
      .sort((a, b) => String(a.clause).localeCompare(String(b.clause), undefined, { numeric: true }));
    rows.forEach((n, ri) => {
      const y = rows.length === 1 ? 50 : Math.round(Y0 + (ri * (Y1 - Y0)) / (rows.length - 1));
      pos[n.id] = { x, y };
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
