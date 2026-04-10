/**
 * Design tokens — Exe Foundry Bold / "Analog Terminal" design system.
 * Source: Stitch reference (DESIGN.md + code.html).
 *
 * Rules:
 * - 0px border-radius everywhere (pixel-perfect aesthetic)
 * - No 1px borders for sectioning — use background color shifts only
 * - 8px spacing grid (8, 16, 24, 40, 64)
 * - No pure white — use on-surface (#e4e0f2) or primary (#fff4dc)
 */

export const colors = {
  background: "#13121e",
  surface: "#13121e",
  "surface-container-lowest": "#0e0d19",
  "surface-container-low": "#1b1a27",
  "surface-container": "#1f1e2b",
  "surface-container-high": "#2a2836",
  "surface-container-highest": "#353341",
  "surface-bright": "#393845",
  "surface-variant": "#353341",

  primary: "#fff4dc",
  "primary-container": "#f5d76e",
  "primary-fixed": "#ffe178",
  "primary-fixed-dim": "#e2c55e",
  "on-primary": "#3b2f00",
  "on-primary-container": "#715c00",
  "on-primary-fixed": "#231b00",

  secondary: "#dec1ac",
  "secondary-container": "#574333",
  "secondary-fixed": "#fbddc7",
  "secondary-fixed-dim": "#dec1ac",
  "on-secondary": "#3f2d1e",
  "on-secondary-container": "#ccb09c",

  tertiary: "#fff2f0",
  "tertiary-container": "#ffcdc5",
  "tertiary-fixed": "#ffdad4",
  "tertiary-fixed-dim": "#ffb4a8",
  "on-tertiary": "#690000",
  "on-tertiary-container": "#b42619",

  error: "#ffb4ab",
  "error-container": "#93000a",
  "on-error": "#690005",
  "on-error-container": "#ffdad6",

  "on-surface": "#e4e0f2",
  "on-surface-variant": "#cfc6b1",
  "on-background": "#e4e0f2",
  outline: "#98907d",
  "outline-variant": "#4c4637",

  "inverse-surface": "#e4e0f2",
  "inverse-on-surface": "#302f3c",
  "inverse-primary": "#715d00",
  "surface-tint": "#e2c55e",
} as const;

export const fonts = {
  headline: "'Epilogue', sans-serif",
  body: "'Manrope', sans-serif",
  label: "'Space Grotesk', sans-serif",
} as const;

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 40,
  xl: 64,
} as const;

export const layout = {
  sidebarWidth: 200,
  topBarHeight: 64,
} as const;
