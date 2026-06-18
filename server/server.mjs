// FI:RECALL 백엔드 — 의존성 0 Node 서버. 키를 서버에 보관하고 패스코드를 서버에서 검증.
// pipeline/lib 재사용. ANTHROPIC_API_KEY 있으면 라이브 추출, 없으면 골든으로 프론트 연동 테스트.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sliceSection } from "../pipeline/lib/pdf.mjs";
import { hasApiKey, callStructured } from "../pipeline/lib/anthropic.mjs";
import { MODEL_SCHEMA, EXTRACTION_RULES, buildUserContent } from "../pipeline/lib/prompt.mjs";
import { assemble } from "../pipeline/lib/assemble.mjs";
import { validateDoctrineGraph, summarize } from "../pipeline/lib/validate.mjs";
import { doctrineToMap } from "../pipeline/lib/project.mjs";
import { runReflectLive, overlayToApplied } from "../pipeline/lib/reflect.mjs";
import { ONTOLOGY_DIR } from "../pipeline/lib/paths.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const PASSCODE = process.env.FIRECALL_PASSCODE ?? "firecall"; // 서버 측 비번(클라 VITE 비번과 별개)
const golden = JSON.parse(readFileSync(join(ONTOLOGY_DIR, "example.sop-107.json"), "utf8"));
const goldenById = Object.fromEntries(golden.doctrine_graph.nodes.map((n) => [n.id, n]));

if (!process.env.FIRECALL_PASSCODE) console.warn("⚠ FIRECALL_PASSCODE 미설정 — 기본값 'firecall' 사용(데모용).");
console.log(`키 모드: ${hasApiKey() ? "live (claude-opus-4-8)" : "offline (golden stand-in)"}`);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-firecall-passcode",
};
const send = (res, code, body) =>
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", ...CORS }).end(JSON.stringify(body));

const readBody = (req) =>
  new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve(null); } });
  });

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/api/health")
    return send(res, 200, { ok: true, mode: hasApiKey() ? "live" : "offline" });

  if (req.method === "POST" && (url.pathname === "/api/extract" || url.pathname === "/api/reflect")) {
    // 서버 측 패스코드 게이트 — 토큰 비용 보호의 실제 경계.
    if (req.headers["x-firecall-passcode"] !== PASSCODE) return send(res, 401, { error: "unauthorized", message: "접근 코드 불일치" });
    const body = await readBody(req);
    if (!body) return send(res, 400, { error: "bad_json" });

    try {
      if (url.pathname === "/api/extract") {
        const { sop = "SOP-107", debrief = null } = body;
        const slice = sliceSection(sop);
        let graph, mode;
        if (hasApiKey()) {
          const out = await callStructured({
            system: EXTRACTION_RULES,
            userContent: buildUserContent({ fewshot: golden.doctrine_graph, sopText: slice.text, debrief }),
            schema: MODEL_SCHEMA,
          });
          graph = assemble(out.parsed);
          mode = "live";
        } else {
          graph = golden.doctrine_graph;
          mode = "offline";
        }
        const { issues } = validateDoctrineGraph(graph, slice.text);
        const sum = summarize(issues);
        if (sum.errors > 0) return send(res, 422, { error: "validation_failed", mode, issues }); // 충실성 게이트
        return send(res, 200, { mode, map: doctrineToMap(graph), validation: sum });
      }

      // /api/reflect
      const { debrief, nodes = [], priorCounts = {} } = body;
      if (!debrief) return send(res, 400, { error: "missing_debrief" });
      const applied = hasApiKey()
        ? await runReflectLive({ debrief, nodes, priorCounts })
        : overlayToApplied(golden.debrief_overlay, goldenById);
      return send(res, 200, { mode: hasApiKey() ? "live" : "offline", applied });
    } catch (e) {
      return send(res, 500, { error: "pipeline_error", message: String(e.message ?? e) });
    }
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => console.log(`FI:RECALL 백엔드 → http://localhost:${PORT}  (POST /api/extract · /api/reflect)`));
