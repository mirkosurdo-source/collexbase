"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

const THEME_KEY = "collexbase:theme"

export default function ThemeSwitcher() {
  const { t } = useTranslation()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggleTheme() {
    const root = document.documentElement
    const next = !root.classList.contains("dark")
    root.classList.toggle("dark", next)
    root.classList.toggle("light", !next)
    setIsDark(next)
    try {
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      title={isDark ? t("theme.toLight") : t("theme.toDark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
