"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type SeriesPoint = { date: string; price: number }
type Stats = {
  min: number
  max: number
  avg: number
  volume: number
  first: number
  last: number
  changePct: number
}
type HistoryResult = {
  cardId: string
  label: string
  range: number
  series: SeriesPoint[]
  stats: Stats
  movingAvg7: SeriesPoint[]
  movingAvg30: SeriesPoint[]
}

const RANGES = [
  { days: 7, label: "7G" },
  { days: 30, label: "30G" },
  { days: 90, label: "90G" },
]

function eur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const t = localStorage.getItem("token")
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function MarketplaceProPanel({
  itemName,
  category,
  listingId,
  currentPrice,
  isOwner,
}: {
  itemName: string
  category: string
  listingId: string
  currentPrice: number
  isOwner: boolean
}) {
  const [range, setRange] = useState(30)
  const [history, setHistory] = useState<HistoryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const cardId = encodeURIComponent(
    itemName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  )

  const loadHistory = useCallback(() => {
    setLoading(true)
    fetch(`/api/marketplace/price-history/${cardId}?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setHistory(d.history)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cardId, range])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Alert form
  const [alertDir, setAlertDir] = useState<"below" | "above">("below")
  const [alertPrice, setAlertPrice] = useState("")
  const [alertMsg, setAlertMsg] = useState("")

  // Auto-offer form
  const [maxOffer, setMaxOffer] = useState("")
  const [increment, setIncrement] = useState("")
  const [autoMsg, setAutoMsg] = useState("")

  async function submitAlert(e: React.FormEvent) {
    e.preventDefault()
    setAlertMsg("")
    const target = Number(alertPrice)
    if (!target || target <= 0) {
      setAlertMsg("Inserisci un prezzo valido.")
      return
    }
    const res = await fetch("/api/marketplace/price-alert/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name: itemName, category, direction: alertDir, targetPrice: target }),
    })
    const d = await res.json()
    setAlertMsg(res.ok && d.success ? "Alert creato! Ti avviseremo." : d.message || "Errore.")
    if (res.ok && d.success) setAlertPrice("")
  }

  async function submitAutoOffer(e: React.FormEvent) {
    e.preventDefault()
    setAutoMsg("")
    const max = Number(maxOffer)
    const inc = Number(increment)
    if (!max || max <= 0 || !inc || inc <= 0) {
      setAutoMsg("Inserisci importi validi.")
      return
    }
    const res = await fetch("/api/marketplace/auto-offer/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ listingId, maxPrice: max, increment: inc }),
    })
    const d = await res.json()
    setAutoMsg(res.ok && d.success ? "Auto-offerta attivata!" : d.message || "Errore.")
    if (res.ok && d.success) {
      setMaxOffer("")
      setIncrement("")
    }
  }

  const hasData = history && history.series.length > 0
  const up = history ? history.stats.changePct >= 0 : true

  // Merge series + moving averages for the chart.
  const chartData = hasData
    ? history!.series.map((p, i) => ({
        date: p.date.slice(5),
        price: p.price,
        ma7: history!.movingAvg7[i]?.price ?? null,
      }))
    : []

  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Andamento prezzo</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRange(r.days)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r.days
                  ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
      ) : !hasData ? (
        <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-6 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          Nessuna vendita registrata per questo oggetto. I dati appariranno dopo le prime transazioni.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{eur(history!.stats.last)}</span>
            <span className={`text-sm font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {up ? "▲" : "▼"} {Math.abs(history!.stats.changePct).toFixed(1)}%
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              min {eur(history!.stats.min)} · max {eur(history!.stats.max)} · media {eur(history!.stats.avg)} · {history!.stats.volume} vendite
            </span>
          </div>

          <div className="mt-3 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={48} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(v) => eur(Number(v))}
                />
                <Area type="monotone" dataKey="price" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#priceFill)" name="Prezzo" />
                <Line type="monotone" dataKey="ma7" stroke="var(--color-chart-2)" strokeWidth={1.5} dot={false} name="Media 7G" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!isOwner && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Price alert */}
          <form onSubmit={submitAlert} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Alert di prezzo</p>
            <div className="mt-2 flex gap-2">
              <select
                value={alertDir}
                onChange={(e) => setAlertDir(e.target.value as "below" | "above")}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <option value="below">Scende sotto</option>
                <option value="above">Sale sopra</option>
              </select>
              <input
                type="number"
                min={1}
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                placeholder="€"
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-50 hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                Crea
              </button>
            </div>
            {alertMsg && <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{alertMsg}</p>}
          </form>

          {/* Auto-offer */}
          <form onSubmit={submitAutoOffer} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Auto-offerta</p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                value={maxOffer}
                onChange={(e) => setMaxOffer(e.target.value)}
                placeholder="Max €"
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <input
                type="number"
                min={1}
                value={increment}
                onChange={(e) => setIncrement(e.target.value)}
                placeholder="Step €"
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-50 hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                Attiva
              </button>
            </div>
            {autoMsg && <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{autoMsg}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
