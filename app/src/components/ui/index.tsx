import type { ReactNode } from "react";

/* -- Button ----------------------------------------------------------------- */
type BtnVariant = "primary" | "ghost" | "quiet" | "icon";
export function Button({
  variant = "primary",
  children,
  ...rest
}: {
  variant?: BtnVariant;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn--${variant}`} {...rest}>
      {children}
    </button>
  );
}

/* -- NodeChip (교리 지도 노드) ---------------------------------------------- */
export type NodeType = "procedure" | "decision" | "hazard" | "standard";
const NODE_LABEL: Record<NodeType, string> = {
  procedure: "절차",
  decision: "판단점",
  hazard: "위험",
  standard: "표준",
};
export function NodeChip({
  type,
  id,
  label,
  lit = false,
}: {
  type: NodeType;
  id: string;
  label: string;
  lit?: boolean;
}) {
  return (
    <span className={`node-chip node-chip--${type}${lit ? " node-chip--lit" : ""}`}>
      <span className="node-chip__dot" />
      <span className="node-chip__id">{id}</span>
      <span>{label}</span>
      <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
        · {NODE_LABEL[type]}
      </span>
    </span>
  );
}

/* -- Badge ------------------------------------------------------------------ */
export function Badge({
  tone = "default",
  children,
}: {
  tone?: "default" | "ember" | "teal" | "recur";
  children: ReactNode;
}) {
  return <span className={`badge${tone !== "default" ? ` badge--${tone}` : ""}`}>{children}</span>;
}

/* -- StatusDot -------------------------------------------------------------- */
export function StatusDot({ tone }: { tone: "good" | "warn" | "bad" }) {
  return <span className={`status-dot status-dot--${tone}`} />;
}

/* -- Card / Panel ----------------------------------------------------------- */
export function Card({
  children,
  interactive,
  selected,
  style,
}: {
  children: ReactNode;
  interactive?: boolean;
  selected?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`card${interactive ? " card--interactive" : ""}${selected ? " card--selected" : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
