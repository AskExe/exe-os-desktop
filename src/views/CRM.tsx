/**
 * CRM view — launches the exe-crm web app in a native OS webview window.
 *
 * AGPL boundary: this view never imports, bundles, or fetches exe-crm code.
 * The only contract with exe-crm is the URL string loaded by the Rust
 * `open_crm_window` Tauri command. Do NOT replace the Tauri call with an
 * iframe, <webview>, or an in-React fetch — each of those would bundle
 * third-party origin code into the Tauri process AND break the white-label
 * distribution story.
 */

import { useState } from "react";
import { openCrmWindow } from "../services/tauriApi.js";

const DEFAULT_CRM_URL = "https://crm.askexe.com";

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    height: "100%",
    padding: 40,
  },
  headline: {
    fontFamily: "var(--font-headline)",
    fontSize: 24,
    fontWeight: 700,
    color: "var(--on-surface)",
    margin: 0,
  },
  description: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--outline)",
    lineHeight: 1.5,
    maxWidth: 560,
  },
  launchRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  launchButton: (isHover: boolean) => ({
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    padding: "12px 20px",
    border: "none",
    cursor: "pointer",
    background: isHover ? "#6B4C9A" : "#F5D76E",
    color: isHover ? "#F5D76E" : "#0F0E1A",
    transition: "background 120ms, color 120ms",
  }),
  urlBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--outline)",
  },
  errorBanner: {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
};

export default function CRM() {
  const [isHover, setIsHover] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const onLaunch = async (): Promise<void> => {
    try {
      await openCrmWindow();
      setLastError(null);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={s.container}>
      <h1 style={s.headline}>Exe CRM</h1>
      <p style={s.description}>
        Open the Exe CRM in its own window. Sessions are isolated — your CRM
        login stays in that window and never touches Exe OS cookies.
      </p>
      <div style={s.launchRow}>
        <button
          type="button"
          style={s.launchButton(isHover)}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
          onClick={() => void onLaunch()}
        >
          Open CRM
        </button>
        <span style={s.urlBadge}>{DEFAULT_CRM_URL}</span>
      </div>
      {lastError ? <div style={s.errorBanner}>{lastError}</div> : null}
    </div>
  );
}
