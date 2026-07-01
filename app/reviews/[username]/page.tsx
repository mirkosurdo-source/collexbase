"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Star, ShoppingBag, Repeat, Users } from "lucide-react"
import StarRating from "@/components/community/StarRating"
import ReputationBadge from "@/components/community/ReputationBadge"
import ReputationChart from "@/components/community/ReputationChart"
import { timeAgo } from "@/lib/format"

interface Reputation {
  score: number
  tier: string
  avgRating: number
  reviewCount: number
  salesCount: number
  tradesCount: number
  communityPoints: number
  history: { label: string; value: number }[]
}

interface ProfileUser {
  id: string
  username: string
  name: string
  avatar: string
  bio: string
  memberSince: string
}

interface ReviewItem {
  _id: string
  authorUsername: string
  authorAvatar: string
  type: "seller" | "buyer" | "trade"
  rating: number
  comment: string
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = { seller: "Venditore", buyer: "Acquirente", trade: "Scambio" }
const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "seller", label: "Vendite" },
  { key: "buyer", label: "Acquisti" },
  { key: "trade", label: "Scambi" },
]

export default function ReviewsPage() {
  const params = useParams<{ username: string }>()
  const username = params?.username

  const [token, setToken] = useState<string | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [rep, setRep] = useState<Reputation | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Review form state.
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<"seller" | "buyer" | "trade">("seller")
  const [formRating, setFormRating] = useState(5)
  const [formComment, setFormComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    const t = localStorage.getItem("token")
    setToken(t)
    if (t) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setMe(d.user.username)
        })
        .catch(() => {})
    }
  }, [])

  const loadReputation = useCallback(async () => {
    if (!username) return
    try {
      const res = await fetch(`/api/reputation?username=${encodeURIComponent(username)}`)
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setRep(data.reputation)
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    }
  }, [username])

  const loadReviews = useCallback(async () => {
    if (!username) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ username, type: filter, page: String(page) })
      const res = await fetch(`/api/reviews/list?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setReviews(data.reviews || [])
        setTotalPages(data.totalPages || 1)
      }
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [username, filter, page])

  useEffect(() => {
    loadReputation()
  }, [loadReputation])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  useEffect(() => {
    setPage(1)
  }, [filter])

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!token || submitting) return
    setSubmitting(true)
    setFormError("")
    try {
      const res = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: username, type: formType, rating: formRating, comment: formComment }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowForm(false)
        setFormComment("")
        setFormRating(5)
        if (data.reputation) setRep(data.reputation)
        loadReviews()
      } else {
        setFormError(data.error || "Invio recensione fallito.")
      }
    } catch {
      setFormError("Errore di rete.")
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Utente non trovato.</p>
        <Link href="/community" className="mt-4 inline-block text-primary hover:underline">
          Vai alla community
        </Link>
      </div>
    )
  }

  if (!user || !rep) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  const isSelf = me === user.username
  const stats = [
    { icon: Star, label: "Valutazione media", value: `${rep.avgRating || 0}/5`, sub: `${rep.reviewCount} recensioni` },
    { icon: ShoppingBag, label: "Vendite", value: String(rep.salesCount), sub: "completate" },
    { icon: Repeat, label: "Scambi", value: String(rep.tradesCount), sub: "completati" },
    { icon: Users, label: "Community", value: String(rep.communityPoints), sub: "punti attività" },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Profile + reputation header */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/u/${user.username}`} className="shrink-0">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar || "/placeholder.svg"} alt={user.username} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
                {user.username.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{user.name || user.username}</h1>
              <ReputationBadge tier={rep.tier} score={rep.score} showScore />
            </div>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            {user.bio ? <p className="mt-1 text-sm text-foreground/80">{user.bio}</p> : null}
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{rep.score}</p>
            <p className="text-xs text-muted-foreground">su 100</p>
          </div>
        </div>

        {!isSelf && token ? (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {showForm ? "Annulla" : "Lascia una recensione"}
          </button>
        ) : null}

        {showForm ? (
          <form onSubmit={submitReview} className="mt-4 rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
                <div className="flex gap-2">
                  {(["seller", "buyer", "trade"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={`rounded-lg border px-3 py-1 text-sm transition-colors ${
                        formType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Valutazione</label>
                <StarRating value={formRating} onChange={setFormRating} size={24} />
              </div>
            </div>
            <textarea
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              rows={3}
              placeholder="Descrivi la tua esperienza..."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {formError ? <p className="mt-2 text-sm text-destructive">{formError}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 width={15} height={15} className="animate-spin" /> : null}
              Invia recensione
            </button>
          </form>
        ) : null}
      </section>

      {/* Stat breakdown */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon width={18} height={18} className="text-primary" />
            <p className="mt-2 text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </section>

      {/* History chart */}
      {rep.history.length > 1 ? (
        <section className="mt-5 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Andamento reputazione</h2>
          <ReputationChart data={rep.history} />
        </section>
      ) : null}

      {/* Reviews list */}
      <section className="mt-6">
        <div className="mb-4 flex items-center gap-2 border-b border-border">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                filter === f.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nessuna recensione.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r._id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Link href={`/u/${r.authorUsername}`} className="shrink-0">
                    {r.authorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.authorAvatar || "/placeholder.svg"} alt={r.authorUsername} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {r.authorUsername.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${r.authorUsername}`} className="text-sm font-medium text-foreground hover:underline">
                      {r.authorUsername}
                    </Link>
                    <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StarRating value={r.rating} size={14} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{TYPE_LABELS[r.type]}</span>
                  </div>
                </div>
                {r.comment ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{r.comment}</p> : null}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Precedente
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Successiva
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
