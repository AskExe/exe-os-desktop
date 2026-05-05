import React, { useRef, useEffect, useState, useCallback } from "react";
import { fetchEmployees, type Employee } from "../services/exeOsData.js";

// ---------------------------------------------------------------------------
// Types (matching pixel-agents tauriBridge.ts contract)
// ---------------------------------------------------------------------------

interface OfficeEmployee {
  name: string;
  role: string;
  status: "active" | "working" | "idle" | "offline";
}

interface OfficeFrameMessage {
  source?: string;
  type?: string;
  id?: number;
  name?: string;
}

export interface OfficeAgentFocus {
  id: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOST_BRIDGE_SOURCE = "exe-virtual-office";
const VIRTUAL_OFFICE_SRC =
  import.meta.env.VITE_VIRTUAL_OFFICE_URL || "/virtual-office/index.html";
const OFFICE_ORIGIN = (() => {
  if (typeof window === "undefined") return "null";
  try {
    return new URL(VIRTUAL_OFFICE_SRC, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
})();

const THEMES = [
  { id: "midnight-hq", label: "Mission Control" },
  { id: "neon-terminal", label: "Signal Room" },
  { id: "lofi-study", label: "Briefing Deck" },
  { id: "orbital-station", label: "Night Shift" },
  { id: "zen-garden", label: "Observatory" },
] as const;

const DEFAULT_THEME = "midnight-hq";

const STATUS_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map service-layer Employee to the postMessage contract shape. */
function toOfficeEmployee(emp: Employee): OfficeEmployee {
  return { name: emp.name, role: emp.role, status: emp.status };
}

// ---------------------------------------------------------------------------
// postMessage helpers
// ---------------------------------------------------------------------------

function sendToFrame(
  iframe: HTMLIFrameElement | null,
  msg: Record<string, unknown>,
): void {
  iframe?.contentWindow?.postMessage(msg, OFFICE_ORIGIN);
}

function sendTheme(iframe: HTMLIFrameElement | null, themeId: string): void {
  sendToFrame(iframe, { type: "SET_THEME", themeId });
}

function sendEmployees(
  iframe: HTMLIFrameElement | null,
  employees: OfficeEmployee[],
): void {
  sendToFrame(iframe, { type: "SET_EMPLOYEES", employees });
}

function sendStatuses(
  iframe: HTMLIFrameElement | null,
  employees: OfficeEmployee[],
): void {
  const statuses: Record<string, string> = {};
  for (const emp of employees) {
    statuses[emp.name] = emp.status;
  }
  sendToFrame(iframe, { type: "SET_STATUSES", statuses });
}

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
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 12px",
    borderBottom: "1px solid var(--outline-variant)",
    flexShrink: 0,
  },
  label: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  select: {
    padding: "4px 8px",
    background: "var(--surface-low)",
    color: "var(--on-surface)",
    border: "1px solid var(--outline-variant)",
    fontSize: 13,
    fontFamily: "var(--font-label)",
    cursor: "pointer",
  },
  iframe: {
    flex: 1,
    width: "100%",
    border: "none",
  },
  fallback: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface-low)",
    color: "var(--outline)",
    fontFamily: "var(--font-label)",
    fontSize: 14,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OfficeViewProps {
  onFocusAgent?: (agent: OfficeAgentFocus) => void;
}

export function OfficeView({ onFocusAgent }: OfficeViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [employees, setEmployees] = useState<OfficeEmployee[]>([]);

  /** Fetch employee roster from exe-os service layer. */
  const refreshEmployees = useCallback(async () => {
    try {
      const { employees: raw } = await fetchEmployees();
      setEmployees(raw.map(toOfficeEmployee));
    } catch {
      // Service unavailable — keep existing state
    }
  }, []);

  /** Initial employee load. */
  useEffect(() => {
    refreshEmployees();
  }, [refreshEmployees]);

  /** Push current desktop state into the embedded office. */
  const syncFrameState = useCallback(() => {
    const frame = iframeRef.current;
    sendTheme(frame, themeId);
    sendEmployees(frame, employees);
    sendStatuses(frame, employees);
  }, [themeId, employees]);

  /** Called once the iframe element has loaded. */
  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    syncFrameState();
  }, [syncFrameState]);

  /** Handle iframe load error. */
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(false);
  }, []);

  /** Handle lifecycle and click messages from the embedded office. */
  const handleFrameMessage = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== OFFICE_ORIGIN) return;
      const msg = event.data as OfficeFrameMessage | null;
      if (!msg || typeof msg.type !== "string") {
        return;
      }
      if (typeof msg.source === "string" && msg.source !== HOST_BRIDGE_SOURCE) {
        return;
      }
      if (msg.type === "webviewReady") {
        setLoaded(true);
        setError(false);
        syncFrameState();
        return;
      }
      if (msg.type === "focusAgent" && typeof msg.id === "number") {
        onFocusAgent?.({
          id: msg.id,
          name: typeof msg.name === "string" ? msg.name : undefined,
        });
      }
    },
    [onFocusAgent, syncFrameState],
  );

  useEffect(() => {
    window.addEventListener("message", handleFrameMessage);
    return () => window.removeEventListener("message", handleFrameMessage);
  }, [handleFrameMessage]);

  /** Theme change — propagate to iframe immediately. */
  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newTheme = e.target.value;
      setThemeId(newTheme);
      sendTheme(iframeRef.current, newTheme);
    },
    [],
  );

  /** Push updated employees to iframe whenever they change. */
  useEffect(() => {
    if (!loaded) return;
    syncFrameState();
  }, [loaded, syncFrameState]);

  /** Periodically refresh employee statuses from exe-os. */
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(refreshEmployees, STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loaded, refreshEmployees]);

  return (
    <div style={s.container}>
      <div style={s.toolbar}>
        <span style={s.label}>Theme</span>
        <select style={s.select} value={themeId} onChange={handleThemeChange}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div style={s.fallback}>
          Virtual office assets not found. Sync the exe-virtual-office build first.
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={VIRTUAL_OFFICE_SRC}
          style={s.iframe}
          onLoad={handleLoad}
          onError={handleError}
          title="Exe Virtual Office"
        />
      )}
    </div>
  );
}
