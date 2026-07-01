import Link from "next/link"
import CollexSpark from "@/components/collexspark/CollexSpark"
import type { Insight, Severity } from "./types"

const SEVERITY_STYLES: Record<Severity, { badge: string; ring: string; label: string }> = {
  positive: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ring: "border-emerald-200 dark:border-emerald-900",
    label: "Positivo",
  },
  deal: {
    badge: "bg-spark-muted text-spark",
    ring: "border-spark/30",
    label: "Occasione",
  },
  warning: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ring: "border-amber-200 dark:border-amber-900",
    label: "Attenzione",
  },
  info: {
    badge: "bg-muted text-muted-foreground",
    ring: "border-border",
    label: "Info",
  },
}

export default function InsightCard({ insight }: { insight: Insight }) {
  const styles = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info

  return (
    <article className={`flex gap-4 rounded-xl border ${styles.ring} bg-card p-4`}>
      <div className="shrink-0">
        <CollexSpark pose={insight.pose} size="sm" still />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>{styles.label}</span>
          {typeof insight.value === "number" && insight.value > 0 ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {`€ ${Math.round(insight.value).toLocaleString("it-IT")}`}
            </span>
          ) : null}
        </div>
        <h3 className="text-pretty text-sm font-semibold text-card-foreground">{insight.title}</h3>
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{insight.message}</p>
        {insight.link ? (
          <Link
            href={insight.link}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-spark hover:underline"
          >
            Vai
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        ) : null}
      </div>
    </article>
  )
}
