import { ShieldCheck } from "lucide-react"

const TIER_STYLES: Record<string, string> = {
  Nuovo: "bg-muted text-muted-foreground",
  Affidabile: "bg-chart-2/15 text-chart-2",
  Esperto: "bg-primary/15 text-primary",
  Veterano: "bg-chart-4/20 text-chart-4",
  Leggenda: "bg-chart-5/20 text-chart-5",
}

interface ReputationBadgeProps {
  tier: string
  score?: number
  showScore?: boolean
  className?: string
}

/** A colored pill representing a user's reputation tier (and optional score). */
export default function ReputationBadge({ tier, score, showScore = false, className = "" }: ReputationBadgeProps) {
  const style = TIER_STYLES[tier] || TIER_STYLES.Nuovo
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style} ${className}`}
    >
      <ShieldCheck width={13} height={13} />
      {tier}
      {showScore && typeof score === "number" ? <span className="opacity-80">· {score}</span> : null}
    </span>
  )
}
