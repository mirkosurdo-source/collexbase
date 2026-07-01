/**
 * CollexBase mobile theme tokens. Mirrors the web app's emerald + amber brand
 * so the native experience feels consistent with collexbase.app.
 */
import { useColorScheme } from "react-native"

export const palette = {
  emerald: "#0b8f5e",
  emeraldDark: "#0b3d2e",
  spark: "#f5a623",
  sparkSoft: "#fff4e0",
}

export interface Theme {
  background: string
  card: string
  cardAlt: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryText: string
  spark: string
  sparkSoft: string
  danger: string
  success: string
  shadow: string
}

const light: Theme = {
  background: "#f6f8f7",
  card: "#ffffff",
  cardAlt: "#f0f4f2",
  border: "#e2e8e5",
  text: "#0f1a16",
  textMuted: "#5c6b64",
  primary: palette.emerald,
  primaryText: "#ffffff",
  spark: palette.spark,
  sparkSoft: palette.sparkSoft,
  danger: "#dc2626",
  success: "#16a34a",
  shadow: "rgba(11, 61, 46, 0.12)",
}

const dark: Theme = {
  background: "#0a0f0d",
  card: "#121a16",
  cardAlt: "#1a2520",
  border: "#243029",
  text: "#f1f5f3",
  textMuted: "#9bb0a7",
  primary: "#19b074",
  primaryText: "#04130d",
  spark: palette.spark,
  sparkSoft: "#2a2113",
  danger: "#f87171",
  success: "#4ade80",
  shadow: "rgba(0, 0, 0, 0.4)",
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 }
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 34 }

export function useTheme(): Theme {
  const scheme = useColorScheme()
  return scheme === "dark" ? dark : light
}

export const themes = { light, dark }

/**
 * Static theme object (light palette) used by the feature screens that prefer a
 * single import over the `useTheme()` hook. Provides `colors`, `spacing`,
 * `radius`, and `fontSize` under one namespace.
 */
export const theme = {
  colors: {
    background: light.background,
    card: light.card,
    cardAlt: light.cardAlt,
    muted: light.cardAlt,
    border: light.border,
    foreground: light.text,
    mutedForeground: light.textMuted,
    primary: light.primary,
    primaryForeground: light.primaryText,
    primarySoft: "#e3f3ec",
    spark: light.spark,
    sparkSoft: light.sparkSoft,
    danger: light.danger,
    success: light.success,
    warning: light.spark,
  },
  spacing,
  radius: { ...radius, full: radius.pill },
  fontSize,
}
