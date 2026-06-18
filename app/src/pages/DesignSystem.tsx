import { motion } from "framer-motion";
import { Badge, Button, Card, NodeChip, StatusDot, type NodeType } from "../components/ui";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Section({ eyebrow, title, children, i }: {
  eyebrow: string; title: string; children: React.ReactNode; i: number;
}) {
  return (
    <motion.section custom={i} variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 40 }}>
      <div className="label-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
      <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: 18 }}>{title}</h2>
      {children}
    </motion.section>
  );
}

const NODE_TYPES: { type: NodeType; id: string; label: string }[] = [
  { type: "procedure", id: "N1", label: "계단실 가압배연" },
  { type: "decision", id: "N2", label: "상층 진입 가부" },
  { type: "hazard", id: "N7", label: "농연 시야 상실" },
  { type: "standard", id: "N9", label: "무전 채널 분리 운용" },
];

const SWATCHES = [
  ["배경 base", "--bg-base"], ["surface", "--bg-surface"], ["surface-2", "--bg-surface-2"],
  ["elevated", "--bg-elevated"], ["ember 500 ★", "--ember-500"], ["ember 400", "--ember-400"],
  ["절차", "--node-procedure"], ["판단점", "--node-decision"],
  ["위험", "--node-hazard"], ["표준", "--node-standard"],
  ["교리격차", "--gap-doctrine"], ["실행격차", "--gap-execution"],
];

export default function DesignSystem() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 32px 96px" }}>
      {/* ── Header (MASON 레이아웃 해석) ───────────────────────────── */}
      <motion.header custom={0} variants={fadeUp} initial="hidden" animate="show"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26,
            letterSpacing: "0.04em", color: "var(--text-strong)" }}>
            FI<span style={{ color: "var(--ember-500)" }}>:</span>RECALL
          </div>
          <div className="label-eyebrow" style={{ marginTop: 2 }}>DOCTRINE-GROUNDED RETRAINING</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="icon" aria-label="undo">↺</Button>
          <Button variant="icon" aria-label="map">◫</Button>
          <Button variant="icon" aria-label="more">⋯</Button>
        </div>
      </motion.header>

      {/* Stepper */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
        style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
        <div className="stepper">
          {[
            { label: "SOP 적재", state: "done" },
            { label: "교리 지도", state: "done" },
            { label: "복기 반영", state: "active" },
            { label: "격차 종결", state: "todo" },
          ].map((s, idx, arr) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
              <div className={`step step--${s.state}`}>
                <div className="step__icon">{s.state === "done" ? "✓" : s.state === "active" ? "◧" : "○"}</div>
                <div className="step__label">{s.label}</div>
                {s.state === "active" && <div className="step--active-dot" />}
              </div>
              {idx < arr.length - 1 && <div className="step__line" />}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Color ─────────────────────────────────────────────────── */}
      <Section i={2} eyebrow="FOUNDATION" title="색상 — near-black 배경 · ember 키 컬러">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {SWATCHES.map(([name, varName]) => (
            <div key={varName} className="inset" style={{ padding: 12 }}>
              <div style={{ height: 48, borderRadius: "var(--r-sm)", background: `var(${varName})`,
                border: "1px solid var(--border-faint)", marginBottom: 10 }} />
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-primary)" }}>{name}</div>
              <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{varName}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Typography ────────────────────────────────────────────── */}
      <Section i={3} eyebrow="FOUNDATION" title="타이포그래피 — Archivo · Pretendard · IBM Plex Mono">
        <Card style={{ padding: 28, display: "grid", gap: 18 }}>
          <div>
            <div className="label-eyebrow">DISPLAY · Archivo 800</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-display)",
              color: "var(--text-strong)", lineHeight: 1.1 }}>From the fire call to total recall.</div>
          </div>
          <div>
            <div className="label-eyebrow">BODY · Pretendard</div>
            <p style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", maxWidth: 620 }}>
              지저분한 자연어 복기를 구조화된 교리 지도에 매핑합니다. 출력이 소방관의 플레이북을 직접 편집하므로,
              충실성(faithfulness)이 곧 안전요건입니다.
            </p>
          </div>
          <div>
            <div className="label-eyebrow">MONO · IBM Plex Mono</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>
              N7 · hazard · confidence 0.86 · sopRef "제3장 4절"
            </div>
          </div>
        </Card>
      </Section>

      {/* ── Buttons & Badges ──────────────────────────────────────── */}
      <Section i={4} eyebrow="COMPONENTS" title="버튼 · 뱃지 · 상태">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <Button variant="primary">교리 지도 생성 →</Button>
          <Button variant="ghost">복기 불러오기</Button>
          <Button variant="quiet">초기화</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Badge>confidence 0.86</Badge>
          <Badge tone="ember">교리 격차 → SOP 수정</Badge>
          <Badge tone="teal">실행 격차 → 재훈련 drill</Badge>
          <Badge tone="recur">▲ 재발 2회</Badge>
          <span style={{ display: "inline-flex", gap: 14, alignItems: "center", marginLeft: 8 }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><StatusDot tone="good" />충족</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><StatusDot tone="warn" />주의</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><StatusDot tone="bad" />결함</span>
          </span>
        </div>
      </Section>

      {/* ── Node chips ────────────────────────────────────────────── */}
      <Section i={5} eyebrow="PRODUCT" title="교리 지도 노드 — 온톨로지 4종">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {NODE_TYPES.map((n, idx) => <NodeChip key={n.id} {...n} lit={idx === 2} />)}
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", marginTop: 12 }}>
          가운데 칩은 복기가 닿아 <span style={{ color: "var(--ember-400)" }}>점등(lit)</span>된 상태 — 데모의 핵심 인터랙션.
        </p>
      </Section>

      {/* ── Cards (선택 카드 + diff) ──────────────────────────────── */}
      <Section i={6} eyebrow="COMPONENTS" title="카드 — 선택 · SOP 수정안 diff">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card interactive selected style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="mono" style={{ color: "var(--ember-500)", fontSize: "var(--fs-h3)" }}>01</span>
              <Badge tone="ember">선택됨</Badge>
            </div>
            <h3 style={{ fontSize: "var(--fs-h3)", marginBottom: 6 }}>옥상 출입 잠금 정보 표준 등재</h3>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
              고층건물 사전대응정보에 마스터키 위치를 필수 항목으로.
            </p>
          </Card>
          <Card style={{ padding: 22 }}>
            <div className="label-eyebrow" style={{ marginBottom: 12 }}>SOP 수정안 · N1 계단실 가압배연</div>
            <code className="diff-line diff-line--del">진입 전 계단실 가압배연을 실시한다.</code>
            <code className="diff-line diff-line--add">진입 전 옥상 출입통제(마스터키 위치 포함)를 확인하고 계단실 가압배연을 실시한다.</code>
          </Card>
        </div>
      </Section>

      <motion.footer custom={7} variants={fadeUp} initial="hidden" animate="show"
        className="inset" style={{ padding: "14px 20px", display: "flex", gap: 10, alignItems: "center",
          justifyContent: "center", color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        <span style={{ color: "var(--ember-500)" }}>◆</span>
        FI:RECALL 디자인 시스템 v0.1 — 토큰은 <span className="mono">src/styles/tokens.css</span> 단일 진실원본.
      </motion.footer>
    </div>
  );
}
