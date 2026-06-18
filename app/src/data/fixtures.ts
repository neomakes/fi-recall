/* =============================================================================
   FI:RECALL — 골든 픽스처 (mock)
   재난현장 표준작전절차(진압) SOP 한 갈래를 교리 지도로 옮긴 것 + 복기 프리셋.
   추후 S1(Claude 파이프라인)이 produce하는 DoctrineMap/GroundingResult/ClosureOutput
   계약과 동일 형태. 지금은 손작성 fixture로 프론트를 구동한다.
   ============================================================================= */

export type NodeType = "procedure" | "decision" | "hazard" | "standard";

export interface MapNode {
  id: string;
  type: NodeType;
  label: string;
  sopRef: string;
  clause: string; // 교리 원문 한 줄 (출처 sopRef에 해당)
  x: number; // % (맵 좌표)
  y: number;
}
export interface MapEdge {
  from: string;
  to: string;
  type: "sequence" | "dependency" | "exception";
}

export const DOCTRINE_MAP: { title: string; nodes: MapNode[]; edges: MapEdge[] } = {
  title: "재난현장 표준작전절차 · 화재진압",
  nodes: [
    { id: "N1", type: "procedure", label: "선착대 상황판단", sopRef: "제2장 1절", x: 18, y: 16,
      clause: "선착대는 현장 도착 즉시 건물 규모·연소 범위·요구조자 상황을 판단한다." },
    { id: "N2", type: "decision", label: "진입 가부 결정", sopRef: "제2장 3절", x: 50, y: 16,
      clause: "지휘관은 현장 상황을 종합해 진입 여부를 결정한다." },
    { id: "N3", type: "procedure", label: "옥내소화전 전개", sopRef: "제3장 2절", x: 82, y: 18,
      clause: "옥내소화전을 연결하고 관창을 전개해 진입 경로를 확보한다." },
    { id: "N4", type: "procedure", label: "계단실 가압배연", sopRef: "제3장 4절", x: 30, y: 48,
      clause: "진입 전 계단실 가압배연을 실시한다." },
    { id: "N5", type: "decision", label: "상층 검색 우선순위", sopRef: "제4장 1절", x: 64, y: 46,
      clause: "상층 인명검색은 화점 직상층을 최우선으로 한다." },
    { id: "N6", type: "hazard", label: "농연 시야 상실", sopRef: "제4장 5절", x: 50, y: 76,
      clause: "농연으로 시야가 상실되면 열화상카메라·유도로프로 방향을 유지한다." },
    { id: "N7", type: "procedure", label: "무전 채널 분리", sopRef: "제5장 2절", x: 84, y: 72,
      clause: "다수 인명검색 시 검색팀별로 무전 채널을 분리하고 위치를 보고한다." },
    { id: "N8", type: "standard", label: "잔불·재발화 감시", sopRef: "제6장", x: 17, y: 80,
      clause: "주불 진화 후 잔불을 정리하고 재발화를 감시한다." },
  ],
  edges: [
    { from: "N1", to: "N2", type: "sequence" },
    { from: "N2", to: "N3", type: "sequence" },
    { from: "N2", to: "N4", type: "dependency" },
    { from: "N4", to: "N5", type: "sequence" },
    { from: "N5", to: "N6", type: "exception" },
    { from: "N5", to: "N7", type: "dependency" },
    { from: "N3", to: "N8", type: "sequence" },
    { from: "N6", to: "N8", type: "sequence" },
  ],
};

/* 업로드된(픽스처에 없는) 복기를 노드에 휴리스틱 매핑하기 위한 키워드.
   실제 grounding은 S1 파이프라인이 대체한다 — 그 전까지 데모용 근사. */
export const NODE_KEYWORDS: Record<string, string[]> = {
  N1: ["상황판단", "도착", "선착대", "물질", "msds", "특정"],
  N2: ["진입", "결정", "제연", "기류", "통제선"],
  N3: ["소화전", "관창", "방수", "전개"],
  N4: ["배연", "가압", "옥상", "연기", "제연설비"],
  N5: ["검색", "우선순위", "대피", "구조", "트리아지"],
  N6: ["농연", "시야", "연기", "탈진", "방호복"],
  N7: ["무전", "채널", "통신", "보고", "음영"],
  N8: ["잔불", "재발화", "감시", "복구"],
};

export interface Revision {
  nodeId: string;
  currentText: string;
  proposedText: string;
  justification: string;
}
export interface Drill {
  nodeId: string;
  title: string;
  objective: string;
  steps: string[];
  successCriteria: string;
}
export interface Feedback {
  id: string;
  source: string;
  raw: string;
  litNodes: string[];
  recurrence: { nodeId: string; count: number }[];
  revisions: Revision[];
  drills: Drill[];
}

export const FEEDBACKS: Feedback[] = [
  {
    id: "F1",
    source: "한빛아파트 3동 고층 화재",
    raw: "옥상문이 잠겨 계단실 배연이 안 됐다. 결국 연기가 위로 다 올라가 16층 검색팀이 시야 확보가 안 돼 5분간 손으로 더듬으며 진입. 게다가 1팀·2팀이 같은 무전 채널을 써서 14층/16층 검색 보고가 섞여 지휘소가 위치를 놓쳤다.",
    litNodes: ["N4", "N6", "N7"],
    recurrence: [{ nodeId: "N7", count: 2 }],
    revisions: [
      {
        nodeId: "N4",
        currentText: "진입 전 계단실 가압배연을 실시한다.",
        proposedText:
          "진입 전 옥상 출입통제 상태(마스터키 위치 포함)를 확인하고 계단실 가압배연을 실시한다. 자연배연 불가 시 기계배연으로 전환한다.",
        justification:
          "복기상 옥상 잠금 정보 부재로 배연 실패 → '아는 것'의 격차. 사전대응정보 표준 항목 누락을 SOP에서 교정.",
      },
    ],
    drills: [
      {
        nodeId: "N7",
        title: "다수 인명검색 시 무전 채널 분리 훈련",
        objective: "검색팀별 채널 분리 운용을 체화해 지휘소 위치 추적 단절을 막는다.",
        steps: [
          "검색팀 2개조에 각기 다른 채널 배정 후 동시 진입",
          "지휘소는 팀별 채널을 교차 모니터링하며 위치판 갱신",
          "중간에 1개 팀 채널 장애를 부여, 대체 채널 전환 숙달",
        ],
        successCriteria: "지휘소가 양 팀 위치를 30초 이내 항상 특정 가능.",
      },
    ],
  },
  {
    id: "F2",
    source: "지하철역 대규모 합동훈련",
    raw: "제연설비 조작은 역무원이 하고 우리는 진입하는데, 누가 언제 제연 모드를 바꿨는지 공유가 안 돼 진입 순간 기류가 반대로 흘렀다. 대피 동선과 진입 동선이 같은 계단에서 겹쳐 병목도 생겼다.",
    litNodes: ["N2", "N4", "N6"],
    recurrence: [{ nodeId: "N4", count: 2 }],
    revisions: [
      {
        nodeId: "N2",
        currentText: "지휘관은 현장 상황을 종합해 진입 여부를 결정한다.",
        proposedText:
          "지휘관은 진입 결정 전 제연설비 조작 권한·현재 모드를 합동지휘체계에서 확인하고, 진입로/대피로 분리를 명시 지정한다.",
        justification:
          "제연 모드 통보 절차 부재로 기류 역류 → 교리(절차 정의)의 격차. 권한·동선 분리를 SOP에 명문화.",
      },
    ],
    drills: [
      {
        nodeId: "N6",
        title: "농연 환경 진입/대피 동선 분리 훈련",
        objective: "진입대와 대피 인파의 동선 충돌을 현장에서 물리적으로 분리한다.",
        steps: [
          "지하 모의역사에서 대피로·진입로를 색 테이프로 사전 지정",
          "대피 인파(분장) 흐름과 진입대를 동시 전개해 병목 측정",
          "제연 모드 전환 통보를 무전 표준구호로 반복 숙달",
        ],
        successCriteria: "진입/대피 동선 교차 0회, 제연 전환 통보 누락 0건.",
      },
    ],
  },
  {
    id: "F3",
    source: "화학공장 반응기 폭발·화재",
    raw: "무슨 물질이 새는지 몰라 초기 20분을 통제선 밖에서 대기했다. MSDS가 사무동 종이로만 있고 담당자가 다쳐 연락이 안 됐다. 레벨A 방호복 대원들이 더위로 교대 주기가 너무 빨라 두 명이 탈진 직전까지 갔다.",
    litNodes: ["N1", "N2"],
    recurrence: [],
    revisions: [
      {
        nodeId: "N1",
        currentText: "선착대는 현장 도착 즉시 상황을 판단한다.",
        proposedText:
          "선착대는 도착 즉시 관내 위험물 사업장 MSDS·공정도(출동 단말 연동본)를 조회해 누출물질을 우선 특정한 뒤 상황을 판단한다.",
        justification:
          "물질 미특정으로 초기 대응 20분 지연 → 정보 접근 교리의 격차. 디지털 사전확보를 SOP에 반영.",
      },
    ],
    drills: [
      {
        nodeId: "N2",
        title: "화학방호복 작업 교대 주기 숙달 훈련",
        objective: "기온별 레벨A 작업·휴식 주기를 체화해 열탈진을 예방한다.",
        steps: [
          "기온 구간별 표준 교대 타이머를 부여하고 작업 투입",
          "타이머 경과 시 강제 교대·수분보충 절차 반복",
          "탈진 징후 조기 식별·후송 라인 점검",
        ],
        successCriteria: "교대 주기 초과 0건, 열탈진 발생 0명.",
      },
    ],
  },
];
