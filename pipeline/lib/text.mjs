// 충실성 검증용 정규화: 공백/줄바꿈/중점 변형을 제거해 verbatim 인용을 강건하게 대조.
// (원문 PDF는 "낙하물･붕괴"(U+FF65)·"① 대원 안전" 처럼 가변 공백/구분점을 쓴다.)
const MIDDOTS = /[·･・‧∙]/g;

export function norm(s) {
  return (s ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(MIDDOTS, "");
}

// quote 가 source 안에 (정규화 후) 그대로 들어있는가 = 환각 인용 차단 게이트.
export function isVerbatim(quote, source) {
  const q = norm(quote);
  if (!q) return false;
  return norm(source).includes(q);
}
