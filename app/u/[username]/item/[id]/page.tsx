"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import ValueLineChart from "@/components/charts/ValueLineChart"

type Item = {
  id: string
  name: string
  description: string
  category: string
  year: number | null
  image: string
  condition: string
  rarity: string
  series: string
  set: string
  certification: string
  quantity: number
  paidPrice: number
  value: number
  currentValue: number
  forSale: boolean
  forTrade: boolean
  purchaseDate: string | null
  valueHistory: { label: string; value: number }[]
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  )
}

export default function ItemDetailPage() {
  const params = useParams<{ username: string; id: string }>()
  const username = params?.username
  const id = params?.id
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!username || !id) return
    async function load() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const res = await fetch(
          `/api/collections/public-item?username=${encodeURIComponent(username)}&id=${encodeURIComponent(id)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        )
        const data = await res.json()
        if (data.success) {
          setItem(data.item)
        } else {
          setError(data.message || "Oggetto non disponibile.")
        }
      } catch {
        setError("Impossibile caricare l'oggetto.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [username, id])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Oggetto non disponibile."}</p>
      </div>
    )
  }

  const gain = item.currentValue - item.paidPrice
  const gainPct = item.paidPrice > 0 ? (gain / item.paidPrice) * 100 : 0

  return (
    <div className="py-10">
      <Link
        href={`/u/${username}/${encodeURIComponent(item.category)}`}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        ← {item.category}
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="aspect-square w-full">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image || "/placeholder.svg"} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-neutral-400">
                {item.name}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{item.name}</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {item.category}
              {item.year ? ` · ${item.year}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {item.forSale && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                In vendita
              </span>
            )}
            {item.forTrade && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Scambiabile
              </span>
            )}
            {!item.forSale && !item.forTrade && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                Non disponibile
              </span>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400">Valore attuale</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
                  {formatEUR(item.currentValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-neutral-400">Prezzo pagato</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">{formatEUR(item.paidPrice)}</p>
              </div>
            </div>
            <p
              className={`mt-2 text-sm font-medium ${
                gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {gain >= 0 ? "+" : ""}
              {formatEUR(gain)} ({gainPct >= 0 ? "+" : ""}
              {gainPct.toFixed(1)}%)
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Serie" value={item.series} />
            <Detail label="Set" value={item.set} />
            <Detail label="Rarità" value={item.rarity} />
            <Detail label="Condizione" value={item.condition} />
            <Detail label="Certificazione" value={item.certification} />
            <Detail label="Quantità" value={String(item.quantity)} />
            <Detail label="Data acquisto" value={formatDate(item.purchaseDate)} />
          </dl>
        </div>
      </div>

      {/* Value history */}
      <section className="mt-10 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Storico valore</h2>
        <ValueLineChart data={item.valueHistory} />
      </section>

      {/* Description */}
      {item.description && (
        <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Descrizione</h2>
          <p className="text-pretty text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {item.description}
          </p>
        </section>
      )}
    </div>
  )
}
