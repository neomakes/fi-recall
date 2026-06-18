import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge, Button } from "../components/ui";
import {
  DOCTRINE_MAP,
  FEEDBACKS,
  NODE_KEYWORDS,
  type Drill,
  type MapNode,
  type Revision,
} from "../data/fixtures";
import { api, apiConfigured } from "../lib/api";

type SopStatus = "idle" | "processing" | "done";

// 렌더용 느슨한 지도 타입 — 픽스처(MapNode)와 라이브(api MapNode) 둘 다 수용.
type AnyMap = { title: string; nodes: any[]; edges: any[] };

/* 좌표 자가복구 — 라이브 백엔드가 좌표를 한 줄로 붕괴시켜(옛 레이아웃) 보내거나
   x/y가 비면, id의 조항번호로 섹션(열)×하위(행) 2D 재배치한다.
   서버가 올바른 좌표를 주면 그대로 통과(붕괴 감지 시에만 개입). */
function clauseOf(id: string): string {
  const m = String(id).match(/(\d+(?:\.\d+)*)\s*$/);
  return m ? m[1] : String(id);
}
function relayout(nodes: any[]): Record<string, { x: number; y: number }> {
  const byCol = new Map<number, any[]>();
  for (const n of nodes) {
    const c = parseInt(clauseOf(n.id), 10) || 0;
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c)!.push(n);
  }
  const cols = [...byCol.keys()].sort((a, b) => a - b);
  const X0 = 14, X1 = 86, Y0 = 16, Y1 = 84;
  const pos: Record<string, { x: number; y: number }> = {};
  cols.forEach((c, ci) => {
    const x = cols.length === 1 ? 50 : Math.round(X0 + (ci * (X1 - X0)) / (cols.length - 1));
    const rows = byCol.get(c)!.slice().sort((a, b) =>
      clauseOf(a.id).localeCompare(clauseOf(b.id), undefined, { numeric: true }));
    rows.forEach((n, ri) => {
      const y = rows.length === 1 ? 50 : Math.round(Y0 + (ri * (Y1 - Y0)) / (rows.length - 1));
      pos[n.id] = { x, y };
    });
  });
  return pos;
}
// 고립 노드(엣지 0개) 자가연결 — 같은 섹션의 가장 가까운 조항에 sequence 엣지로 잇는다.
// (스테일 백엔드가 contains 누락으로 외톨이 노드를 보내도 화면에선 연결.)
function connectOrphans(map: AnyMap): AnyMap {
  const ids = new Set(map.nodes.map((n) => n.id));
  const deg: Record<string, number> = {};
  for (const n of map.nodes) deg[n.id] = 0;
  for (const e of map.edges) { if (ids.has(e.from)) deg[e.from]++; if (ids.has(e.to)) deg[e.to]++; }
  const orphans = map.nodes.filter((n) => deg[n.id] === 0);
  if (!orphans.length) return map;
  const sectionOf = (n: any) => parseInt(clauseOf(n.id), 10) || 0;
  const seen = new Set(map.edges.map((e) => [e.from, e.to].sort().join("|")));
  const extra: any[] = [];
  for (const o of orphans) {
    const sec = sectionOf(o);
    const cands = map.nodes.filter((n) => n.id !== o.id);
    const sib =
      cands.filter((n) => sectionOf(n) === sec)
        .sort((a, b) => clauseOf(a.id).localeCompare(clauseOf(b.id), undefined, { numeric: true }))[0] ??
      cands.slice().sort((a, b) => Math.abs(sectionOf(a) - sec) - Math.abs(sectionOf(b) - sec))[0];
    if (!sib) continue;
    const [from, to] =
      clauseOf(o.id).localeCompare(clauseOf(sib.id), undefined, { numeric: true }) <= 0 ? [o.id, sib.id] : [sib.id, o.id];
    const k = [from, to].sort().join("|");
    if (!seen.has(k)) { seen.add(k); extra.push({ from, to, type: "sequence" }); }
  }
  return extra.length ? { ...map, edges: [...map.edges, ...extra] } : map;
}

function normalizeMap(map: AnyMap): AnyMap {
  if (!map?.nodes?.length) return map;
  let out = map;
  // (a) 좌표 붕괴(한 줄/한 열/비수치) 복구
  if (map.nodes.length > 1) {
    const ys = new Set(map.nodes.map((n) => n.y));
    const xs = new Set(map.nodes.map((n) => n.x));
    const collapsed =
      ys.size <= 1 || xs.size <= 1 || map.nodes.some((n) => typeof n.x !== "number" || typeof n.y !== "number");
    if (collapsed) {
      const pos = relayout(map.nodes);
      out = { ...out, nodes: out.nodes.map((n) => ({ ...n, x: pos[n.id]?.x ?? n.x ?? 50, y: pos[n.id]?.y ?? n.y ?? 50 })) };
    }
  }
  // (b) 고립 노드 연결
  return connectOrphans(out);
}

interface DebriefDoc {
  id: string;
  name: string;
  title: string;
  raw: string;
  kind: "sample" | "uploaded";
  fixtureId?: string;
}

interface Applied {
  docId: string;
  source: string;
  litNodes: string[];
  recurrence: { nodeId: string; count: number }[];
  revisions: Revision[];
  drills: Drill[];
  heuristic: boolean;
}

/* 예시 SOP = Desktop input/ 의 표준작전절차 문서 */
const EXAMPLE_SOP = "재난현장표준작전절차.pdf";

/* 샘플 디브리프 = Desktop input/ 핫워시 보고서 전문(.md)을 그대로 번들.
   파일명 접두로 그라운딩 픽스처(F1·F2·F3)를 연결, 나머지는 휴리스틱. */
const RAW_DEBRIEFS = import.meta.glob("../debriefs/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const FIXTURE_BY_FILE: { prefix: string; id: string }[] = [
  { prefix: "01_아파트화재", id: "F1" },
  { prefix: "06_지하철역", id: "F2" },
  { prefix: "02_화학공장폭발", id: "F3" },
];

const SAMPLE_DOCS: DebriefDoc[] = Object.entries(RAW_DEBRIEFS)
  .map(([path, raw]) => {
    const name = path.split("/").pop()!;
    const key = name.replace(/\.md$/, "");
    const heading = raw.split("\n").find((l) => l.trim().startsWith("#"));
    const title = heading ? heading.replace(/^#+\s*/, "").replace(/^핫워시 보고서\s*[—-]\s*/, "").trim() : key;
    return {
      id: name,
      name,
      title,
      raw,
      kind: "sample" as const,
      fixtureId: FIXTURE_BY_FILE.find((f) => key.startsWith(f.prefix))?.id,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/* ── 토글 스위치 ──────────────────────────────────────────────── */
function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button onClick={onChange}
      style={{ all: "unset", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, flex: "none", position: "relative",
        background: on ? "var(--ember-500)" : "var(--bg-elevated)",
        border: "1px solid var(--border-hair)", transition: "background .2s var(--ease-soft)" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999,
          background: "#fff", boxShadow: "var(--shadow-sm)", transition: "left .2s var(--ease-out)" }} />
      </span>
      <span style={{ fontSize: "var(--fs-sm)", color: on ? "var(--text-strong)" : "var(--text-muted)", fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (/\.pdf$/i.test(file.name)) {
      resolve("〔PDF 문서〕 본문 미리보기는 파이프라인 파싱(PDF→텍스트) 연결 후 제공됩니다.\n파일명: " + file.name);
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.readAsText(file);
  });
}

/* ── Dropzone ─────────────────────────────────────────────────── */
function Dropzone({
  label, hint, accept, multiple, onFiles,
}: { label: string; hint: string; accept: string; multiple?: boolean; onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`dropzone${drag ? " dropzone--drag" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(Array.from(e.dataTransfer.files)); }}
    >
      <span className="dropzone__icon">⤓</span>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "var(--fs-xs)" }}>{hint}</span>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden
        onChange={(e) => { if (e.target.files) onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
    </div>
  );
}

/* ── 중앙: 교리 지도 ──────────────────────────────────────────── */
const NODE_TYPE_KO: Record<string, string> = { procedure: "절차", decision: "판단점", hazard: "위험", standard: "표준" };
const EDGE_KO: Record<string, string> = { sequence: "선후", dependency: "의존", exception: "예외" };

type Selection = { kind: "node"; id: string } | { kind: "edge"; idx: number } | null;

function DoctrineMapView({ status, progress, lit, recur, map }: {
  status: SopStatus; progress: number; lit: Set<string>; recur: Set<string>; map: AnyMap;
}) {
  const byId = useMemo(
    () => Object.fromEntries(map.nodes.map((n) => [n.id, n])) as Record<string, MapNode>, [map]
  );
  const edgeColor = (t: string) =>
    t === "exception" ? "var(--node-hazard)" : t === "dependency" ? "var(--node-procedure)" : "var(--border-soft)";

  // 2D 패닝/줌 뷰포트
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [sel, setSel] = useState<Selection>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      setView((v) => {
        const s = Math.min(2.6, Math.max(0.5, v.s * (e.deltaY < 0 ? 1.12 : 0.89)));
        const k = s / v.s;
        return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status]);

  function onDown(e: React.MouseEvent) { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; setGrabbing(true); }
  function onMove(e: React.MouseEvent) {
    if (!drag.current) return;
    const d = drag.current;
    setView((v) => ({ ...v, x: e.clientX - d.x, y: e.clientY - d.y }));
  }
  function endDrag() { drag.current = null; setGrabbing(false); }
  function zoom(f: number) { setView((v) => ({ ...v, s: Math.min(2.6, Math.max(0.5, v.s * f)) })); }

  if (status === "idle") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 34, color: "var(--text-faint)", marginBottom: 10 }}>◫</div>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", maxWidth: 260 }}>
            ① 왼쪽에서 <span style={{ color: "var(--ember-400)" }}>SOP 문서를 적재</span>하면
            교리 지도(절차·판단점·위험 노드)가 생성됩니다.
          </p>
        </div>
      </div>
    );
  }
  if (status === "processing") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}>
        <div style={{ width: 280 }}>
          <div className="spinner" style={{ margin: "0 auto 14px", width: 22, height: 22 }} />
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>
            교리 지도 생성 중 — 개념 추출 · 선후/의존/예외 엣지 최적화…
          </p>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: 8 }}>{progress}%</div>
        </div>
      </div>
    );
  }
  return (
    <div ref={wrapRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={endDrag} onMouseLeave={endDrag}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, overflow: "hidden",
        cursor: grabbing ? "grabbing" : "grab", userSelect: "none" }}>
      {/* 팬/줌 변환 레이어 */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0",
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
        transition: grabbing ? "none" : "transform 0.12s ease-out" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, overflow: "visible" }}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--text-faint)" strokeWidth="1.2" />
            </marker>
          </defs>
          {map.edges.map((e, i) => {
            const a = byId[e.from], b = byId[e.to];
            const active = lit.has(e.from) && lit.has(e.to);
            const isSel = sel?.kind === "edge" && sel.idx === i;
            return (
              <g key={i}>
                <motion.line initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                  x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                  stroke={isSel ? "var(--ember-400)" : active ? "var(--ember-500)" : edgeColor(e.type)}
                  strokeWidth={isSel ? 3 : active ? 2 : 1.2} strokeOpacity={isSel ? 1 : active ? 0.9 : 0.5}
                  strokeDasharray={e.type === "exception" ? "5 4" : e.type === "dependency" ? "2 4" : "0"}
                  markerEnd="url(#arrow)" style={{ transition: "stroke 0.3s, stroke-width 0.3s" }} />
                {/* 넓은 투명 히트 영역 — 엣지 클릭용 */}
                <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                  stroke="transparent" strokeWidth={16} style={{ cursor: "pointer" }}
                  onMouseDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => { ev.stopPropagation(); setSel({ kind: "edge", idx: i }); }} />
              </g>
            );
          })}
        </svg>
        {map.nodes.map((n, i) => {
          const isLit = lit.has(n.id); const isRecur = recur.has(n.id);
          const isSel = sel?.kind === "node" && sel.id === n.id;
          return (
            // anchor: 위치 고정(중앙 정렬). transform을 motion이 덮어쓰지 않도록 분리.
            <div key={n.id}
              style={{ position: "absolute", left: `${n.x}%`, top: `${n.y}%`,
                transform: "translate(-50%, -50%)", zIndex: isLit ? 3 : 2 }}
              onMouseDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => { ev.stopPropagation(); setSel({ kind: "node", id: n.id }); }}>
              {/* inner: 애니메이션(등장+점등 scale)만 담당 — 중앙 기준 scale이라 위치 불변 */}
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: isLit ? 1.06 : 1 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={`map-node map-node--${n.type}${isLit ? " map-node--lit" : ""}${isRecur ? " map-node--recur" : ""}`}
                style={{ cursor: "pointer", outline: isSel ? "2px solid var(--ember-400)" : undefined, outlineOffset: 2 }}>
                {isRecur && <span className="map-node__recur">▲ 재발</span>}
                <div className="map-node__top">
                  <span className="status-dot" style={{ background: `var(--node-${n.type})`, boxShadow: "none" }} />
                  <span className="map-node__id">{n.id}</span>
                </div>
                <span className="map-node__label">{n.label}</span>
                <span className="map-node__id">{n.sopRef}</span>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* 줌 컨트롤 */}
      <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 5 }}>
        <button className="btn btn--icon" style={{ width: 34, height: 34 }} onClick={() => zoom(1.18)} title="확대">＋</button>
        <button className="btn btn--icon" style={{ width: 34, height: 34 }} onClick={() => zoom(0.85)} title="축소">－</button>
        <button className="btn btn--icon" style={{ width: 34, height: 34 }} onClick={() => setView({ x: 0, y: 0, s: 1 })} title="초기화">⤢</button>
      </div>
      <div className="mono" style={{ position: "absolute", left: 12, top: 12, zIndex: 5,
        fontSize: 10, color: "var(--text-faint)", pointerEvents: "none" }}>
        드래그 이동 · 휠 확대/축소 · 엣지/노드 클릭 {Math.round(view.s * 100)}%
      </div>

      {/* 교리·출처 상세 카드 */}
      <AnimatePresence>
        {sel && <DoctrineDetail sel={sel} byId={byId} map={map} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* 엣지/노드 클릭 → 관련 교리 + 출처 */
function DoctrineDetail({ sel, byId, map, onClose }: { sel: NonNullable<Selection>; byId: Record<string, MapNode>; map: AnyMap; onClose: () => void }) {
  const isEdge = sel.kind === "edge";
  const edge = isEdge ? map.edges[sel.idx] : null;
  const nodes = isEdge ? [byId[edge!.from], byId[edge!.to]] : [byId[sel.id]];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="card" style={{ position: "absolute", left: 14, bottom: 14, zIndex: 6, width: 340, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        {isEdge ? (
          <Badge>관계 · {EDGE_KO[edge!.type]} ({edge!.from}→{edge!.to})</Badge>
        ) : (
          <Badge>{NODE_TYPE_KO[nodes[0].type]} · {nodes[0].id}</Badge>
        )}
        <button className="btn btn--icon" style={{ width: 28, height: 28 }} onClick={onClose}>✕</button>
      </div>
      {isEdge && (
        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 12 }}>
          <span style={{ color: "var(--text-secondary)" }}>{nodes[0].label}</span> 절차는{" "}
          <span style={{ color: "var(--ember-400)" }}>{EDGE_KO[edge!.type]}</span> 관계로{" "}
          <span style={{ color: "var(--text-secondary)" }}>{nodes[1].label}</span>로 이어집니다.
        </p>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {nodes.map((n) => (
          <div key={n.id} className="inset" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span className="status-dot" style={{ background: `var(--node-${n.type})`, boxShadow: "none" }} />
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-strong)" }}>{n.label}</span>
            </div>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 8 }}>{(n as any).clause ?? (n as any).quote}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="label-eyebrow">출처</span>
              <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ember-400)" }}>
                {map.title} · {n.sopRef}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 우측: 결과 ───────────────────────────────────────────────── */
function Results({ applied, closed, onClose, nodes }: { applied: Applied | null; closed: boolean; onClose: () => void; nodes: any[] }) {
  if (!applied) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center", padding: 24 }}>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", maxWidth: 220 }}>
          복기를 골라 <span style={{ color: "var(--ember-400)" }}>반영하기</span>를 누르면
          닿는 교리 노드와 격차별 산출이 나타납니다.
        </p>
      </div>
    );
  }
  return (
    <motion.div key={applied.docId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} style={{ display: "grid", gap: 14 }}>
      {closed && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="inset" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center",
            borderColor: "rgba(63,185,96,0.4)", background: "rgba(63,185,96,0.08)" }}>
          <span className="status-dot status-dot--good" />
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-strong)", fontWeight: 600 }}>
            격차 종결 — 교리/훈련에 반영됨. 학습 루프가 닫혔습니다.
          </span>
        </motion.div>
      )}
      <div className="inset" style={{ padding: 12 }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>태깅된 교리 노드</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {applied.litNodes.map((id) => {
            const n = nodes.find((x) => x.id === id);
            if (!n) return null;
            return (
              <span key={id} className={`node-chip node-chip--${n.type}`} style={{ padding: "5px 11px" }}>
                <span className="node-chip__dot" /><span className="node-chip__id">{id}</span>
                <span style={{ fontSize: "var(--fs-xs)" }}>{n.label}</span>
              </span>
            );
          })}
          {applied.litNodes.length === 0 && (
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>매칭된 노드 없음.</span>
          )}
        </div>
      </div>

      {applied.heuristic && (
        <div className="inset" style={{ padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="status-dot status-dot--warn" />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            업로드 문서 — 키워드 휴리스틱 매핑입니다. 격차 분류·수정안/drill은 Claude 파이프라인 연결 후 생성됩니다.
          </span>
        </div>
      )}

      {applied.recurrence.length > 0 && (
        <div className="inset" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Badge tone="recur">▲ 재발 {applied.recurrence[0].count}회</Badge>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
            <span className="mono" style={{ color: "var(--recurrence)" }}>{applied.recurrence[0].nodeId}</span> 지점에서 과거 동일 교훈 반복.
          </span>
        </div>
      )}

      {applied.revisions.map((r) => (
        <div key={r.nodeId} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Badge tone="ember">교리 격차 · SOP 수정</Badge>
            <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{r.nodeId}</span>
          </div>
          <code className="diff-line diff-line--del">{r.currentText}</code>
          <code className="diff-line diff-line--add">{r.proposedText}</code>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{r.justification}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button variant="primary" style={{ flex: 1, padding: "9px 14px" }} disabled={closed} onClick={onClose}>
              {closed ? "✓ 채택됨" : "수정안 채택"}
            </Button>
            <Button variant="ghost" style={{ padding: "9px 14px" }}>보류</Button>
          </div>
        </div>
      ))}

      {applied.drills.map((d) => (
        <div key={d.nodeId} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Badge tone="teal">실행 격차 · 재훈련 drill</Badge>
            <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{d.nodeId}</span>
          </div>
          <h3 style={{ fontSize: "var(--fs-h3)", marginBottom: 6 }}>{d.title}</h3>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)", marginBottom: 12 }}>{d.objective}</p>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {d.steps.map((s, i) => (
              <li key={i} style={{ fontSize: "var(--fs-sm)", color: "var(--text-primary)", lineHeight: 1.5 }}>{s}</li>
            ))}
          </ol>
          <div className="inset" style={{ padding: "10px 12px", marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <span className="status-dot status-dot--good" />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>성공기준 — {d.successCriteria}</span>
          </div>
          <Button variant="ghost" style={{ width: "100%", marginTop: 12 }} disabled={closed} onClick={onClose}>
            {closed ? "✓ 훈련계획에 추가됨" : "훈련계획에 추가"}
          </Button>
        </div>
      ))}
    </motion.div>
  );
}

/* ── 페이지 ───────────────────────────────────────────────────── */
export default function Workbench() {
  const [tab, setTab] = useState<"sop" | "debrief">("sop");
  const [uploadedSop, setUploadedSop] = useState<string | null>(null);
  const [sampleSop, setSampleSop] = useState(true);
  const [sopStatus, setSopStatus] = useState<SopStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<DebriefDoc[]>([]);
  const [showSamples, setShowSamples] = useState(true);
  const [viewing, setViewing] = useState<DebriefDoc | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(SAMPLE_DOCS[0]?.id ?? null);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [closed, setClosed] = useState(false);
  const [liveMap, setLiveMap] = useState<AnyMap | null>(null); // 백엔드 추출 결과(있으면 픽스처 대신)
  const live = apiConfigured();

  // 렌더에 쓰는 활성 지도: 라이브 추출본 우선, 없으면 픽스처.
  const activeMap: AnyMap = liveMap ?? DOCTRINE_MAP;

  // 예시 토글 ON이면 input/ 예시 파일을 기본 선택지로 노출
  const sopName = uploadedSop ?? (sampleSop ? EXAMPLE_SOP : null);
  const docs = useMemo<DebriefDoc[]>(
    () => (showSamples ? [...uploaded, ...SAMPLE_DOCS] : uploaded),
    [uploaded, showSamples]
  );

  function toggleSampleSop() {
    setSampleSop((s) => {
      const next = !s;
      if (!next && !uploadedSop) { setSopStatus("idle"); setProgress(0); setApplied(null); }
      return next;
    });
  }
  function toggleSamples() {
    setShowSamples((s) => {
      const next = !s;
      if (!next && SAMPLE_DOCS.some((d) => d.id === selectedDoc)) setSelectedDoc(uploaded[0]?.id ?? null);
      return next;
    });
  }

  const lit = useMemo(() => new Set(applied?.litNodes ?? []), [applied]);
  const recur = useMemo(() => new Set((applied?.recurrence ?? []).map((r) => r.nodeId)), [applied]);
  const mapReady = sopStatus === "done";

  /* SOP 적재 → 처리 중 → 완료 (교리 지도 생성) */
  async function generateMap() {
    if (!sopName) return;
    setSopStatus("processing"); setProgress(0); setApplied(null); setClosed(false); setLiveMap(null);
    // 처리 중 진행바(UX용)
    const t = setInterval(() => setProgress((p) => Math.min(95, p + 8)), 90);

    if (live) {
      try {
        const { map } = await api.extract({ sop: "SOP-107", debrief: null });
        clearInterval(t); setProgress(100); setLiveMap(normalizeMap(map)); setSopStatus("done");
        return;
      } catch (e) {
        clearInterval(t);
        alert(`백엔드 추출 실패 — 픽스처로 폴백합니다.\n${(e as Error).message}`);
        // 폴백: 픽스처 지도
      }
    }
    clearInterval(t); setProgress(100); setLiveMap(null); setSopStatus("done");
  }

  function onSopFiles(files: File[]) {
    if (!files[0]) return;
    setUploadedSop(files[0].name); setSopStatus("idle"); setProgress(0); setApplied(null);
  }

  async function onDebriefFiles(files: File[]) {
    const added: DebriefDoc[] = [];
    for (const f of files) {
      const raw = await readAsText(f);
      added.push({
        id: `U-${f.name}-${f.size}`, name: f.name,
        title: raw.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 40) || f.name,
        raw, kind: "uploaded",
      });
    }
    setUploaded((prev) => [...added, ...prev.filter((p) => !added.some((a) => a.id === p.id))]);
    if (added[0]) setSelectedDoc(added[0].id);
  }

  async function applyDoc() {
    const doc = docs.find((d) => d.id === selectedDoc);
    if (!doc || !mapReady) return;
    setClosed(false);

    // 라이브: 백엔드가 grounding·격차분류·생성을 수행 (오프라인 백엔드는 골든 stand-in)
    if (live) {
      try {
        const { applied: a } = await api.reflect({ debrief: doc.raw, nodes: activeMap.nodes });
        setApplied({ docId: doc.id, source: doc.title, litNodes: a.litNodes,
          recurrence: a.recurrence, revisions: a.revisions, drills: a.drills, heuristic: a.heuristic ?? false });
        return;
      } catch (e) {
        alert(`백엔드 반영 실패 — 픽스처로 폴백합니다.\n${(e as Error).message}`);
      }
    }

    // 폴백: 픽스처 프리셋 / 키워드 휴리스틱
    if (doc.fixtureId) {
      const fb = FEEDBACKS.find((f) => f.id === doc.fixtureId)!;
      setApplied({ docId: doc.id, source: fb.source, litNodes: fb.litNodes, recurrence: fb.recurrence, revisions: fb.revisions, drills: fb.drills, heuristic: false });
    } else {
      const text = doc.raw.toLowerCase();
      const litNodes = Object.entries(NODE_KEYWORDS)
        .filter(([, kws]) => kws.some((k) => text.includes(k.toLowerCase())))
        .map(([id]) => id);
      setApplied({ docId: doc.id, source: doc.title, litNodes, recurrence: [], revisions: [], drills: [], heuristic: true });
    }
  }

  /* ── 진행 단계 머신 ───────────────────────────────────────────
     phase = 현재 진행 중인(active) 단계 인덱스. 단계 완료 시 자동 전진.
       0 SOP 적재   : SOP 생성 시작 전
       1 교리 지도   : 생성 처리 중
       2 복기 반영   : 지도 완료 후 복기 대기
       3 격차 종결   : 복기 반영됨 → 채택(종결)으로 마무리
  --------------------------------------------------------------- */
  const phase = closed ? 4 : applied ? 3 : mapReady ? 2 : sopStatus === "processing" ? 1 : 0;
  const STEP_LABELS = ["SOP 적재", "교리 지도", "복기 반영", "격차 종결"];
  const steps = STEP_LABELS.map((label, i) => ({
    label,
    state: (i < phase ? "done" : i === phase ? "active" : "todo") as "done" | "active" | "todo",
  }));

  /* 자동 전환: 한 단계가 끝나면 다음 단계의 입력 컨텍스트로 이동 */
  useEffect(() => {
    // 교리 지도 생성이 끝나면(2단계 진입) 좌측 패널을 '복기' 탭으로 자동 전환
    if (phase === 2) setTab("debrief");
    // 초기/지도 재생성 단계로 돌아오면 'SOP' 탭으로
    if (phase === 0 || phase === 1) setTab("sop");
  }, [phase]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 22px", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em" }}>
            FI<span style={{ color: "var(--ember-500)" }}>:</span>RECALL
          </span>
          <span className="label-eyebrow">복기 반영 워크벤치</span>
        </div>
        <div className="stepper" style={{ transform: "scale(0.8)", transformOrigin: "right" }}>
          {steps.map((s, i, arr) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
              <div className={`step step--${s.state}`}>
                <div className="step__icon">{s.state === "done" ? "✓" : s.state === "active" ? "◧" : "○"}</div>
                <div className="step__label">{s.label}</div>
              </div>
              {i < arr.length - 1 && <div className="step__line" style={{ width: 52 }} />}
            </div>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "330px 1fr 384px", gap: 16 }}>
        {/* 좌: INPUT */}
        <div className="zone">
          <div className="zone__head">
            <div className="seg">
              <button className={`seg__btn${tab === "sop" ? " seg__btn--on" : ""}`} onClick={() => setTab("sop")}>SOP 교리</button>
              <button className={`seg__btn${tab === "debrief" ? " seg__btn--on" : ""}`} onClick={() => setTab("debrief")}>
                현장 복기 {docs.length > 0 && <span className="mono" style={{ opacity: 0.7 }}>· {docs.length}</span>}
              </button>
            </div>
          </div>

          <div className="zone__body" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            {tab === "sop" ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Switch on={sampleSop} onChange={toggleSampleSop} label="예시 SOP 사용" />
                  <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>input/</span>
                </div>
                <Dropzone label="SOP 문서 업로드" hint="재난현장 표준작전절차 · PDF / MD / TXT"
                  accept=".pdf,.md,.txt,.markdown" onFiles={onSopFiles} />
                {sopName && (
                  <div className="doc-item" style={{ cursor: "default" }}>
                    <div className="doc-item__body">
                      <div className="doc-item__name">{sopName}</div>
                      <div className="doc-item__meta">SOP 교리집 · {uploadedSop ? "업로드" : "예시"}</div>
                    </div>
                    <span className={`pill pill--${sopStatus}`}>
                      {sopStatus === "idle" && "처리 전"}
                      {sopStatus === "processing" && <><span className="spinner" />처리 중</>}
                      {sopStatus === "done" && "✓ 완료"}
                    </span>
                  </div>
                )}
                {sopStatus === "done" && (
                  <div className="inset" style={{ padding: "10px 12px", fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>
                    교리 지도 생성됨{live ? " · 라이브" : ""} — 노드 <span className="mono" style={{ color: "var(--ember-400)" }}>{activeMap.nodes.length}</span>개 · 엣지 <span className="mono" style={{ color: "var(--ember-400)" }}>{activeMap.edges.length}</span>개
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Switch on={showSamples} onChange={toggleSamples} label="예시 복기 표시" />
                  <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>input/ · {SAMPLE_DOCS.length}건</span>
                </div>
                <Dropzone label="현장 복기 업로드 (여러 개)" hint="핫워시 보고서 · MD / TXT / PDF"
                  accept=".md,.txt,.markdown,.pdf" multiple onFiles={onDebriefFiles} />
                <div className="label-eyebrow" style={{ marginTop: 2 }}>적재된 복기 · {docs.length}건</div>
                {docs.map((d) => (
                  <div key={d.id} className={`doc-item${selectedDoc === d.id ? " doc-item--on" : ""}`}>
                    <button onClick={() => setSelectedDoc(d.id)} style={{ all: "unset", flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div className="doc-item__name">{d.title}</div>
                      <div className="doc-item__meta">{d.name} · {d.kind === "sample" ? "샘플" : "업로드"}</div>
                    </button>
                    <button className="doc-item__view" onClick={() => setViewing(d)}>보기</button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 하단 고정 액션 — 항상 사이드바 맨 아래 */}
          <div className="zone__foot">
            {tab === "sop" ? (
              <Button variant="primary" style={{ width: "100%" }}
                disabled={!sopName || sopStatus === "processing"} onClick={generateMap}>
                {sopStatus === "done" ? "교리 지도 재생성" : "교리 지도 생성 →"}
              </Button>
            ) : (
              <>
                <Button variant="primary" style={{ width: "100%" }}
                  disabled={!mapReady || !selectedDoc} onClick={applyDoc}>
                  반영하기 →
                </Button>
                {!mapReady && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", textAlign: "center" }}>
                    먼저 <span style={{ color: "var(--ember-400)" }}>SOP 교리</span>를 적재해 지도를 생성하세요.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 중앙: 교리 지도 */}
        <div className="zone">
          <div className="zone__head">
            <div>
              <div className="label-eyebrow">교리 지도 · SOP 온톨로지</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h3)", marginTop: 2 }}>
                {mapReady ? activeMap.title : "교리 지도 미생성"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["procedure", "decision", "hazard", "standard"] as const).map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                  <span className="status-dot" style={{ background: `var(--node-${t})`, boxShadow: "none" }} />
                  {{ procedure: "절차", decision: "판단점", hazard: "위험", standard: "표준" }[t]}
                </span>
              ))}
            </div>
          </div>
          <div className="zone__body" style={{ overflow: "hidden" }}>
            <DoctrineMapView status={sopStatus} progress={progress} lit={lit} recur={recur} map={activeMap} />
          </div>
        </div>

        {/* 우: RESULTS */}
        <div className="zone">
          <div className="zone__head">
            <span className="label-eyebrow">격차 종결</span>
            {applied && (
              <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ember-400)" }}>
                {applied.litNodes.length} nodes tagged
              </span>
            )}
          </div>
          <div className="zone__body"><Results applied={applied} closed={closed} onClose={() => setClosed(true)} nodes={activeMap.nodes} /></div>
        </div>
      </div>

      {/* 문서 뷰어 모달 */}
      <AnimatePresence>
        {viewing && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setViewing(null)}>
            <motion.div className="modal" initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} onClick={(e) => e.stopPropagation()}>
              <div className="modal__head">
                <div>
                  <div className="label-eyebrow">{viewing.kind === "sample" ? "샘플 복기" : "업로드 복기"}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h3)", marginTop: 2 }}>{viewing.title}</div>
                  <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: 2 }}>{viewing.name}</div>
                </div>
                <Button variant="icon" onClick={() => setViewing(null)}>✕</Button>
              </div>
              <div className="modal__body">{viewing.raw}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
