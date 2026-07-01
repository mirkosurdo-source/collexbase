"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type HistoryPoint = { date: string; value: number }

type Metadata = {
  name: string
  series?: string | null
  set?: string | null
  rarity?: string | null
  number?: string | null
  edition?: string | null
  variants?: string[]
  certifications?: string[]
  confidence?: number
  grading?: { score: number; label: string; defects: string[] }
  marketValue?: {
    estimated: number
    min: number
    max: number
    trend: "up" | "stable" | "down"
    forecast30d: number
    history: HistoryPoint[]
  }
  duplicates?: {
    total: number
    recommendedForSale: number
    recommendedForTrade: number
    recommendedToKeep: number
  }
  advisor?: {
    sellNow: boolean
    hold: boolean
    auctionRecommended: boolean
    tradeRecommended: boolean
    reason: string
  }
  updatedAt?: string
}

function euro(n: number | undefined): string {
  return `€ ${Number(n || 0).toLocaleString("it-IT")}`
}

function TrendBadge({ trend }: { trend: "up" | "stable" | "down" }) {
  const map = {
    up: { label: "In aumento", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
    down: { label: "In calo", cls: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
    stable: { label: "Stabile", cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" },
  }
  const m = map[trend] || map.stable
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (!points || points.length < 2) return null
  const values = points.map((p) => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  return (
    <div className="mt-3 flex items-end gap-1" aria-hidden="true">
      {points.map((p, i) => {
        const h = 8 + ((p.value - min) / span) * 32
        return (
          <div key={`${p.date}-${i}`} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-sm bg-neutral-300 dark:bg-neutral-700" style={{ height: `${h}px` }} />
            <span className="text-[9px] text-neutral-400">{p.date.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  )
}

export default function AICollectionPanel({ objectId, hasImage }: { objectId: string; hasImage: boolean }) {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")
  const [dupMessage, setDupMessage] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const loadMetadata = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/ai/metadata?objectId=${encodeURIComponent(objectId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setMetadata(data.metadata)
    } catch {
      // Non-blocking: the panel still offers the analyze action.
    } finally {
      setLoading(false)
    }
  }, [objectId, token])

  useEffect(() => {
    loadMetadata()
  }, [loadMetadata])

  async function analyze() {
    if (!token) return
    setAnalyzing(true)
    setError("")
    setDupMessage("")
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objectId }),
      })
      const data = await res.json()
      if (data.success) {
        setMetadata(data.metadata)
        setDupMessage(data.duplicateMessage || "")
      } else {
        setError(data.message || "Analisi AI non riuscita.")
      }
    } catch {
      setError("Errore di rete durante l'analisi.")
    } finally {
      setAnalyzing(false)
    }
  }

  const m = metadata
  const market = m?.marketValue
  const advisor = m?.advisor
  const grading = m?.grading
  const dup = m?.duplicates

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Valutazione AI
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Identificazione, grading, valore di mercato e consigli intelligenti.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={analyzing || !hasImage}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {analyzing ? "Analisi in corso..." : m ? "Rianalizza" : "Analizza con AI"}
        </button>
      </div>

      {!hasImage && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Aggiungi un'immagine all'oggetto per abilitare la valutazione AI.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading && <p className="mt-4 text-sm text-neutral-400">Caricamento metadati...</p>}

      {!loading && !m && !error && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Nessuna valutazione disponibile. Avvia l'analisi per riconoscere l'oggetto e stimarne il valore.
        </p>
      )}

      {m && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Identification */}
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Identificazione</h3>
            <dl className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800/70">
              <Row label="Nome" value={m.name || "—"} />
              <Row label="Serie" value={m.series || "—"} />
              <Row label="Set" value={m.set || "—"} />
              <Row label="Rarità" value={m.rarity || "—"} />
              <Row label="Numero" value={m.number || "—"} />
              <Row label="Edizione" value={m.edition || "—"} />
              <Row label="Confidenza" value={`${Math.round((m.confidence || 0) * 100)}%`} />
            </dl>
            {(m.variants?.length || m.certifications?.length) ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.variants?.map((v) => (
                  <span key={v} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {v}
                  </span>
                ))}
                {m.certifications?.map((c) => (
                  <span key={c} className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Grading */}
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Grading condizioni</h3>
            {grading ? (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{grading.score}</span>
                  <span className="text-sm text-neutral-500">/ 10</span>
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {grading.label}
                  </span>
                </div>
                {grading.defects?.length > 0 && (
                  <ul className="mt-3 list-inside list-disc text-xs text-neutral-500 dark:text-neutral-400">
                    {grading.defects.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">—</p>
            )}
          </div>

          {/* Market value */}
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Valore di mercato</h3>
              {market && <TrendBadge trend={market.trend} />}
            </div>
            {market ? (
              <>
                <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{euro(market.estimated)}</p>
                <p className="text-sm text-neutral-500">
                  Range {euro(market.min)} – {euro(market.max)}
                </p>
                <p className="mt-1 text-xs text-neutral-400">Previsione 30 giorni: {euro(market.forecast30d)}</p>
                <Sparkline points={market.history || []} />
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">—</p>
            )}
          </div>

          {/* Advisor + duplicates */}
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Consiglio AI</h3>
            {advisor ? (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {advisor.sellNow && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Vendi ora
                    </span>
                  )}
                  {advisor.hold && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      Tieni
                    </span>
                  )}
                  {advisor.auctionRecommended && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      Asta consigliata
                    </span>
                  )}
                  {advisor.tradeRecommended && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      Scambio
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{advisor.reason}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">—</p>
            )}

            {dup && dup.total > 1 && (
              <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                Duplicati: {dup.total} copie — vendi {dup.recommendedForSale}, scambia {dup.recommendedForTrade}, tieni{" "}
                {dup.recommendedToKeep}.
              </p>
            )}
            {dupMessage && !dup && (
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{dupMessage}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/market/new"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Crea annuncio
              </Link>
              {advisor?.auctionRecommended && (
                <Link
                  href="/auctions"
                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  Metti all'asta
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
