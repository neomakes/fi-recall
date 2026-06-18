// 의존성 0 — raw fetch로 Messages API 호출. ANTHROPIC_API_KEY 있을 때만 동작.
// 구조화 출력은 output_config.format(json_schema)으로 강제 → 자유 텍스트 파싱 없음.
const API = "https://api.anthropic.com/v1/messages";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function callStructured({ system, userContent, schema, model = "claude-opus-4-8", maxTokens = 16000 }) {
  if (!hasApiKey()) throw new Error("ANTHROPIC_API_KEY 없음 — 라이브 추출 불가(오프라인 모드)");

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      output_config: { format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error(`refusal: ${data.stop_details?.category ?? "?"}`);
  if (data.stop_reason === "max_tokens") throw new Error("max_tokens 초과 — maxTokens 상향 필요");

  const textBlock = (data.content ?? []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("응답에 text 블록 없음");
  return { parsed: JSON.parse(textBlock.text), usage: data.usage };
}
