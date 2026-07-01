"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Countdown from "./Countdown"

type AuctionSummary = {
  _id: string
  itemName: string
  image?: string
  currentPrice: number
  bidCount: number
  endsAt: string
}

export default function AuctionsPage() {
  const router = useRouter()
  const [auctions, setAuctions] = useState<AuctionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    async function load() {
      try {
        const res = await fetch("/api/auctions/list", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success) {
          setAuctions(data.auctions)
        } else {
          setError(data.message || "Impossibile caricare le aste.")
        }
      } catch {
        setError("Impossibile caricare le aste.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Aste attive</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Fai offerte sugli oggetti messi all&apos;asta dalla community.
            </p>
          </div>
          <Link
            href="/auctions/new"
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Nuova asta
          </Link>
        </div>

        {loading ? (
          <p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
        ) : error ? (
          <p className="mt-12 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : auctions.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna asta attiva al momento.</p>
            <Link href="/auctions/new" className="mt-4 inline-block text-sm font-medium underline">
              Crea la prima asta
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => (
              <Link
                key={a._id}
                href={`/auctions/${a._id}`}
                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image || "/placeholder.svg"}
                      alt={a.itemName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                      Nessuna immagine
                    </div>
                  )}
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
                      <Countdown
                        endsAt={a.endsAt}
                        className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
