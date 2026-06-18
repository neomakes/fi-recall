/**
 * FI:RECALL 백엔드 클라이언트.
 * - 백엔드는 키를 서버에 보관하고 패스코드를 서버에서 검증(토큰 비용 보호의 실제 경계).
 * - VITE_API_BASE 미설정 시 백엔드 미연결로 간주 → 호출부는 기존 픽스처로 폴백.
 *
 * 반환 형태는 Workbench가 그대로 먹는 모양:
 *   extract → { map: { title, nodes: MapNode[], edges: MapEdge[] } }
 *   reflect → { applied: { litNodes, recurrence, revisions, drills } }
 */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// 게이트가 입력 코드를 sessionStorage("firecall_passcode")에 저장하면 그걸 사용,
// 아니면 빌드 주입 코드로 폴백.
function passcode(): string {
  return (
    sessionStorage.getItem("firecall_passcode") ??
    (import.meta.env.VITE_FIRECALL_PASSCODE as string | undefined) ??
    "firecall"
  );
}

export function apiConfigured(): boolean {
  return Boolean(BASE);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-firecall-passcode": passcode() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`${path} ${res.status}: ${(detail as any).error ?? ""} ${(detail as any).message ?? ""}`);
  }
  return res.json() as Promise<T>;
}

export interface LiveMapNode { id: string; type: "procedure" | "decision" | "hazard" | "standard"; label: string; sopRef: string; x: number; y: number; modality?: string; quote?: string; }
export interface LiveMapEdge { from: string; to: string; type: "sequence" | "dependency" | "exception"; }
export interface LiveApplied {
  litNodes: string[];
  recurrence: { nodeId: string; count: number }[];
  revisions: { nodeId: string; currentText: string; proposedText: string; justification: string }[];
  drills: { nodeId: string; title: string; objective: string; steps: string[]; successCriteria: string }[];
  heuristic?: boolean;
}

export const api = {
  health: () => fetch(`${BASE}/api/health`).then((r) => r.json()),
  extract: (args: { sop?: string; debrief?: string | null }) =>
    post<{ mode: string; map: { title: string; nodes: LiveMapNode[]; edges: LiveMapEdge[] }; validation: { errors: number; warnings: number } }>(
      "/api/extract", args
    ),
  reflect: (args: { debrief: string; nodes: LiveMapNode[]; priorCounts?: Record<string, number> }) =>
    post<{ mode: string; applied: LiveApplied }>("/api/reflect", args),
};
