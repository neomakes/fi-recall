// SOP 한 섹션 원문 텍스트를 출력(검수용). 예: node slice.mjs SOP-107
import { sliceSection } from "./lib/pdf.mjs";
const sop = process.argv[2] || "SOP-107";
const s = sliceSection(sop);
console.error(`# ${sop} ${s.title} — ${s.text.length}자\n`);
console.log(s.text);
