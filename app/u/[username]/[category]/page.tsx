"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type GalleryItem = {
  id: string
  name: string
  image: string
  rarity: string
  condition: string
  currentValue: number
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

export default function CategoryGalleryPage() {
  const params = useParams<{ username: string; category: string }>()
  const username = params?.username
  const category = params?.category ? decodeURIComponent(params.category) : ""
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!username || !category) return
    async function load() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const res = await fetch(
          `/api/collections/by-category?username=${encodeURIComponent(username)}&category=${encodeURIComponent(category)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        )
        const data = await res.json()
        if (data.success) {
          setItems(data.items || [])
        } else {
          setError(data.message || "Categoria non disponibile.")
        }
      } catch {
        setError("Impossibile caricare la galleria.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [username, category])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="py-10">
      <div className="mb-6 flex flex-col gap-1">
        <Link
          href={`/u/${username}`}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
        >
          ← @{username}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{category}</h1>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun oggetto in questa categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/u/${username}/item/${item.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-neutral-400">
                    {item.name}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.name}</p>
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{item.rarity}</span>
                  <span>{item.condition}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  {formatEUR(item.currentValue)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
