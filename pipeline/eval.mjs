// 평가 하니스 — API 없이도 돈다. 충실성/스키마/결정론 게이트를 골든과 라이브 산출물에 동일 적용.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sliceSection } from "./lib/pdf.mjs";
import { validateDoctrineGraph, validateOverlay, summarize } from "./lib/validate.mjs";
import { ONTOLOGY_DIR, INPUT_DIR, OUT_DIR } from "./lib/paths.mjs";

const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", reset: "\x1b[0m", b: "\x1b[1m" };
const tag = (n) => (n ? `${C.red}FAIL${C.reset}` : `${C.green}PASS${C.reset}`);
let totalErrors = 0;

function report(title, issues, extra = "") {
  const s = summarize(issues);
  totalErrors += s.errors;
  console.log(`\n${C.b}${title}${C.reset}  ${tag(s.errors)} ${C.dim}(error ${s.errors} · warn ${s.warnings})${C.reset} ${extra}`);
  for (const i of issues) {
    const col = i.level === "error" ? C.red : C.yellow;
    console.log(`  ${col}[${i.level}]${C.reset} ${i.code}: ${i.msg}`);
  }
  if (!issues.length) console.log(`  ${C.dim}이슈 없음${C.reset}`);
}

console.log(`${C.b}FI:RECALL 파이프라인 평가${C.reset}  ${C.dim}(faithfulness · schema · 결정론 게이트)${C.reset}`);

// ── 데이터 로드 ───────────────────────────────────────────────
const golden = JSON.parse(readFileSync(join(ONTOLOGY_DIR, "example.sop-107.json"), "utf8"));
const slice = sliceSection("SOP-107");
const debrief01 = readFileSync(join(INPUT_DIR, "01_아파트화재_핫워시.md"), "utf8");
console.log(`${C.dim}SOP-107 슬라이스 ${slice.text.length}자 · 골든 노드 ${golden.doctrine_graph.nodes.length} · 복기 01 ${debrief01.length}자${C.reset}`);

// ── 1. 골든 교리 그래프 — 원문 대비 충실성/스키마/결정론 ──────────
const g = validateDoctrineGraph(golden.doctrine_graph, slice.text);
report("1. 골든 DoctrineGraph vs 실제 PDF 원문", g.issues);

// ── 2. 골든 복기 오버레이 — 복기 원문 대비 ────────────────────────
const o = validateOverlay(golden.debrief_overlay, debrief01, g.nodeIds);
report("2. 골든 DebriefOverlay vs 복기 01 원문", o.issues);

// ── 3. 라이브/추출 산출물(있으면) — 동일 게이트 ──────────────────
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR).filter((f) => f.startsWith("doctrine-graph.") && f.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(join(OUT_DIR, f), "utf8"));
    const r = validateDoctrineGraph(doc, slice.text);
    report(`3. 산출물 ${f} vs 실제 PDF 원문`, r.issues, `${C.dim}(extract.mjs 출력)${C.reset}`);
  }
} else {
  console.log(`\n${C.dim}3. out/ 산출물 없음 — extract.mjs 실행 후 재평가하면 라이브 출력도 채점됩니다.${C.reset}`);
}

console.log(`\n${C.b}결과:${C.reset} ${totalErrors === 0 ? `${C.green}전체 PASS${C.reset}` : `${C.red}${totalErrors}개 error${C.reset}`}`);
process.exit(totalErrors > 0 ? 1 : 0);
