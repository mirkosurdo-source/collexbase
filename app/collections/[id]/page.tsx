"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import AICollectionPanel from "@/components/ai-collection-panel"

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

function formatDate(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
}

export default function CollectionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [item, setItem] = useState<CollectionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    if (!token) {
      router.replace("/login")
      return
    }

    async function loadItem() {
      try {
        const res = await fetch(`/api/collections/item?id=${encodeURIComponent(id)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (data.success) {
          setItem(data.item)
        } else {
          setError(data.message || "Oggetto non trovato.")
        }
      } catch {
        setError("Impossibile caricare l'oggetto.")
      } finally {
        setLoading(false)
      }
    }

    loadItem()
  }, [id, router])

  async function handleDelete() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    if (!window.confirm("Sei sicuro di voler eliminare questo oggetto?")) return

    setDeleting(true)
    try {
      const res = await fetch("/api/collections/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()

      if (data.success) {
        router.push("/collections")
      } else {
        setError(data.message || "Impossibile eliminare l'oggetto.")
        setDeleting(false)
      }
    } catch {
      setError("Impossibile eliminare l'oggetto.")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/collections" className="mt-4 inline-block text-sm font-medium underline">
            Torna alle collezioni
          </Link>
        </div>
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/collections" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna alle collezioni
        </Link>

        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image || "/placeholder.svg"} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                Nessuna immagine
              </div>
            )}
          </div>

          <div className="p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                  {item.name}
                </h1>
                {item.category && (
                  <span className="mt-2 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {item.category}
                  </span>
                )}
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {deleting ? "Eliminazione..." : "Elimina"}
              </button>
            </div>

            {item.description && (
              <p className="mt-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{item.description}</p>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Anno</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{item.year ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Valore</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">
                  {item.value != null ? `€ ${item.value}` : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Condizione</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{item.condition || "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Aggiunto il</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{formatDate(item.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6">
          <AICollectionPanel objectId={item._id} hasImage={Boolean(item.image)} />
        </div>
      </div>
    </div>
  )
}
