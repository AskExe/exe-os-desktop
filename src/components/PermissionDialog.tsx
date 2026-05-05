import React, { useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermissionRequest {
  toolName: string;
  description: string;
  filePath?: string;
}

export type PermissionResponse = "allow-once" | "allow-session" | "deny";

interface PermissionDialogProps {
  request: PermissionRequest;
  onRespond: (response: PermissionResponse) => void;
}

// ---------------------------------------------------------------------------
// Constants — Exe Foundry Bold
// ---------------------------------------------------------------------------

const SURFACE_BG = "#0F0E1A";
const SURFACE_HIGH = "#1b1a27";
const GOLD = "#F5D76E";
const GOLD_DARK = "#715c00";
const ON_SURFACE = "#e4e0f2";
const ON_SURFACE_VARIANT = "#cfc6b1";
const BORDER = "#2a2836";
const DENY_BG = "#2a1419";
const DENY_BORDER = "#5c2333";
const DENY_TEXT = "#f07080";
const OVERLAY_BG = "rgba(0, 0, 0, 0.6)";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionDialog({ request, onRespond }: PermissionDialogProps) {
  const handleAllowOnce = useCallback(
    () => onRespond("allow-once"),
    [onRespond],
  );
  const handleAllowSession = useCallback(
    () => onRespond("allow-session"),
    [onRespond],
  );
  const handleDeny = useCallback(
    () => onRespond("deny"),
    [onRespond],
  );

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: GOLD }}
          >
            shield
          </span>
          <span style={headerTitleStyle}>Permission Required</span>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <div style={toolRowStyle}>
            <span style={labelStyle}>Tool</span>
            <span style={toolNameStyle}>{request.toolName}</span>
          </div>

          <div style={descRowStyle}>
            <span style={labelStyle}>Action</span>
            <span style={descTextStyle}>{request.description}</span>
          </div>

          {request.filePath && (
            <div style={fileRowStyle}>
              <span style={labelStyle}>File</span>
              <span style={filePathStyle}>{request.filePath}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <button onClick={handleDeny} style={denyBtnStyle}>
            Deny
          </button>
          <button onClick={handleAllowOnce} style={allowOnceBtnStyle}>
            Allow Once
          </button>
          <button onClick={handleAllowSession} style={allowSessionBtnStyle}>
            Allow for Session
          </button>
        </div>
      </div>

      <style>{`
        .perm-btn:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: OVERLAY_BG,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: SURFACE_BG,
  border: `1px solid ${BORDER}`,
  width: 420,
  maxWidth: "90vw",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 20px",
  borderBottom: `1px solid ${BORDER}`,
};

const headerTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-headline)",
  fontSize: 14,
  fontWeight: 700,
  color: ON_SURFACE,
  textTransform: "uppercase" as const,
  letterSpacing: "-0.01em",
};

const bodyStyle: React.CSSProperties = {
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const toolRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const descRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

const fileRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 600,
  color: ON_SURFACE_VARIANT,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  minWidth: 48,
  flexShrink: 0,
};

const toolNameStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 13,
  fontWeight: 600,
  color: GOLD,
  background: SURFACE_HIGH,
  border: `1px solid ${BORDER}`,
  padding: "3px 8px",
};

const descTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: ON_SURFACE,
  lineHeight: 1.5,
};

const filePathStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 12,
  color: ON_SURFACE_VARIANT,
  wordBreak: "break-all" as const,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "12px 20px 16px",
  borderTop: `1px solid ${BORDER}`,
  justifyContent: "flex-end",
};

const btnBase: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  padding: "8px 16px",
  border: "none",
  cursor: "pointer",
};

const denyBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: DENY_BG,
  border: `1px solid ${DENY_BORDER}`,
  color: DENY_TEXT,
};

const allowOnceBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: SURFACE_HIGH,
  border: `1px solid ${BORDER}`,
  color: ON_SURFACE,
};

const allowSessionBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: GOLD,
  color: GOLD_DARK,
};
