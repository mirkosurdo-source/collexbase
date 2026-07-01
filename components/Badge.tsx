type BadgeTier = "Base" | "Gold" | "Premium"

const STYLES: Record<BadgeTier, string> = {
  Base: "bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
  Gold: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800",
  Premium: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
}

export default function Badge({ tier, className = "" }: { tier: string; className?: string }) {
  const key = (["Base", "Gold", "Premium"].includes(tier) ? tier : "Base") as BadgeTier
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[key]} ${className}`}
    >
      {key}
    </span>
  )
}
