// SOP 목차(TOC) → sop-index.json (triage 라우팅용: id + 제목 + TOC페이지).
// best-effort 파서. 슬라이싱은 sections.mjs의 검증된 범위를 쓰므로 여기 페이지는 참고값.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PDF, OUT_DIR } from "./lib/paths.mjs";

const DOMAIN_BY_HUNDRED = { 1: "command", 2: "fire", 3: "accident", 4: "ems", 5: "situation" };

const toc = execFileSync("pdftotext", ["-f", "2", "-l", "8", PDF, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const seen = new Map();
for (const line of toc.split("\n")) {
  const m = line.match(/(SOP|SSG)\s*(\d{2,3})\s+(.+?)\s*[·.∙•・\s]{3,}\s*(\d+)?\s*$/);
  if (!m) continue;
  const [, kind, num, titleRaw, page] = m;
  const id = `${kind}-${num}`;
  if (seen.has(id)) continue;
  const title = titleRaw.replace(/[·.∙•・\s]+$/, "").trim();
  seen.set(id, {
    id,
    title,
    domain: kind === "SSG" ? "safety" : DOMAIN_BY_HUNDRED[Number(num[0])] ?? "command",
    tocPage: page ? Number(page) : null,
  });
}

const index = [...seen.values()];
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, "sop-index.json");
writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`sop-index: ${index.length}개 SOP/SSG → ${out}`);
console.log(index.slice(0, 8).map((e) => `  ${e.id} ${e.title} (${e.domain})`).join("\n"));
