"use client"

import type { BoostTier } from "@/lib/models/BoostActivation"

const TIER_STYLE: Record<BoostTier, { label: string; cls: string }> = {
  base: {
    label: "Boost",
    cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800",
  },
  plus: {
    label: "Boost Plus",
    cls: "bg-amber-200 text-amber-900 ring-1 ring-amber-400 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-700",
  },
  ultra: {
    label: "Boost Ultra",
    cls: "bg-amber-400 text-amber-950 ring-1 ring-amber-500 dark:bg-amber-500 dark:text-amber-950 dark:ring-amber-400",
  },
}

/** Small premium chip marking a boosted listing/auction/trade/showcase. */
export default function BoostBadge({ tier, className = "" }: { tier: BoostTier; className?: string }) {
  const style = TIER_STYLE[tier] ?? TIER_STYLE.base
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${style.cls} ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
      </svg>
      {style.label}
    </span>
  )
}
