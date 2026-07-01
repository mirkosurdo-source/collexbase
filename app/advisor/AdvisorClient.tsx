"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"
import GroupCard, { type GroupSummary } from "@/components/groups/GroupCard"
import BoostButton from "@/components/boost/BoostButton"
import InsightCard from "@/components/advisor/InsightCard"
import TrendChart from "@/components/advisor/TrendChart"
import type {
  CollectionReport,
  MarketplaceReport,
  TradeReport,
  AuctionReport,
  WishlistReport,
  Insight,
} from "@/components/advisor/types"
import type { WishlistOpportunity } from "@/lib/wishlist-engine"

type TabKey = "collection" | "marketplace" | "trades" | "auctions" | "wishlist"

interface ReliabilitySeller {
  userId: string
  username: string
  name: string
  avatar: string
  avg: number
  count: number
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "collection", label: "Collezione" },
  { key: "marketplace", label: "Marketplace" },
  { key: "trades", label: "Scambi" },
  { key: "auctions", label: "Aste" },
  { key: "wishlist", label: "Wishlist" },
]

function eur(n: number): string {
  return `€ ${Math.round(n || 0).toLocaleString("it-IT")}`
}

export default function AdvisorClient() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>("collection")
  const [loading, setLoading] = useState(true)

  const [collection, setCollection] = useState<CollectionReport | null>(null)
  const [marketplace, setMarketplace] = useState<MarketplaceReport | null>(null)
  const [trades, setTrades] = useState<TradeReport | null>(null)
  const [auctions, setAuctions] = useState<AuctionReport | null>(null)
  const [wishlist, setWishlist] = useState<WishlistReport | null>(null)
  const [wishlistOpps, setWishlistOpps] = useState<WishlistOpportunity[] | null>(null)
  const [reliability, setReliability] = useState<{ trusted: ReliabilitySeller[]; risky: ReliabilitySeller[] } | null>(
    null,
  )
  const [recommendedGroups, setRecommendedGroups] = useState<GroupSummary[]>([])
  const [showcaseAnalysis, setShowcaseAnalysis] = useState<{
    visibility: string
    exposedCount: number
    exposedValue: number
    rareCount: number
    themes: number
    trendPct: number
    duplicates: number
  } | null>(null)
  const [boostSuggestions, setBoostSuggestions] = useState<
    {
      targetType: "marketplace" | "auction" | "trade" | "showcase"
      targetId: string
      title: string
      image: string
      score: number
      reason: string
      hot: boolean
      recommendedTier: string
      quote: { finalPrice: number; discountPct: number; effect: { durationHours: number } }
    }[]
  >([])
  const [analyticsInsights, setAnalyticsInsights] = useState<
    {
      id: string
      pose: string
      severity: "positive" | "warning" | "deal" | "info"
      title: string
      message: string
      link?: string
    }[]
  >([])
  const [analyticsSpark, setAnalyticsSpark] = useState<{ pose: string; message: string } | null>(null)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login?redirect=/advisor")
      return
    }
    setToken(t)
  }, [router])

  const loadAll = useCallback(async (authToken: string) => {
    setLoading(true)
    const headers = { Authorization: `Bearer ${authToken}` }
    const endpoints: [TabKey, string][] = [
      ["collection", "/api/ai/advisor/collection"],
      ["marketplace", "/api/ai/advisor/marketplace"],
      ["trades", "/api/ai/advisor/trades"],
      ["auctions", "/api/ai/advisor/auctions"],
      ["wishlist", "/api/ai/advisor/wishlist"],
    ]
    const results = await Promise.allSettled(
      endpoints.map(([, url]) => fetch(url, { headers }).then((r) => r.json())),
    )
    results.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value?.success) return
      const key = endpoints[i][0]
      if (key === "collection") setCollection(res.value)
      else if (key === "marketplace") setMarketplace(res.value)
      else if (key === "trades") setTrades(res.value)
      else if (key === "auctions") setAuctions(res.value)
      else if (key === "wishlist") setWishlist(res.value)
    })
    setLoading(false)

    // Blocco 24 — live wishlist opportunities from the dedicated engine.
    fetch("/api/wishlist/check", { method: "POST", headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setWishlistOpps(d.opportunities || [])
      })
      .catch(() => {})

    // Blocco 28 — seller reliability based on reviews.
    fetch("/api/reviews/reliability")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setReliability({ trusted: d.trusted || [], risky: d.risky || [] })
      })
      .catch(() => {})

    // Blocco 30 — recommended thematic groups.
    fetch("/api/groups/recommended", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setRecommendedGroups(d.groups || [])
      })
      .catch(() => {})

    // Blocco 32 — own showcase analysis.
    fetch("/api/showcase", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && d.analysis) {
          setShowcaseAnalysis({
            visibility: d.showcase?.visibility || "disabled",
            exposedCount: d.analysis.exposedCount,
            exposedValue: d.analysis.exposedValue,
            rareCount: d.analysis.rareCount,
            themes: d.analysis.themes,
            trendPct: d.analysis.trendPct,
            duplicates: d.analysis.duplicates,
          })
        }
      })
      .catch(() => {})

    // Blocco 33 — boost opportunity suggestions.
    fetch("/api/boost/suggestions", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setBoostSuggestions(d.suggestions || [])
      })
      .catch(() => {})

    // Blocco 34 — advanced analytics insights.
    fetch("/api/analytics/advisor-insights", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) {
          setAnalyticsInsights(d.insights || [])
          setAnalyticsSpark(d.spark || null)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (token) loadAll(token)
  }, [token, loadAll])

  const allCards: Insight[] = useMemo(() => {
    return [
      ...(collection?.cards || []),
      ...(marketplace?.cards || []),
      ...(trades?.cards || []),
      ...(auctions?.cards || []),
      ...(wishlist?.cards || []),
    ]
  }, [collection, marketplace, trades, auctions, wishlist])

  const headline = useMemo<{ pose: SparkPose; message: string }>(() => {
    if (loading) return { pose: "happy", message: "Sto analizzando la tua collezione e il mercato..." }
    if (allCards.some((c) => c.severity === "warning"))
      return { pose: "alert", message: "Ho trovato alcune cose a cui fare attenzione. Diamo un'occhiata!" }
    if (allCards.some((c) => c.severity === "deal"))
      return { pose: "deal", message: "Ci sono buone occasioni per te in questo momento!" }
    if (allCards.length === 0)
      return { pose: "happy", message: "Tutto tranquillo! Aggiungi oggetti e attiva l'AI per più consigli." }
    return { pose: "trend", message: "Ecco il mio riepilogo strategico per la tua collezione." }
  }, [loading, allCards])

  const counts = useMemo(
    () => ({
      collection: collection?.cards.length || 0,
      marketplace: marketplace?.cards.length || 0,
      trades: trades?.cards.length || 0,
      auctions: auctions?.cards.length || 0,
      wishlist: wishlist?.cards.length || 0,
    }),
    [collection, marketplace, trades, auctions, wishlist],
  )

  const activeCards: Insight[] = useMemo(() => {
    switch (tab) {
      case "collection":
        return collection?.cards || []
      case "marketplace":
        return marketplace?.cards || []
      case "trades":
        return trades?.cards || []
      case "auctions":
        return auctions?.cards || []
      case "wishlist":
        return wishlist?.cards || []
    }
  }, [tab, collection, marketplace, trades, auctions, wishlist])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <section className="mb-8 flex flex-col items-center gap-6 rounded-2xl border border-spark/20 bg-spark-muted/40 p-6 sm:flex-row sm:items-center sm:p-8">
        <CollexSpark pose={headline.pose} size="xl" message={headline.message} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-spark">CollexSpark · AI Advisor</p>
          <h1 className="mt-1 text-balance text-2xl font-bold text-foreground sm:text-3xl">
            Il tuo consulente personale da collezione
          </h1>
          {collection?.totals ? (
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
              <Stat label="Oggetti" value={String(collection.totals.items)} />
              <Stat label="Valore stimato" value={eur(collection.totals.totalValue)} />
              <Stat label="Previsione 30g" value={eur(collection.totals.forecastValue)} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Category trend chart */}
      {collection?.categoryTrends && collection.categoryTrends.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <CollexSpark pose="trend" size="sm" still />
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Tendenze per categoria</h2>
              <p className="text-sm text-muted-foreground">Variazione di valore prevista a 30 giorni (%).</p>
            </div>
          </div>
          <TrendChart data={collection.categoryTrends} />
        </section>
      ) : null}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-spark text-spark-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {t.label}
            {counts[t.key] > 0 ? (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  tab === t.key ? "bg-spark-foreground/20" : "bg-muted"
                }`}
              >
                {counts[t.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Insights */}
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <CollexSpark pose="happy" size="lg" />
          <p className="text-sm text-muted-foreground">CollexSpark sta pensando...</p>
        </div>
      ) : activeCards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16">
          <CollexSpark pose="happy" size="lg" still />
          <p className="text-pretty text-center text-sm text-muted-foreground">
            Nessun consiglio per questa sezione al momento. Torna più tardi!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeCards.map((c) => (
            <InsightCard key={c.id} insight={c} />
          ))}
        </div>
      )}

      {/* Blocco 24 — live wishlist opportunities */}
      {tab === "wishlist" ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Opportunità dalla tua wishlist</h2>
            <Link href="/wishlist" className="text-sm font-medium text-spark hover:underline">
              Gestisci wishlist →
            </Link>
          </div>
          {wishlistOpps === null ? (
            <p className="text-sm text-muted-foreground">Ricerca opportunità in corso...</p>
          ) : wishlistOpps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12">
              <CollexSpark pose="wishlist" size="md" still />
              <p className="text-pretty text-center text-sm text-muted-foreground">
                Nessuna corrispondenza ora. Aggiungi desideri e CollexSpark ti avviserà appena compaiono.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {wishlistOpps.slice(0, 8).map((o, i) => {
                const inner = (
                  <div className="flex h-full items-start gap-3 rounded-xl border border-spark/20 bg-spark-muted/30 p-4">
                    <CollexSpark pose={o.sparkPose} size="sm" still />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{o.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{o.message}</p>
                      {o.price != null ? (
                        <span className="mt-2 inline-block rounded-full bg-spark px-2.5 py-1 text-xs font-semibold text-spark-foreground">
                          {eur(o.price)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
                return (
                  <li key={`${o.type}-${o.itemId}-${i}`}>
                    {o.href ? (
                      <Link href={o.href} className="block transition-opacity hover:opacity-90">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* Marketplace deal lists */}
      {tab === "marketplace" && marketplace && marketplace.underpriced.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Affari sottoprezzo</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {marketplace.underpriced.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link href={`/market/item/${d.id}`} className="truncate text-sm font-medium text-foreground hover:underline">
                    {d.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">Valore equo stimato {eur(d.fair)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {eur(d.price)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Blocco 28 — seller reliability based on reviews */}
      {tab === "marketplace" && reliability && (reliability.trusted.length > 0 || reliability.risky.length > 0) ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <CollexSpark pose="trend" size="sm" still />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Affidabilità venditori</h2>
              <p className="text-sm text-muted-foreground">Basata sulle recensioni ricevute dai venditori.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReliabilityList
              title="Venditori affidabili"
              tone="positive"
              sellers={reliability.trusted}
              empty="Nessun venditore con valutazione alta per ora."
            />
            <ReliabilityList
              title="Attenzione: rating basso"
              tone="negative"
              sellers={reliability.risky}
              empty="Nessun venditore segnalato. Tutto tranquillo!"
            />
          </div>
        </section>
      ) : null}

      {/* Blocco 30 — recommended thematic groups */}
      {tab === "collection" && recommendedGroups.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollexSpark pose="happy" size="sm" still />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Gruppi consigliati</h2>
                <p className="text-sm text-muted-foreground">Community in linea con ciò che collezioni.</p>
              </div>
            </div>
            <Link href="/groups" className="text-sm font-medium text-primary hover:underline">
              Tutti i gruppi →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedGroups.slice(0, 3).map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Blocco 32 — own showcase analysis */}
      {tab === "collection" && showcaseAnalysis ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollexSpark pose="trend" size="sm" still />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Analisi Vetrina</h2>
                <p className="text-sm text-muted-foreground">Come si presenta la tua vetrina pubblica.</p>
              </div>
            </div>
            <Link href="/showcase" className="text-sm font-medium text-primary hover:underline">
              Gestisci →
            </Link>
          </div>
          {showcaseAnalysis.visibility === "disabled" ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">
                La tua vetrina è disattivata. Attivala per mostrare i tuoi pezzi migliori e guadagnare follower.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{showcaseAnalysis.exposedCount}</p>
                  <p className="text-xs text-muted-foreground">Pezzi esposti</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">
                    €{Math.round(showcaseAnalysis.exposedValue).toLocaleString("it-IT")}
                  </p>
                  <p className="text-xs text-muted-foreground">Valore esposto</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{showcaseAnalysis.rareCount}</p>
                  <p className="text-xs text-muted-foreground">Rarità</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{showcaseAnalysis.themes}</p>
                  <p className="text-xs text-muted-foreground">Temi</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {showcaseAnalysis.trendPct >= 0 ? "+" : ""}
                    {showcaseAnalysis.trendPct}%
                  </p>
                  <p className="text-xs text-muted-foreground">Trend</p>
                </div>
              </div>
              {showcaseAnalysis.exposedCount < 3 ? (
                <p className="mt-3 rounded-xl border border-spark/20 bg-spark-muted/30 p-3 text-sm text-foreground">
                  Aggiungi più pezzi in evidenza: le vetrine con almeno 6 oggetti ricevono molti più follower.
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* Blocco 33 — Strategia Boost */}
      {tab === "collection" && boostSuggestions.length ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <CollexSpark pose="deal" size="sm" still />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Strategia Boost</h2>
              <p className="text-sm text-muted-foreground">
                Annunci, aste e scambi che vale la pena mettere in evidenza adesso.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {boostSuggestions.slice(0, 4).map((s) => (
              <div
                key={`${s.targetType}-${s.targetId}`}
                className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30"
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image || "/placeholder.svg"}
                    alt={s.title}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                    {s.hot ? (
                      <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                        Hot
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{s.reason}</p>
                  <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Consigliato: {s.quote.finalPrice} coins · {s.quote.effect.durationHours}h
                  </p>
                </div>
                <BoostButton targetType={s.targetType} targetId={s.targetId} size="sm" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Blocco 34 — Analisi Avanzata */}
      {tab === "collection" && analyticsInsights.length ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CollexSpark pose="trend" size="sm" still />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Analisi Avanzata</h2>
                {analyticsSpark ? (
                  <p className="text-sm text-muted-foreground">{analyticsSpark.message}</p>
                ) : null}
              </div>
            </div>
            <Link
              href="/analytics"
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Dashboard
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {analyticsInsights.map((ins) => {
              const tone =
                ins.severity === "positive"
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : ins.severity === "warning"
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                    : ins.severity === "deal"
                      ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
                      : "border-border bg-card"
              const card = (
                <div className={`flex h-full flex-col rounded-xl border p-3 ${tone}`}>
                  <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ins.message}</p>
                </div>
              )
              return ins.link ? (
                <Link key={ins.id} href={ins.link} className="block">
                  {card}
                </Link>
              ) : (
                <div key={ins.id}>{card}</div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ReliabilityList({
  title,
  tone,
  sellers,
  empty,
}: {
  title: string
  tone: "positive" | "negative"
  sellers: ReliabilitySeller[]
  empty: string
}) {
  const accent =
    tone === "positive"
      ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30"
      : "border-amber-500/30 bg-amber-50 dark:bg-amber-950/30"
  const badge =
    tone === "positive"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  return (
    <div className={`rounded-2xl border p-4 ${accent}`}>
      <div className="mb-3 flex items-center gap-2">
        <CollexSpark pose={tone === "positive" ? "deal" : "alert"} size="sm" still />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {sellers.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sellers.map((s) => (
            <li key={s.userId} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2">
              {s.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.avatar || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {s.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {s.username ? (
                  <Link href={`/reviews/${s.username}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                    {s.name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                )}
                <p className="text-xs text-muted-foreground">{s.count} recensioni</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badge}`}>
                {s.avg}★
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card px-3 py-2 text-center sm:text-left">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground">{value}</p>
    </div>
  )
}
