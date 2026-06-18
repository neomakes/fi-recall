// SOP(+선택적 복기) → 교리 그래프 추출. API 키 있으면 라이브, 없으면 골든을 stand-in으로 plumbing 검증.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sliceSection } from "./lib/pdf.mjs";
import { hasApiKey, callStructured } from "./lib/anthropic.mjs";
import { MODEL_SCHEMA, EXTRACTION_RULES, buildUserContent } from "./lib/prompt.mjs";
import { assemble } from "./lib/assemble.mjs";
import { validateDoctrineGraph, summarize } from "./lib/validate.mjs";
import { ONTOLOGY_DIR, OUT_DIR } from "./lib/paths.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const sop = arg("sop", "SOP-107");
const debriefPath = arg("debrief", null);
const slice = sliceSection(sop);
const debrief = debriefPath ? readFileSync(debriefPath, "utf8") : null;
const golden = JSON.parse(readFileSync(join(ONTOLOGY_DIR, "example.sop-107.json"), "utf8"));

let graph, mode, usage;
if (hasApiKey()) {
  const out = await callStructured({
    system: EXTRACTION_RULES,
    userContent: buildUserContent({ fewshot: golden.doctrine_graph, sopText: slice.text, debrief }),
    schema: MODEL_SCHEMA,
  });
  graph = assemble(out.parsed);
  usage = out.usage;
  mode = "live (claude-opus-4-8)";
} else {
  graph = golden.doctrine_graph; // 오프라인: 골든을 모델 출력 stand-in으로 → 검증 경로만 점검
  mode = "offline (golden stand-in — 라이브 추출 아님)";
}

const { issues } = validateDoctrineGraph(graph, slice.text);
const sum = summarize(issues);

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `doctrine-graph.${sop}.json`);
writeFileSync(outPath, JSON.stringify(graph, null, 2));

console.log(`▶ extract ${sop}  [${mode}]`);
console.log(`  슬라이스: ${slice.text.length}자 · 노드 ${graph.nodes.length} · 엣지 ${graph.edges.length}`);
if (usage) console.log(`  토큰: in ${usage.input_tokens} / out ${usage.output_tokens}`);
console.log(`  검증: error ${sum.errors} · warn ${sum.warnings}`);
for (const i of issues) console.log(`    [${i.level}] ${i.code}: ${i.msg}`);
console.log(`  → ${outPath}`);
process.exit(sum.errors > 0 ? 1 : 0);
