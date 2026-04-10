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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIRTUAL_OFFICE_SRC = "/virtual-office/index.html";

const THEMES = [
  { id: "midnight-hq", label: "Midnight HQ" },
  { id: "neon-terminal", label: "Neon Terminal" },
  { id: "lofi-study", label: "Lo-fi Study" },
  { id: "orbital-station", label: "Orbital Station" },
  { id: "zen-garden", label: "Zen Garden" },
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
  iframe?.contentWindow?.postMessage(msg, "*");
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

export function OfficeView() {
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

  /** Called once the iframe has loaded — push initial state. */
  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    const frame = iframeRef.current;
    sendTheme(frame, themeId);
    sendEmployees(frame, employees);
    sendStatuses(frame, employees);
  }, [themeId, employees]);

  /** Handle iframe load error. */
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(false);
  }, []);

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
    const frame = iframeRef.current;
    sendEmployees(frame, employees);
    sendStatuses(frame, employees);
  }, [loaded, employees]);

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
          Virtual office assets not found. Run pixel-agents build first.
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
