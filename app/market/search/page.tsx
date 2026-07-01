"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Listing = {
  _id: string
  itemName: string
  category: string
  condition: string
  rarity: string
  price: number
  image: string
  sellerUsername: string
  isPro: boolean
  sellerScore: number
  sellerTier: string
}

const CATEGORIES = ["", "Carte", "Figurine", "Fumetti", "Monete", "Francobolli", "Altro"]
const CONDITIONS = ["Mint", "Near Mint", "Excellent", "Good", "Played"]
const SORTS = [
  { value: "recent", label: "Più recenti" },
  { value: "price_asc", label: "Prezzo crescente" },
  { value: "price_desc", label: "Prezzo decrescente" },
  { value: "popular", label: "Più salvati" },
  { value: "trending", label: "Di tendenza" },
  { value: "best_seller", label: "Miglior venditore" },
]

function eur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

export default function MarketSearchPage() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [conditions, setConditions] = useState<string[]>([])
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [sellerType, setSellerType] = useState("")
  const [minRanking, setMinRanking] = useState(0)
  const [freeShipping, setFreeShipping] = useState(false)
  const [sort, setSort] = useState("recent")
  const [page, setPage] = useState(1)

  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const search = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set("query", query)
    if (category) params.set("category", category)
    if (conditions.length) params.set("condition", conditions.join(","))
    if (priceMin) params.set("priceMin", priceMin)
    if (priceMax) params.set("priceMax", priceMax)
    if (sellerType) params.set("sellerType", sellerType)
    if (minRanking > 0) params.set("minRanking", String(minRanking))
    if (freeShipping) params.set("freeShipping", "1")
    params.set("sort", sort)
    params.set("page", String(page))
    fetch(`/api/marketplace/search?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) {
          setListings(d.listings)
          setTotal(d.total)
          setTotalPages(d.totalPages)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query, category, conditions, priceMin, priceMax, sellerType, minRanking, freeShipping, sort, page])

  useEffect(() => {
    search()
  }, [search])

  function toggleCondition(c: string) {
    setPage(1)
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Ricerca avanzata</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Filtra per venditore Pro, ranking e tendenze di mercato.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Cerca</label>
            <input
              value={query}
              onChange={(e) => {
                setPage(1)
                setQuery(e.target.value)
              }}
              placeholder="Nome oggetto…"
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Categoria</label>
            <select
              value={category}
              onChange={(e) => {
                setPage(1)
                setCategory(e.target.value)
              }}
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c || "Tutte"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Prezzo</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="number"
                value={priceMin}
                onChange={(e) => {
                  setPage(1)
                  setPriceMin(e.target.value)
                }}
                placeholder="Min"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <input
                type="number"
                value={priceMax}
                onChange={(e) => {
                  setPage(1)
                  setPriceMax(e.target.value)
                }}
                placeholder="Max"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Condizione</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCondition(c)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    conditions.includes(c)
                      ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Venditore</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { v: "", l: "Tutti" },
                { v: "pro", l: "Solo Pro" },
                { v: "normal", l: "Privati" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => {
                    setPage(1)
                    setSellerType(o.v)
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    sellerType === o.v
                      ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Ranking minimo: {minRanking}
            </label>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minRanking}
              onChange={(e) => {
                setPage(1)
                setMinRanking(Number(e.target.value))
              }}
              className="mt-1.5 w-full accent-neutral-900 dark:accent-neutral-100"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={freeShipping}
              onChange={(e) => {
                setPage(1)
                setFreeShipping(e.target.checked)
              }}
              className="accent-neutral-900 dark:accent-neutral-100"
            />
            Spedizione gratuita (Pro)
          </label>
        </aside>

        {/* Results */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{total} risultati</p>
            <select
              value={sort}
              onChange={(e) => {
                setPage(1)
                setSort(e.target.value)
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              Nessun risultato. Prova a modificare i filtri.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {listings.map((l) => (
                <Link
                  key={l._id}
                  href={`/market/item/${l._id}`}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.image || "/placeholder.svg"}
                      alt={l.itemName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5">
                      {l.isPro && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          PRO
                        </span>
                      )}
                      {l.sellerTier && (
                        <span className="truncate text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                          {l.sellerTier}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">{l.itemName}</p>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{eur(l.price)}</p>
                    <p className="truncate text-xs text-neutral-400">@{l.sellerUsername}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300"
              >
                Precedente
              </button>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300"
              >
                Successiva
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
