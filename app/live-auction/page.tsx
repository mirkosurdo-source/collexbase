"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveTimer from "@/components/live/LiveTimer"

type LiveAuctionSummary = {
  id: string
  itemName: string
  image?: string
  currentPrice: number
  bidCount: number
  status: "live" | "ended" | string
  endAt: string
  sellerUsername: string
  isSeller: boolean
}

const EXTEND_OPTIONS = [10, 15, 30]

export default function LiveAuctionsPage() {
  const router = useRouter()
  const [auctions, setAuctions] = useState<LiveAuctionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    itemName: "",
    description: "",
    image: "",
    startPrice: "",
    minIncrement: "1",
    durationMinutes: "5",
    autoExtendSeconds: 10,
  })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const load = useCallback(async () => {
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch("/api/live-auction/list", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setAuctions(data.auctions)
      else setError(data.message || "Impossibile caricare le aste live.")
    } catch {
      setError("Impossibile caricare le aste live.")
    } finally {
      setLoading(false)
    }
  }, [router, token])

  useEffect(() => {
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    if (!form.itemName.trim()) {
      setFormError("Inserisci il nome dell'oggetto.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/live-auction/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemName: form.itemName,
          description: form.description,
          image: form.image,
          startPrice: Number(form.startPrice) || 0,
          minIncrement: Number(form.minIncrement) || 1,
          durationMinutes: Number(form.durationMinutes) || 5,
          autoExtendSeconds: form.autoExtendSeconds,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/live-auction/${data.auction.id}`)
      } else {
        setFormError(data.message || "Impossibile creare l'asta.")
      }
    } catch {
      setFormError("Impossibile creare l'asta.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Aste Live</h1>
            </div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Offerte in tempo reale, countdown e chat dal vivo.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {showForm ? "Chiudi" : "Nuova asta live"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Oggetto *</label>
              <input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Descrizione</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">URL immagine</label>
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Prezzo iniziale (€)</label>
              <input
                inputMode="numeric"
                value={form.startPrice}
                onChange={(e) => setForm({ ...form, startPrice: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Rilancio minimo (€)</label>
              <input
                inputMode="numeric"
                value={form.minIncrement}
                onChange={(e) => setForm({ ...form, minIncrement: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Durata (minuti)</label>
              <input
                inputMode="numeric"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Auto-estensione</label>
              <select
                value={form.autoExtendSeconds}
                onChange={(e) => setForm({ ...form, autoExtendSeconds: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {EXTEND_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    +{o} secondi
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {creating ? "Creazione..." : "Avvia asta live"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
        ) : error ? (
          <p className="mt-12 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : auctions.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna asta live al momento.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => {
              const isLive = a.status === "live"
              return (
                <Link
                  key={a.id}
                  href={`/live-auction/${a.id}`}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image || "/placeholder.svg"} alt={a.itemName} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">Nessuna immagine</div>
                    )}
                    <span
                      className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLive
                          ? "bg-red-600 text-white"
                          : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}
                      {isLive ? "LIVE" : "Terminata"}
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="truncate font-medium text-neutral-900 dark:text-neutral-50">{a.itemName}</h2>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-neutral-400">Prezzo attuale</p>
                        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">€ {a.currentPrice}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">{a.bidCount} offerte</p>
                        {isLive ? (
                          <LiveTimer endAt={a.endAt} className="text-sm text-neutral-700 dark:text-neutral-300" />
                        ) : (
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">Conclusa</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
