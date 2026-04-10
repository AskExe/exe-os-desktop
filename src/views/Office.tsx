import React from "react";

/**
 * Office tab — pixel-agents canvas placeholder.
 * Real implementation will use pixel-agents running around.
 * For now: embed a canvas/iframe placeholder.
 */
export function OfficeView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: "#2a2836",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "4px solid #353341",
        }}
      >
        <span style={{ color: "#98907d", fontFamily: "var(--font-label)", fontSize: 14 }}>
          PIXEL AGENTS CANVAS — PLACEHOLDER
        </span>
      </div>
    </div>
  );
}
