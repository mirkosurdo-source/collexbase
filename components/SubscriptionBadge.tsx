type PlanTier = "Base" | "Gold" | "Premium"

const STYLES: Record<Exclude<PlanTier, "Base">, string> = {
  Gold: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800",
  Premium:
    "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
}

const SIZES = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
}

/**
 * Compact subscription tier badge for use across profiles, community,
 * comments, marketplace, auctions and trades. Base users have no badge,
 * so this renders nothing for the Base tier (per the pricing spec).
 */
export default function SubscriptionBadge({
  plan,
  size = "md",
  className = "",
}: {
  plan?: string | null
  size?: "sm" | "md"
  className?: string
}) {
  if (plan !== "Gold" && plan !== "Premium") return null
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[plan]} ${SIZES[size]} ${className}`}
      title={`Abbonamento ${plan}`}
    >
      {plan}
    </span>
  )
}
