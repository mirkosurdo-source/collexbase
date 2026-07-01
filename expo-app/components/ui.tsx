import React from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode
  scroll?: boolean
  padded?: boolean
}) {
  const t = useTheme()
  const Body = scroll ? ScrollView : View
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={["top", "left", "right"]}>
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={scroll && padded ? { padding: spacing.lg, paddingBottom: spacing.xxl } : undefined}
      >
        {children}
      </Body>
    </SafeAreaView>
  )
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
}) {
  const t = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Title({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return <Text style={{ color: t.text, fontSize: fontSize.xxl, fontWeight: "800" }}>{children}</Text>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return <Text style={{ color: t.textMuted, fontSize: fontSize.md, lineHeight: 22 }}>{children}</Text>
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return (
    <Text style={{ color: t.textMuted, fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase" }}>
      {children}
    </Text>
  )
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: {
  title: string
  onPress: () => void
  variant?: "primary" | "outline" | "ghost"
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const isPrimary = variant === "primary"
  const bg = isPrimary ? t.primary : variant === "outline" ? "transparent" : t.cardAlt
  const fg = isPrimary ? t.primaryText : t.text
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: variant === "outline" ? t.border : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || disabled ? 0.7 : 1,
          flexDirection: "row",
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: fontSize.md, fontWeight: "700" }}>{title}</Text>
      )}
    </Pressable>
  )
}

export type BadgeTone = "spark" | "success" | "muted" | "default" | "warning" | "danger"

export function Badge({ text, label, tone = "spark" }: { text?: string; label?: string; tone?: BadgeTone }) {
  const t = useTheme()
  const content = text ?? label ?? ""
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    spark: { bg: t.sparkSoft, fg: t.spark },
    warning: { bg: t.sparkSoft, fg: t.spark },
    success: { bg: t.cardAlt, fg: t.success },
    danger: { bg: t.cardAlt, fg: t.danger },
    muted: { bg: t.cardAlt, fg: t.textMuted },
    default: { bg: t.cardAlt, fg: t.textMuted },
  }
  const { bg, fg } = map[tone] ?? map.default
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: fontSize.xs, fontWeight: "700" }}>{content}</Text>
    </View>
  )
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: spacing.md }, style]}>{children}</View>
}

export function EmptyState({
  message,
  title,
  subtitle,
}: {
  message?: string
  title?: string
  subtitle?: string
}) {
  const t = useTheme()
  const heading = title ?? message ?? ""
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.xs }}>
      <Text style={{ color: t.text, fontSize: fontSize.md, fontWeight: "700", textAlign: "center" }}>{heading}</Text>
      {subtitle ? (
        <Text style={{ color: t.textMuted, fontSize: fontSize.sm, textAlign: "center" }}>{subtitle}</Text>
      ) : null}
    </View>
  )
}

export function Loading() {
  const t = useTheme()
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl }}>
      <ActivityIndicator color={t.primary} size="large" />
    </View>
  )
}
