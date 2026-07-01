"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  STORAGE_KEY,
  resolveLocale,
  type Locale,
} from "@/lib/i18n/config"

type TranslateFn = (key: string, fallback?: string) => string

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslateFn
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/** Read a dot-notation key (e.g. "nav.market") from a nested dictionary object. */
function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
  return typeof value === "string" ? value : undefined
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // Hydrate from the value the inline no-flash script already applied to <html lang>.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    const fromHtml = typeof document !== "undefined" ? document.documentElement.lang : null
    setLocaleState(resolveLocale(stored || fromHtml))
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
      // Optional cookie so the server could read the preference if ever needed.
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = next
    } catch {
      /* ignore storage errors */
    }
  }, [])

  const t = useCallback<TranslateFn>(
    (key, fallback) => {
      const active = DICTIONARIES[locale] as Record<string, unknown>
      const fromActive = lookup(active, key)
      if (fromActive !== undefined) return fromActive
      // Fall back to the canonical Italian dictionary, then the provided fallback / key.
      const fromDefault = lookup(DICTIONARIES[DEFAULT_LOCALE] as Record<string, unknown>, key)
      return fromDefault ?? fallback ?? key
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/** Access the active locale, a setter, and the `t` translate function. */
export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    // Safe fallback if used outside the provider: default locale, no-op setter.
    const t: TranslateFn = (key, fallback) => {
      const fromDefault = (DICTIONARIES[DEFAULT_LOCALE] as Record<string, unknown>)[key]
      return typeof fromDefault === "string" ? fromDefault : (fallback ?? key)
    }
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t }
  }
  return ctx
}
