// 데모 타깃 SOP 섹션의 *검증된* PDF 페이지 범위.
// 라우팅(triage)은 제목 기반(오프셋 무관)으로 하되, 슬라이싱은 여기 검증값을 쓴다.
// (TOC 페이지 → PDF 페이지 오프셋은 +10으로 관찰됐으나, 전 구간 일정하다고 보장하지 않음.)
export const SECTIONS = {
  "SOP-107": { title: "무선 통신", domain: "command", pdfStart: 28, pdfEnd: 29 },
  "SOP-102": { title: "상황평가 및 적용", domain: "command", pdfStart: 18, pdfEnd: 21 },
  "SOP-202": { title: "화재대응 일반절차", domain: "fire", pdfStart: 51, pdfEnd: 53 },
};
