"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"
import WishlistPriceTrend from "@/components/wishlist/WishlistPriceTrend"
import { CATEGORIES } from "@/lib/collection-helpers"

const CONDITIONS = ["Accettabile", "Buono", "Ottimo", "Come nuovo", "Nuovo"]
const RARITIES = ["Comune", "Non comune", "Rara", "Epica", "Leggendaria", "Ultra Rara"]

interface WishlistItem {
  id: string
  itemName: string
  category: string
  series: string | null
  set: string | null
  rarity: string | null
  number: string | null
  minCondition: string | null
  maxPrice: number | null
}

type OppType = "marketplace" | "trade" | "auction" | "price-drop" | "new-listing" | "rare"

interface Opportunity {
  type: OppType
  itemId: string
  listingId: string | null
  href: string | null
  price: number | null
  title: string
  message: string
  sparkPose: "wishlist" | "deal" | "alert"
}

interface CheckResult {
  itemId: string
  itemName: string
  category: string
  maxPrice: number | null
  opportunities: Opportunity[]
  bestPrice: number | null
  priceTrend: { label: string; value: number }[]
}

const OPP_LABEL: Record<OppType, string> = {
  marketplace: "Disponibile",
  trade: "In scambio",
  auction: "In asta",
  "price-drop": "Prezzo basso",
  "new-listing": "Nuovo annuncio",
  rare: "Raro",
}

const OPP_TONE: Record<OppType, string> = {
  marketplace: "bg-spark/15 text-spark",
  trade: "bg-accent text-accent-foreground",
  auction: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "price-drop": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "new-listing": "bg-spark/15 text-spark",
  rare: "bg-destructive/10 text-destructive",
}

function eur(n: number): string {
  return `€ ${Math.round(n).toLocaleString("it-IT")}`
}

const EMPTY_FORM = {
  itemName: "",
  category: "",
  series: "",
  set: "",
  rarity: "",
  number: "",
  minCondition: "",
  maxPrice: "",
}

export default function WishlistClient() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [items, setItems] = useState<WishlistItem[]>([])
  const [results, setResults] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login?redirect=/wishlist")
      return
    }
    setToken(t)
  }, [router])

  const loadItems = useCallback(async (authToken: string) => {
    const res = await fetch("/api/wishlist", { headers: { Authorization: `Bearer ${authToken}` } })
    if (res.status === 401) {
      router.replace("/login?redirect=/wishlist")
      return
    }
    const data = await res.json()
    if (res.ok) setItems(data.items || [])
    setLoading(false)
  }, [router])

  const scan = useCallback(
    async (authToken: string, notify = false) => {
      setScanning(true)
      try {
        const res = await fetch(`/api/wishlist/check${notify ? "?notify=1" : ""}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const data = await res.json()
        if (res.ok) setResults(data.results || [])
      } catch {
        // ignore — opportunities are best-effort
      } finally {
        setScanning(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!token) return
    loadItems(token)
    scan(token)
  }, [token, loadItems, scan])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.itemName.trim()) {
      setError("Inserisci il nome dell'oggetto.")
      return
    }
    if (!token) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/wishlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemName: form.itemName.trim(),
          category: form.category || undefined,
          series: form.series || undefined,
          set: form.set || undefined,
          rarity: form.rarity || undefined,
          number: form.number || undefined,
          minCondition: form.minCondition || undefined,
          maxPrice: form.maxPrice ? Number(form.maxPrice) : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setItems(data.items || [])
        setForm({ ...EMPTY_FORM })
        scan(token)
      } else {
        setError(data.message || "Operazione non riuscita.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!token) return
    const res = await fetch(`/api/wishlist/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setResults((prev) => prev.filter((r) => r.itemId !== id))
    }
  }

  const resultsByItem = useMemo(() => {
    const map = new Map<string, CheckResult>()
    for (const r of results) map.set(r.itemId, r)
    return map
  }, [results])

  const totalOpportunities = useMemo(
    () => results.reduce((sum, r) => sum + r.opportunities.length, 0),
    [results],
  )

  const headline = useMemo<{ pose: SparkPose; message: string }>(() => {
    if (scanning) return { pose: "wishlist", message: "Sto cercando i tuoi oggetti su marketplace, scambi e aste..." }
    if (totalOpportunities === 0)
      return {
        pose: "happy",
        message: "Aggiungi oggetti desiderati: ti avviserò appena compaiono occasioni!",
      }
    return {
      pose: "deal",
      message: `Ho trovato ${totalOpportunities} ${totalOpportunities === 1 ? "opportunità" : "opportunità"} per la tua wishlist!`,
    }
  }, [scanning, totalOpportunities])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <section className="mb-8 flex flex-col items-center gap-6 rounded-2xl border border-spark/20 bg-spark-muted/40 p-6 sm:flex-row sm:p-8">
        <CollexSpark pose={headline.pose} size="xl" message={headline.message} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-spark">CollexSpark · Wishlist Intelligente</p>
          <h1 className="mt-1 text-balance text-2xl font-bold text-foreground sm:text-3xl">
            La tua lista dei desideri, monitorata dall&apos;AI
          </h1>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            CollexSpark controlla marketplace, scambi e aste e ti segnala disponibilità, cali di prezzo e occasioni
            rare.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
            <button
              type="button"
              onClick={() => token && scan(token, true)}
              disabled={scanning || !token}
              className="rounded-full bg-spark px-4 py-2 text-sm font-semibold text-spark-foreground hover:opacity-90 disabled:opacity-50"
            >
              {scanning ? "Scansione..." : "Cerca opportunità e avvisami"}
            </button>
            <Link
              href="/advisor"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Apri AI Advisor
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Left: add form + entries */}
        <div>
          <form onSubmit={add} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Aggiungi un desiderio</h2>
            <div className="flex flex-col gap-3">
              <Field label="Nome oggetto *">
                <input
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  placeholder="es. Charizard 1st Edition"
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input"
                  >
                    <option value="">Tutte</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rarità">
                  <select
                    value={form.rarity}
                    onChange={(e) => setForm({ ...form, rarity: e.target.value })}
                    className="input"
                  >
                    <option value="">Qualsiasi</option>
                    {RARITIES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Serie">
                  <input
                    value={form.series}
                    onChange={(e) => setForm({ ...form, series: e.target.value })}
                    placeholder="es. Base Set"
                    className="input"
                  />
                </Field>
                <Field label="Set">
                  <input
                    value={form.set}
                    onChange={(e) => setForm({ ...form, set: e.target.value })}
                    placeholder="es. Wizards"
                    className="input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numero">
                  <input
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    placeholder="es. 4/102"
                    className="input"
                  />
                </Field>
                <Field label="Condizione minima">
                  <select
                    value={form.minCondition}
                    onChange={(e) => setForm({ ...form, minCondition: e.target.value })}
                    className="input"
                  >
                    <option value="">Qualsiasi</option>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Prezzo massimo (€)">
                <input
                  type="number"
                  min="0"
                  value={form.maxPrice}
                  onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                  placeholder="Nessun limite"
                  className="input"
                />
              </Field>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Aggiunta..." : "Aggiungi alla wishlist"}
            </button>
          </form>

          <h2 className="mb-3 mt-6 text-lg font-semibold text-foreground">
            I tuoi desideri {items.length > 0 ? `(${items.length})` : ""}
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              La tua wishlist è vuota.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const opps = resultsByItem.get(item.id)?.opportunities.length || 0
                return (
                  <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.itemName}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.category && <Tag>{item.category}</Tag>}
                          {item.rarity && <Tag>{item.rarity}</Tag>}
                          {item.series && <Tag>{item.series}</Tag>}
                          {item.number && <Tag>{`#${item.number}`}</Tag>}
                          {item.minCondition && <Tag>{`min ${item.minCondition}`}</Tag>}
                          {item.maxPrice != null && <Tag>{`max ${eur(item.maxPrice)}`}</Tag>}
                        </div>
                        {opps > 0 && (
                          <p className="mt-2 text-xs font-medium text-spark">{`${opps} opportunità trovate`}</p>
                        )}
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="shrink-0 text-sm text-muted-foreground hover:text-destructive"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Right: AI opportunities */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <CollexSpark pose="deal" size="sm" still />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Opportunità AI</h2>
              <p className="text-sm text-muted-foreground">Match in tempo reale da marketplace, scambi e aste.</p>
            </div>
          </div>

          {scanning && results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16">
              <CollexSpark pose="wishlist" size="lg" />
              <p className="text-sm text-muted-foreground">CollexSpark sta cercando occasioni...</p>
            </div>
          ) : totalOpportunities === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16">
              <CollexSpark pose="happy" size="lg" still />
              <p className="text-pretty px-6 text-center text-sm text-muted-foreground">
                Nessuna opportunità al momento. Appena un oggetto della tua wishlist sarà disponibile, te lo segnalerò
                qui e con una notifica.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {results
                .filter((r) => r.opportunities.length > 0)
                .map((r) => (
                  <section key={r.itemId} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-card-foreground">{r.itemName}</h3>
                      {r.bestPrice != null && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {`da ${eur(r.bestPrice)}`}
                        </span>
                      )}
                    </div>

                    {r.priceTrend.length > 0 && (
                      <div className="mb-3">
                        <WishlistPriceTrend data={r.priceTrend} />
                      </div>
                    )}

                    <ul className="flex flex-col gap-2">
                      {r.opportunities.map((op, idx) => {
                        const inner = (
                          <div className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                            <CollexSpark pose={op.sparkPose} size="sm" still />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OPP_TONE[op.type]}`}>
                                  {OPP_LABEL[op.type]}
                                </span>
                                {op.price != null && (
                                  <span className="text-sm font-semibold text-foreground">{eur(op.price)}</span>
                                )}
                              </div>
                              <p className="mt-1 text-pretty text-sm text-muted-foreground">{op.message}</p>
                            </div>
                          </div>
                        )
                        return (
                          <li key={`${op.type}-${op.listingId}-${idx}`}>
                            {op.href ? <Link href={op.href}>{inner}</Link> : inner}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid var(--input);
          background: var(--background);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
        }
        :global(.input:focus) {
          box-shadow: 0 0 0 2px var(--ring);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  )
}
