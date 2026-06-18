import { execFileSync } from "node:child_process";
import { PDF } from "./paths.mjs";
import { SECTIONS } from "./sections.mjs";

// pdftotext -layout 출력에서 노이즈 제거: 반복 헤더/푸터, 페이지번호, 세로 사이드바(단일 CJK 글자).
function cleanSidebars(raw) {
  const drop = [
    /^재난현장/, /^Standard Operating Procedures/, /^Contents/,
    /^\s*\d{1,3}\s*$/,            // 외톨이 페이지 번호
    /^\s*[가-힣]\s*$/,            // 세로 사이드바 단일 한글 (지/휘/통/제/절/차 …)
    /^\s*[A-Z]\s*$/,             // 세로 사이드바 단일 라틴 (S/O/P)
  ];
  return raw
    .split("\n")
    .filter((line) => !drop.some((re) => re.test(line)))
    // 본문 줄 끝에 붙은 인라인 세로-사이드바 글자 제거 (큰 공백 뒤 외톨이 1글자: "…무선      P")
    .map((line) => line.replace(/\s{3,}[가-힣A-Za-z]\s*$/u, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// SOP 한 섹션의 원문 텍스트를 추출(결정론적). 모델 호출 없음.
export function sliceSection(sopId) {
  const sec = SECTIONS[sopId];
  if (!sec) throw new Error(`알 수 없는 섹션: ${sopId} (sections.mjs에 등록 필요)`);
  const raw = execFileSync(
    "pdftotext",
    ["-f", String(sec.pdfStart), "-l", String(sec.pdfEnd), "-layout", PDF, "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return { sopId, title: sec.title, domain: sec.domain, text: cleanSidebars(raw) };
}
