"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"
import MessageUserButton from "@/components/chat/MessageUserButton"

type PreviewItem = {
  id: string
  name: string
  image: string
  currentValue: number
}

type Category = {
  category: string
  count: number
  value: number
  preview: PreviewItem[]
}

type PublicProfile = {
  id: string
  name: string
  username: string
  bio: string
  avatar: string
  badge: string
  isOwner: boolean
}

function formatEUR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>()
  const username = params?.username
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalValue, setTotalValue] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!username) return
    async function load() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const res = await fetch(`/api/profile/public?username=${encodeURIComponent(username)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        if (data.success) {
          setProfile(data.profile)
          setCategories(data.categories || [])
          setTotalItems(data.totalItems || 0)
          setTotalValue(data.totalValue)
          setHidden(Boolean(data.hidden))
        } else {
          setError(data.message || "Profilo non trovato.")
        }
      } catch {
        setError("Impossibile caricare il profilo.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [username])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Profilo non disponibile."}</p>
      </div>
    )
  }

  return (
    <div className="py-10">
      {/* Profile header */}
      <header className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar || "/placeholder.svg"}
            alt={`Avatar di ${profile.name}`}
            className="h-28 w-28 rounded-full object-cover ring-2 ring-neutral-200 dark:ring-neutral-800"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-200 text-4xl font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {profile.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {profile.name}
            </h1>
            <Badge tier={profile.badge} />
            {profile.isOwner && (
              <Link
                href="/profile/edit"
                className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Modifica profilo
              </Link>
            )}
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">@{profile.username}</p>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/profile/${profile.username}`}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Profilo avanzato
            </Link>
            <Link
              href={`/reviews/${profile.username}`}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Reputazione e recensioni
            </Link>
            {!profile.isOwner && <MessageUserButton targetUserId={profile.id} label="Invia messaggio" />}
          </div>

          <div className="flex gap-8">
            <div className="text-center sm:text-left">
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{totalItems}</p>
              <p className="text-xs uppercase tracking-wide text-neutral-400">Oggetti</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{formatEUR(totalValue)}</p>
              <p className="text-xs uppercase tracking-wide text-neutral-400">Valore collezione</p>
            </div>
          </div>

          {profile.bio && (
            <p className="max-w-prose text-pretty text-center text-sm text-neutral-700 dark:text-neutral-300 sm:text-left">
              {profile.bio}
            </p>
          )}
        </div>
      </header>

      <div className="my-8 border-t border-neutral-200 dark:border-neutral-800" />

      {hidden ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Questo profilo è privato</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            La collezione non è visibile pubblicamente.
          </p>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun oggetto nella collezione.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {categories.map((cat) => (
            <section key={cat.category}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{cat.category}</h2>
                  <span className="text-xs text-neutral-400">
                    {cat.count} {cat.count === 1 ? "oggetto" : "oggetti"} · {formatEUR(cat.value)}
                  </span>
                </div>
                <Link
                  href={`/u/${profile.username}/${encodeURIComponent(cat.category)}`}
                  className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300"
                >
                  Vedi tutto
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 md:grid-cols-6">
                {cat.preview.map((item) => (
                  <Link
                    key={item.id}
                    href={`/u/${profile.username}/item/${item.id}`}
                    className="group relative aspect-square overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900"
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-neutral-400">
                        {item.name}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
