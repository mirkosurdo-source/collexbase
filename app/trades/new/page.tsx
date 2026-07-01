"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Item = {
  _id: string
  name: string
  category?: string
  image?: string
  userId: string
}

function ItemPicker({
  items,
  selectedId,
  onSelect,
  emptyText,
}: {
  items: Item[]
  selectedId: string
  onSelect: (id: string) => void
  emptyText: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</p>
  }
  return (
    <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
      {items.map((item) => {
        const selected = item._id === selectedId
        return (
          <button
            key={item._id}
            type="button"
            onClick={() => onSelect(item._id)}
            className={`flex flex-col overflow-hidden rounded-lg border text-left transition-colors ${
              selected
                ? "border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100"
                : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            }`}
          >
            <div className="aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image || "/placeholder.svg"} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                  Nessuna immagine
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">{item.name}</p>
              {item.category && <p className="truncate text-xs text-neutral-400">{item.category}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function NewTradePage() {
  const router = useRouter()
  const [myItems, setMyItems] = useState<Item[]>([])
  const [otherItems, setOtherItems] = useState<Item[]>([])
  const [offeredItemId, setOfferedItemId] = useState("")
  const [requestedItemId, setRequestedItemId] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const [mineRes, othersRes] = await Promise.all([
        fetch("/api/collections/list", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/collections/browse", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const mineData = await mineRes.json()
      const othersData = await othersRes.json()
      if (mineData.success) setMyItems(mineData.items || [])
      if (othersData.success) setOtherItems(othersData.items || [])
      if (!mineData.success && !othersData.success) {
        setError("Impossibile caricare gli oggetti.")
      }
    } catch {
      setError("Impossibile caricare gli oggetti.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")

    if (!offeredItemId) {
      setFormError("Seleziona un oggetto da offrire.")
      return
    }
    if (!requestedItemId) {
      setFormError("Seleziona un oggetto da richiedere.")
      return
    }
    if (message.length > 1000) {
      setFormError("Il messaggio è troppo lungo.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/trades/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offeredItemId, requestedItemId, message: message.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/trades/${data.trade._id}`)
      } else {
        setFormError(data.message || "Impossibile inviare la proposta.")
      }
    } catch {
      setFormError("Impossibile inviare la proposta.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/trades" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna agli scambi
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Nuova proposta di scambio
        </h1>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Oggetto offerto</h2>
            <ItemPicker
              items={myItems}
              selectedId={offeredItemId}
              onSelect={setOfferedItemId}
              emptyText="Non hai oggetti nella tua collezione. Aggiungine uno prima di proporre uno scambio."
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Oggetto richiesto</h2>
            <ItemPicker
              items={otherItems}
              selectedId={requestedItemId}
              onSelect={setRequestedItemId}
              emptyText="Nessun oggetto disponibile da altri utenti."
            />
          </section>

          <section>
            <label htmlFor="message" className="mb-2 block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Messaggio (opzionale)
            </label>
            <textarea
              id="message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Aggiungi un messaggio alla tua proposta..."
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </section>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {submitting ? "Invio..." : "Invia proposta"}
            </button>
            <Link
              href="/trades"
              className="rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
