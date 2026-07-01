"use client"

import { useTranslation } from "@/lib/i18n/LanguageProvider"

/**
 * Blocco 26 — localized CollexSpark greetings for UI surfaces.
 *
 * This only localizes the mascot's presentational, UI-level lines (greetings and
 * intros). It does NOT translate AI-generated insight content, which is produced
 * by the advisor/wishlist engines and left untouched per the block constraints.
 */
export function useSparkMessages() {
  const { t } = useTranslation()
  return {
    greeting: t("spark.greeting"),
    advisorIntro: t("spark.advisorIntro"),
    wishlistIntro: t("spark.wishlistIntro"),
    noOpportunities: t("spark.noOpportunities"),
  }
}
