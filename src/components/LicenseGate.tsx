/**
 * LicenseGate — blocks app access when license is expired.
 *
 * States:
 *   loading  → spinner while checking license
 *   valid    → render children (the app)
 *   expired  → full-screen paywall
 *   error    → allow through (user-first, same as exe-os CLI behavior)
 */

import React, { useEffect, useState } from "react";
import { fetchLicense, type LicenseInfo } from "../services/exeOsData";
import { colors, fonts, spacing } from "../styles/theme";

type GateState = "loading" | "valid" | "expired";

const RENEW_URL = "https://askexe.com/pricing";
const SPINNER_SIZE = 48;
const SPINNER_BORDER_WIDTH = 4;

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { license } = await fetchLicense();
        if (cancelled) return;
        setState(isLicenseValid(license) ? "valid" : "expired");
      } catch {
        // Network/module error — allow through
        if (!cancelled) setState("valid");
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") return <LoadingScreen />;
  if (state === "expired") return <PaywallScreen />;
  return <>{children}</>;
}

/** A license is valid if .valid is true and not past expiry. */
function isLicenseValid(license: LicenseInfo): boolean {
  if (!license.valid) return false;
  if (license.expiresAt) {
    return new Date(license.expiresAt).getTime() > Date.now();
  }
  return true;
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div style={centeredContainer}>
      <div style={spinnerStyle} />
      <style>{spinnerKeyframes}</style>
    </div>
  );
}

const centeredContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: colors.background,
};

const spinnerStyle: React.CSSProperties = {
  width: SPINNER_SIZE,
  height: SPINNER_SIZE,
  border: `${SPINNER_BORDER_WIDTH}px solid ${colors["outline-variant"]}`,
  borderTop: `${SPINNER_BORDER_WIDTH}px solid ${colors["primary-container"]}`,
  animation: "license-spin 0.8s linear infinite",
};

const spinnerKeyframes = `
  @keyframes license-spin {
    to { transform: rotate(360deg); }
  }
`;

// ---------------------------------------------------------------------------
// Paywall screen
// ---------------------------------------------------------------------------

function PaywallScreen() {
  return (
    <div style={centeredContainer}>
      <div style={paywallCard}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 64, color: colors["primary-container"] }}
        >
          lock
        </span>

        <h1 style={paywallHeading}>License Expired</h1>

        <p style={paywallBody}>
          Your Exe OS license has expired. Renew to continue using the desktop app.
        </p>

        <a href={RENEW_URL} target="_blank" rel="noopener noreferrer" style={ctaButton}>
          Renew at askexe.com
        </a>
      </div>
    </div>
  );
}

const paywallCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing.md,
  maxWidth: 400,
  padding: spacing.xl,
  textAlign: "center",
};

const paywallHeading: React.CSSProperties = {
  fontFamily: fonts.headline,
  fontSize: 28,
  fontWeight: 700,
  color: colors["on-surface"],
  margin: 0,
};

const paywallBody: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 15,
  lineHeight: 1.6,
  color: colors["on-surface-variant"],
  margin: 0,
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  marginTop: spacing.sm,
  padding: `${spacing.xs + 4}px ${spacing.lg}px`,
  background: colors["primary-container"],
  color: colors["on-primary-container"],
  fontFamily: fonts.label,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: 1,
  cursor: "pointer",
};
