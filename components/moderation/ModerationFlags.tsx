"use client"

import { useCallback, useEffect, useState } from "react"
import CollexSpark from "@/components/collexspark/CollexSpark"

interface ModerationFlag {
  id: string
  targetType: string
  targetId: string
  severity: "low" | "medium" | "high" | "critical"
  category: string
  reason: string
  autoActioned: boolean
  resolved: boolean
  resolution: string | null
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  listing: "annuncio",
  auction: "asta",
  post: "post",
  comment: "commento",
  message: "messaggio",
  review: "recensione",
  profile: "profilo",
  showcase: "vetrina",
}

const CATEGORY_LABEL: Record<string, string> = {
  spam: "spam",
  scam: "possibile truffa",
  abuse: "contenuto abusivo",
  counterfeit: "sospetto falso",
  off_topic: "fuori tema",
  other: "violazione delle linee guida",
}

const SEVERITY_STYLE: Record<string, string> = {
  low: "border-border bg-muted/50",
  medium: "border-amber-500/30 bg-amber-500/5",
  high: "border-orange-500/30 bg-orange-500/5",
  critical: "border-red-500/30 bg-red-500/5",
}

function flagMessage(f: ModerationFlag): string {
  const type = TYPE_LABEL[f.targetType] ?? "contenuto"
  const cat = CATEGORY_LABEL[f.category] ?? "violazione"
  if (f.resolution === "removed") return `Il tuo ${type} è stato rimosso: ${cat}.`
  if (f.autoActioned) return `Il tuo ${type} è stato sospeso automaticamente: ${cat}.`
  return `Il tuo ${type} è stato segnalato per revisione: ${cat}.`
}

/**
 * Blocco 37 — user-facing banner that surfaces the current user's own open
 * moderation flags. Mounts anywhere (e.g. dashboard, profile) and stays silent
 * for logged-out users or when there is nothing to show.
 */
export default function ModerationFlags({ className = "" }: { className?: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [flags, setFlags] = useState<ModerationFlag[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setToken(localStorage.getItem("token"))
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/moderation/my-flags?open=1", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setFlags(data.flags || [])
    } catch {
      // Silent: a banner must never break the page.
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (!token) return null

  const visible = flags.filter((f) => !dismissed.has(f.id))
  if (visible.length === 0) return null

  const worst = visible.reduce<ModerationFlag>((acc, f) => {
    const order = { low: 0, medium: 1, high: 2, critical: 3 }
    return order[f.severity] > order[acc.severity] ? f : acc
  }, visible[0])

  return (
    <section
      aria-label="Avvisi di moderazione"
      className={`rounded-lg border p-4 ${SEVERITY_STYLE[worst.severity] ?? SEVERITY_STYLE.low} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <CollexSpark pose="alert" size="sm" still />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {visible.length === 1 ? "Avviso di moderazione" : `${visible.length} avvisi di moderazione`}
          </h3>
          <ul className="mt-2 space-y-2">
            {visible.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-pretty text-sm text-foreground">{flagMessage(f)}</p>
                  {f.reason ? <p className="mt-0.5 text-xs text-muted-foreground">{f.reason}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(f.id))}
                  aria-label="Nascondi avviso"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Nascondi
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground text-pretty">
            Se ritieni si tratti di un errore, puoi contattare il supporto per una revisione manuale.
          </p>
        </div>
      </div>
    </section>
  )
}
