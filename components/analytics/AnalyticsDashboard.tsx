"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"
import ValueLineChart from "@/components/charts/ValueLineChart"
import CategoryPieChart from "@/components/charts/CategoryPieChart"

type TrendPoint = { label: string; value: number }
type CategoryDatum = { category: string; value: number; count: number }
type Snapshot = {
  totalValue: number
  totalItems: number
  rareCount: number
  highValueCount: number
  duplicateCount: number
  categories: CategoryDatum[]
  trend7d: number
  trend30d: number
}
type Series = { week: TrendPoint[]; month: TrendPoint[]; year: TrendPoint[] }
type MarketDatum = { category: string; avgValue: number; volume: number; trend7d: number; trend30d: number }
type Market = {
  rising: MarketDatum[]
  falling: MarketDatum[]
  hotAuctions: { id: string; itemName: string; image: string; bids: number; currentPrice: number }[]
  activeTrades: number
  mostSaved: { id: string; itemName: string; image: string; savedCount: number; price: number }[]
}
type Insight = { id: string; pose: SparkPose; severity: string; title: string; message: string; link?: string }

type Range = "week" | "month" | "year"
const RANGE_LABELS: Record<Range, string> = { week: "Settimana", month: "Mese", year: "Anno" }

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function TrendPill({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        up
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {up ? "+" : ""}
      {pct}%
    </span>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {hint}
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

export default function AnalyticsDashboard({ embedded = false }: { embedded?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [series, setSeries] = useState<Series | null>(null)
  const [market, setMarket] = useState<Market | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [spark, setSpark] = useState<{ pose: SparkPose; message: string } | null>(null)
  const [range, setRange] = useState<Range>("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const headers = authHeaders()
    async function load() {
      try {
        const [snapRes, marketRes, insightRes] = await Promise.all([
          fetch("/api/analytics/snapshot", { headers }),
          fetch("/api/analytics/market", { headers }),
          fetch("/api/analytics/advisor-insights", { headers }),
        ])
        const snap = await snapRes.json()
        const mk = await marketRes.json()
        const ins = await insightRes.json()
        if (snap.success) {
          setSnapshot(snap.snapshot)
          setSeries(snap.series)
        }
        if (mk.success) setMarket(mk)
        if (ins.success) {
          setInsights(ins.insights || [])
          setSpark(ins.spark || null)
        }
        if (!snap.success && !mk.success) setError("Impossibile caricare gli analytics.")
      } catch {
        setError("Impossibile caricare gli analytics.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Caricamento analytics...</p>
  }
  if (error) {
    return <p className="py-10 text-center text-sm text-destructive">{error}</p>
  }

  return (
    <div className={embedded ? "" : "py-8"}>
      {/* CollexSpark commentary */}
      {spark ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-spark/20 bg-spark-muted/30 p-4">
          <CollexSpark pose={spark.pose} size="md" still />
          <p className="text-sm font-medium text-foreground">{spark.message}</p>
        </div>
      ) : null}

      {/* Dashboard Collezione — stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Valore"
          value={snapshot ? formatEUR(snapshot.totalValue) : "—"}
          hint={snapshot ? <TrendPill pct={snapshot.trend7d} /> : undefined}
        />
        <StatCard label="Oggetti" value={snapshot?.totalItems ?? 0} />
        <StatCard label="Rari" value={snapshot?.rareCount ?? 0} />
        <StatCard label="Alto valore" value={snapshot?.highValueCount ?? 0} />
        <StatCard label="Doppioni" value={snapshot?.duplicateCount ?? 0} />
        <StatCard label="Trend 30g" value={`${snapshot && snapshot.trend30d >= 0 ? "+" : ""}${snapshot?.trend30d ?? 0}%`} />
      </div>

      {/* Value trend chart */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Andamento valore</h2>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {series && snapshot && snapshot.totalValue > 0 ? (
            <ValueLineChart data={series[range]} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aggiungi oggetti alla collezione per vedere l&apos;andamento del valore.
            </p>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Valore per categoria</h2>
        {snapshot && snapshot.categories.length > 0 ? (
          <CategoryPieChart data={snapshot.categories} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nessuna categoria da mostrare.</p>
        )}
      </div>

      {/* Trend Mercato */}
      {market ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CollexSpark pose="trend" size="sm" still />
              Categorie in crescita
            </h2>
            {market.rising.length ? (
              <ul className="flex flex-col gap-2">
                {market.rising.map((c) => (
                  <li key={c.category} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="text-foreground">{c.category}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">{c.volume} annunci</span>
                      <TrendPill pct={c.trend7d} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna categoria in crescita.</p>
            )}
            {market.falling.length ? (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">In calo</h3>
                <ul className="flex flex-col gap-2">
                  {market.falling.map((c) => (
                    <li key={c.category} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="text-foreground">{c.category}</span>
                      <TrendPill pct={c.trend7d} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CollexSpark pose="auction" size="sm" still />
              Aste calde & scambi
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{market.activeTrades} scambi attivi nell&apos;ecosistema.</p>
            {market.hotAuctions.length ? (
              <ul className="flex flex-col gap-2">
                {market.hotAuctions.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image || "/placeholder.svg"} alt={a.itemName} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.itemName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.bids} offerte · {formatEUR(a.currentPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna asta attiva.</p>
            )}
            {market.mostSaved.length ? (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">Più ricercati</h3>
                <ul className="flex flex-col gap-2">
                  {market.mostSaved.map((l) => (
                    <li key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-foreground">{l.itemName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{l.savedCount} salvataggi</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Insights AI Advisor */}
      {insights.length ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <CollexSpark pose="trend" size="sm" still />
            Insights AI Advisor
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins) => {
              const card = (
                <div className="flex h-full items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <CollexSpark pose={ins.pose} size="sm" still />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ins.message}</p>
                  </div>
                </div>
              )
              return ins.link ? (
                <Link key={ins.id} href={ins.link} className="block transition-opacity hover:opacity-80">
                  {card}
                </Link>
              ) : (
                <div key={ins.id}>{card}</div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
