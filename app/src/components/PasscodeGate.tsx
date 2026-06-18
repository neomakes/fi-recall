import { useState, type FormEvent, type ReactNode } from "react";

/**
 * PasscodeGate — FI:RECALL 데모 진입 비밀번호 게이트.
 *
 * ⚠️ 이것은 "캐주얼 차단"용입니다. 정적 호스팅(neomakes.com/projects/firecall)이라
 * 아래 비밀번호는 빌드 번들에 포함되어 소스에서 읽힐 수 있습니다 — 즉 우회 가능합니다.
 * 데모를 일반 방문자로부터 가리는 용도로는 충분하지만, 진짜 보호(특히 Claude API
 * 비용 보호)는 Claude 백엔드(Com.Neomakes /api 서버리스)에서 서버 측 비번/토큰을
 * 검증할 때만 성립합니다. 백엔드가 붙으면 이 게이트는 그 위의 UX 레이어가 됩니다.
 */

const STORAGE_KEY = "firecall_unlocked";

// 빌드 시 .env 의 VITE_FIRECALL_PASSCODE 로 주입. 미설정 시 fallback.
const PASSCODE = import.meta.env.VITE_FIRECALL_PASSCODE ?? "firecall";

export default function PasscodeGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "1"
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value === PASSCODE) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--bg-base)",
        backgroundImage: "var(--bg-ember-wash)",
      }}
    >
      <div
        className="inset"
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-hair)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-lg)",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        {/* 브랜드 */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "0.04em",
            color: "var(--text-strong)",
            marginBottom: 4,
          }}
        >
          FI<span style={{ color: "var(--ember-500)" }}>:</span>RECALL
        </div>
        <div
          className="label-eyebrow"
          style={{
            color: "var(--text-muted)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "var(--tracking-label)",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          Restricted Demo · 접근 코드 필요
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="접근 코드"
            aria-label="접근 코드"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "var(--bg-sunken)",
              border: `1px solid ${error ? "var(--status-bad)" : "var(--border-hair)"}`,
              borderRadius: "var(--r-md)",
              padding: "12px 14px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-body)",
              outline: "none",
              textAlign: "center",
              letterSpacing: "0.1em",
            }}
          />
          {error && (
            <div style={{ color: "var(--status-bad)", fontSize: "var(--fs-sm)" }}>
              접근 코드가 올바르지 않습니다.
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              background: "var(--ember-500)",
              color: "var(--text-on-ember)",
              border: "none",
              borderRadius: "var(--r-md)",
              padding: "12px 14px",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--fs-body)",
              cursor: "pointer",
              boxShadow: "var(--glow-ember)",
            }}
          >
            데모 열기 →
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            color: "var(--text-faint)",
            fontSize: "var(--fs-xs)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          FI:RECALL by NeoMakes
        </div>
      </div>
    </div>
  );
}
