import { useState } from "react";
import Workbench from "./pages/Workbench";
import DesignSystem from "./pages/DesignSystem";

export default function App() {
  // ?ds=1 또는 토글로 디자인 시스템 쇼케이스 확인
  const [view, setView] = useState<"workbench" | "ds">(
    new URLSearchParams(location.search).has("ds") ? "ds" : "workbench"
  );
  return (
    <>
      {view === "workbench" ? <Workbench /> : <DesignSystem />}
      <button
        onClick={() => setView((v) => (v === "workbench" ? "ds" : "workbench"))}
        className="btn btn--ghost"
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, padding: "8px 14px" }}
      >
        {view === "workbench" ? "디자인 시스템 ↗" : "워크벤치 ↗"}
      </button>
    </>
  );
}
