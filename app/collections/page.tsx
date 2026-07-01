"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import CollectionFilters, { DEFAULT_FILTERS, type Filters } from "./CollectionFilters"

type CollectionItem = {
  _id: string
  name: string
  description?: string
  category?: string
  year?: number | null
  value?: number | null
  condition?: string
  image?: string
  createdAt?: string
}

export default function CollectionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Reset to first page whenever a filter (other than the page itself) changes
  function updateFilters(next: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...next }))
    setPage(1)
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  // Build a stable query string from the active filters + page
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.query) params.set("query", filters.query)
    if (filters.category) params.set("category", filters.category)
    if (filters.condition) params.set("condition", filters.condition)
    if (filters.yearMin) params.set("yearMin", filters.yearMin)
    if (filters.yearMax) params.set("yearMax", filters.yearMax)
    if (filters.valueMin) params.set("valueMin", filters.valueMin)
    if (filters.valueMax) params.set("valueMax", filters.valueMax)
    if (filters.sort) params.set("sort", filters.sort)
    params.set("page", String(page))
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    if (!token) {
      router.replace("/login")
      return
    }

    let active = true
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/collections/search?${queryString}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!active) return

        if (data.success) {
          setItems(data.items)
          setTotal(data.total)
          setTotalPages(data.totalPages)
          setError("")
        } else {
          setError(data.message || "Impossibile caricare le collezioni.")
        }
      } catch {
        if (active) setError("Impossibile caricare le collezioni.")
      } finally {
        if (active) setLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(handler)
    }
  }, [router, queryString])

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Le mie collezioni
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {total} {total === 1 ? "oggetto" : "oggetti"}
            </p>
          </div>
          <Link
            href="/collections/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Aggiungi oggetto
          </Link>
        </div>

        <CollectionFilters filters={filters} onChange={updateFilters} onReset={resetFilters} />

        {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {loading ? (
          <p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
        ) : items.length === 0 && !error ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nessun oggetto corrisponde ai criteri di ricerca.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item._id}
                  href={`/collections/${item._id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
                >
                  <div className="aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                        Nessuna immagine
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="font-medium text-neutral-900 dark:text-neutral-50">{item.name}</h2>
                    {item.category && (
                      <span className="mt-1 inline-block w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {item.category}
                      </span>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                      <span>{item.year ?? "—"}</span>
                      <span>{item.value != null ? `€ ${item.value}` : "—"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
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
    </div>
  )
}
