import it from "@/locales/it.json"
import en from "@/locales/en.json"
import es from "@/locales/es.json"
import fr from "@/locales/fr.json"
import de from "@/locales/de.json"
import ru from "@/locales/ru.json"
import zh from "@/locales/zh.json"

// Blocco 26 — multilingual support. All dictionaries share the same keys as it.json.
export type Locale = "it" | "en" | "es" | "fr" | "de" | "ru" | "zh"

export const DEFAULT_LOCALE: Locale = "it"

export const STORAGE_KEY = "collexbase:lang"

/** Display metadata for the language switcher (flag emoji + native label). */
export const LANGUAGES: { code: Locale; flag: string; native: string }[] = [
  { code: "it", flag: "🇮🇹", native: "Italiano" },
  { code: "en", flag: "🇬🇧", native: "English" },
  { code: "es", flag: "🇪🇸", native: "Español" },
  { code: "fr", flag: "🇫🇷", native: "Français" },
  { code: "de", flag: "🇩🇪", native: "Deutsch" },
  { code: "ru", flag: "🇷🇺", native: "Русский" },
  { code: "zh", flag: "🇨🇳", native: "中文" },
]

// The Italian dictionary is the canonical source of valid keys.
export type Dictionary = typeof it

export const DICTIONARIES: Record<Locale, Dictionary> = { it, en, es, fr, de, ru, zh }

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && value in DICTIONARIES
}

/** Resolve a stored/browser value to a supported locale, falling back to the default. */
export function resolveLocale(value: string | null | undefined): Locale {
  if (isLocale(value)) return value
  const short = value?.slice(0, 2).toLowerCase()
  if (isLocale(short)) return short
  return DEFAULT_LOCALE
}
