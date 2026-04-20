import React, { useState, useEffect, useCallback } from "react";
import { fetchProviders, fetchConfig, saveConfig, type Provider, type AppConfig } from "../services/exeOsData.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<Provider["status"], string> = {
  active: "#22C55E",
  configured: "#F5D76E",
  not_set: "#4c4637",
};

const STATUS_LABEL: Record<Provider["status"], string> = {
  active: "ACTIVE",
  configured: "CONFIGURED",
  not_set: "NOT SET",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 40,
    height: "100%",
    overflow: "auto",
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
    marginBottom: 16,
  },
  providerRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 16px",
    background: "var(--surface-low)",
    marginBottom: 4,
  },
  dot: (color: string) => ({
    width: 8,
    height: 8,
    background: color,
    flexShrink: 0,
  }),
  providerName: {
    fontFamily: "var(--font-label)",
    fontSize: 14,
    color: "var(--on-surface)",
    width: 100,
  },
  statusBadge: (color: string) => ({
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color,
    width: 90,
  }),
  keyField: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--outline)",
    flex: 1,
  },
  modelSelect: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--on-surface)",
    background: "var(--surface-lowest)",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "4px 8px",
    outline: "none",
    cursor: "pointer",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  input: {
    background: "var(--surface-lowest)",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "8px 12px",
    fontFamily: "var(--font-label)",
    fontSize: 14,
    color: "var(--on-surface)",
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  },
  inputFocused: {
    borderBottomColor: "var(--primary-container)",
  },
  toggle: (active: boolean) => ({
    width: 40,
    height: 20,
    background: active ? "var(--primary-container)" : "var(--surface-highest)",
    display: "flex",
    alignItems: "center",
    padding: 2,
    cursor: "pointer",
    transition: "background 0.15s",
  }),
  toggleDot: (active: boolean) => ({
    width: 16,
    height: 16,
    background: active ? "var(--on-primary-container)" : "var(--outline)",
    marginLeft: active ? 20 : 0,
    transition: "margin-left 0.15s, background 0.15s",
  }),
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "8px 0",
  },
  toggleLabel: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
  },
  button: {
    background: "var(--primary-container)",
    border: "none",
    padding: "8px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
  card: {
    background: "var(--surface-low)",
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardValue: {
    fontFamily: "var(--font-label)",
    fontSize: 14,
    color: "var(--on-surface)",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsView() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [autoIngestion, setAutoIngestion] = useState(true);
  const [autoRetrieval, setAutoRetrieval] = useState(true);
  const [splashEffect, setSplashEffect] = useState(true);
  const [searchMode, setSearchMode] = useState("hybrid");
  const [licenseKey, setLicenseKey] = useState("");
  const [cloudSync, setCloudSync] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchProviders().then(({ providers: p }) => setProviders(p));
    fetchConfig().then(({ config: c }) => {
      setConfig(c);
      setAutoIngestion(c.autoIngestion);
      setAutoRetrieval(c.autoRetrieval);
      setSplashEffect(c.splashEffect);
      setSearchMode(c.searchMode);
      setLicenseKey(c.licenseKey);
      setCloudSync(c.cloudSync);
    });
  }, []);

  const persist = useCallback((updates: Partial<AppConfig>) => {
    saveConfig(updates).catch(() => {});
  }, []);

  return (
    <div style={s.container}>
      {/* Provider config */}
      <div>
        <div style={s.sectionTitle}>LLM Providers (failover order)</div>
        {providers.map((p, i) => (
          <div key={p.name} style={s.providerRow}>
            <span style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--outline)", width: 16 }}>{i + 1}</span>
            <div style={s.dot(STATUS_DOT[p.status])} />
            <span style={s.providerName}>{p.name}</span>
            <span style={s.statusBadge(STATUS_DOT[p.status])}>{STATUS_LABEL[p.status]}</span>
            <span style={s.keyField}>{p.apiKey || "—"}</span>
            {p.models.length > 0 && (
              <select style={s.modelSelect} defaultValue={p.model || p.models[0]}>
                {p.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Cloud sync */}
      <div>
        <div style={s.sectionTitle}>Cloud Sync</div>
        <div style={s.card}>
          <div style={s.toggleRow}>
            <div style={s.toggle(cloudSync)} onClick={() => { const v = !cloudSync; setCloudSync(v); persist({ cloudSync: v }); }}>
              <div style={s.toggleDot(cloudSync)} />
            </div>
            <span style={s.toggleLabel}>Enable cloud backup</span>
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Devices</span>
            <span style={s.cardValue}>{config?.devicesLinked ?? 1} linked</span>
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Last Sync</span>
            <span style={s.cardValue}>{config?.lastSync ?? "Never"}</span>
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Encryption</span>
            <span style={{ ...s.cardValue, color: "#22C55E" }}>AES-256-GCM</span>
          </div>
        </div>
      </div>

      {/* License */}
      <div>
        <div style={s.sectionTitle}>License</div>
        <div style={s.card}>
          <div style={s.fieldGroup}>
            <div style={s.fieldLabel}>License Key</div>
            <input
              style={s.input}
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
              onBlur={(e) => { e.target.style.borderBottomColor = "transparent"; }}
            />
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Status</span>
            <span style={{ ...s.cardValue, color: "#22C55E" }}>{config?.licenseStatus ?? "ACTIVE"}</span>
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Expires</span>
            <span style={s.cardValue}>{config?.licenseExpiry ?? "—"}</span>
          </div>
          <div style={s.cardRow}>
            <span style={s.fieldLabel}>Plan</span>
            <span style={s.cardValue}>{config?.licensePlan ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* General */}
      <div>
        <div style={s.sectionTitle}>General</div>
        <div style={s.fieldGroup}>
          <div style={s.fieldLabel}>Search Mode</div>
          <select
            style={{ ...s.input, cursor: "pointer" }}
            value={searchMode}
            onChange={(e) => { setSearchMode(e.target.value); persist({ searchMode: e.target.value }); }}
          >
            <option value="hybrid">Hybrid (vector + keywords)</option>
            <option value="fts">FTS (keywords only)</option>
          </select>
        </div>
        <div style={s.toggleRow}>
          <div style={s.toggle(autoIngestion)} onClick={() => { const v = !autoIngestion; setAutoIngestion(v); persist({ autoIngestion: v }); }}>
            <div style={s.toggleDot(autoIngestion)} />
          </div>
          <span style={s.toggleLabel}>Auto-ingest tool outputs into memory</span>
        </div>
        <div style={s.toggleRow}>
          <div style={s.toggle(autoRetrieval)} onClick={() => { const v = !autoRetrieval; setAutoRetrieval(v); persist({ autoRetrieval: v }); }}>
            <div style={s.toggleDot(autoRetrieval)} />
          </div>
          <span style={s.toggleLabel}>Auto-inject relevant memories into context</span>
        </div>
        <div style={s.toggleRow}>
          <div style={s.toggle(splashEffect)} onClick={() => { const v = !splashEffect; setSplashEffect(v); persist({ splashEffect: v }); }}>
            <div style={s.toggleDot(splashEffect)} />
          </div>
          <span style={s.toggleLabel}>Show TTE splash animation on boot</span>
        </div>
      </div>
    </div>
  );
}
