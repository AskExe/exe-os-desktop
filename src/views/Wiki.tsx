import React, { useState, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: 0,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "var(--surface-low)",
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: (color: string) => ({
    width: 8,
    height: 8,
    background: color,
    flexShrink: 0,
  }),
  statusLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--on-surface)",
  },
  urlLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline)",
    letterSpacing: "0.02em",
  },
  refreshButton: {
    background: "var(--surface-container)",
    border: "none",
    padding: "4px 12px",
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-surface)",
    cursor: "pointer",
  },
  iframe: {
    flex: 1,
    border: "none",
    background: "var(--surface-lowest)",
  },
  fallback: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    background: "var(--surface-lowest)",
  },
  fallbackIcon: {
    fontFamily: "var(--font-headline)",
    fontSize: 48,
    color: "var(--outline-variant)",
  },
  fallbackTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--outline)",
  },
  fallbackHint: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--outline-variant)",
    textAlign: "center" as const,
    maxWidth: 300,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WIKI_URL = "http://localhost:3001";

export function WikiView() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    setConnected(true);
  }, []);

  const handleError = useCallback(() => {
    setConnected(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setConnected(null);
    if (iframeRef.current) {
      iframeRef.current.src = WIKI_URL;
    }
  }, []);

  const showFallback = connected === false;
  const statusColor = connected === true ? "#22C55E" : connected === false ? "#EF4444" : "#98907d";
  const statusText = connected === true ? "CONNECTED" : connected === false ? "DISCONNECTED" : "CONNECTING";

  return (
    <div style={s.container}>
      {/* Connection status bar */}
      <div style={s.statusBar}>
        <div style={s.statusLeft}>
          <div style={s.dot(statusColor)} />
          <span style={s.statusLabel}>{statusText}</span>
          <span style={s.urlLabel}>{WIKI_URL}</span>
        </div>
        <button style={s.refreshButton} onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {/* Wiki iframe or fallback */}
      {showFallback ? (
        <div style={s.fallback}>
          <div style={s.fallbackIcon}>W</div>
          <div style={s.fallbackTitle}>Wiki Not Available</div>
          <div style={s.fallbackHint}>
            Exe Wiki is not running at {WIKI_URL}. Start it with{" "}
            <span style={{ fontFamily: "var(--font-label)", color: "var(--primary-container)" }}>
              docker compose up -d
            </span>{" "}
            in the exe-wiki directory, or configure the URL in Settings.
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={WIKI_URL}
          style={s.iframe}
          title="Exe Wiki"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}
