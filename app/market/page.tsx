"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ListingCard, { type Listing } from "@/components/market/ListingCard"
import { CATEGORIES } from "@/lib/collection-helpers"

const SORTS = [
  { value: "recent", label: "Più recenti" },
  { value: "price_asc", label: "Prezzo crescente" },
  { value: "price_desc", label: "Prezzo decrescente" },
  { value: "popular", label: "Più salvati" },
]

const MODES = [
  { value: "", label: "Tutte le modalità" },
  { value: "trade", label: "Scambio" },
  { value: "item_cash", label: "Oggetto + denaro" },
  { value: "item_coins", label: "Oggetto + monete" },
]

export default function MarketPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [mode, setMode] = useState("")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [sort, setSort] = useState("recent")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (query) params.set("query", query)
    if (category) params.set("category", category)
    if (mode) params.set("mode", mode)
    if (priceMin) params.set("priceMin", priceMin)
    if (priceMax) params.set("priceMax", priceMax)
    params.set("sort", sort)
    params.set("page", String(page))
    return params.toString()
  }, [query, category, mode, priceMin, priceMax, sort, page])

  useEffect(() => {
    if (!token) {
      router.replace("/login")
      return
    }
    let active = true
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/list?${queryString}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!active) return
        if (data.success) {
          setListings(data.listings)
          setTotal(data.total)
          setTotalPages(data.totalPages)
          setError("")
        } else {
          setError(data.message || "Impossibile caricare il marketplace.")
        }
      } catch {
        if (active) setError("Impossibile caricare il marketplace.")
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(handler)
    }
  }, [router, token, queryString])

  const toggleSave = useCallback(
    async (id: string) => {
      if (!token) return
      setListings((prev) => prev.map((l) => (l._id === id ? { ...l, saved: !l.saved } : l)))
      try {
        await fetch("/api/market/save", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ listingId: id }),
        })
      } catch {
        setListings((prev) => prev.map((l) => (l._id === id ? { ...l, saved: !l.saved } : l)))
      }
    },
    [token],
  )

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value)
    setPage(1)
  }

  const inputClass =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Marketplace</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {total} {total === 1 ? "annuncio" : "annunci"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/following"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Seguiti
          </Link>
          <Link
            href="/wishlist"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Wishlist
          </Link>
          <Link
            href="/market/offers"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Offerte
          </Link>
          <Link
            href="/market/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Vendi
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={query}
          onChange={(e) => updateFilter(setQuery, e.target.value)}
          placeholder="Cerca annunci..."
          className={`${inputClass} sm:col-span-2 lg:col-span-2`}
        />
        <select value={category} onChange={(e) => updateFilter(setCategory, e.target.value)} className={inputClass}>
          <option value="">Tutte le categorie</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={mode} onChange={(e) => updateFilter(setMode, e.target.value)} className={inputClass}>
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={priceMin}
          onChange={(e) => updateFilter(setPriceMin, e.target.value)}
          placeholder="Prezzo min €"
          className={inputClass}
        />
        <input
          type="number"
          value={priceMax}
          onChange={(e) => updateFilter(setPriceMax, e.target.value)}
          placeholder="Prezzo max €"
          className={inputClass}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} lg:col-span-2`}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      ) : listings.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun annuncio trovato.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l._id} listing={l} onToggleSave={toggleSave} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Precedente
              </button>
              <span className="px-2 text-sm text-neutral-500 dark:text-neutral-400">
                Pagina {page} di {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Successiva
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
