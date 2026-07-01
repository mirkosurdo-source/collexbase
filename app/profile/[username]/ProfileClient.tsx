"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"
import TrendChart from "@/components/advisor/TrendChart"
import StarRating from "@/components/community/StarRating"
import MessageUserButton from "@/components/chat/MessageUserButton"
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard"

/* ------------------------------- types ---------------------------------- */

interface BadgeItem {
  id: string
  group: string
  label: string
  description: string
  threshold: number
  accent: string
  earned: boolean
  progress: number
}
interface Highlight {
  id: string
  name: string
  image: string
  category: string
  rarity: string
  currentValue: number
}
interface ActivityItem {
  type: string
  label: string
  detail: string
  at: string
}
interface ProfileData {
  profile: {
    id: string
    name: string
    username: string
    bio: string
    avatar: string
    badge: string
    isOwner: boolean
    createdAt: string
  }
  level: { level: number; name: string; min: number; next: number | null }
  reputation: {
    score: number
    tier: string
    avgRating: number
    reviewCount: number
    history: { label: string; value: number }[]
  }
  stats: {
    items: number
    sales: number
    trades: number
    auctionsWon: number
    likesReceived: number
    posts: number
    aiEvaluations: number
    wishlistItems: number
    coinsPurchased: number
    followers: number
    following: number
    comments: number
    collectionValue: number
  }
  badges: BadgeItem[]
  earnedBadgeCount: number
  totalBadgeCount: number
  groupMeta: Record<string, { title: string; pose: string }>
  activity: ActivityItem[]
  collection: { visible: boolean; value: number; topValued: Highlight[]; rarest: Highlight[]; duplicates: number }
  reviews: {
    summary: {
      total: number
      avg: number
      distribution: Record<string, number>
      breakdown: Record<"seller" | "buyer" | "trade", { count: number; avg: number }>
      trustBadges: { id: string; label: string; earned: boolean }[]
    }
    recent: {
      _id: string
      authorUsername: string
      authorAvatar: string
      type: "seller" | "buyer" | "trade"
      rating: number
      comment: string
      createdAt: string
    }[]
  }
  advice: { pose: string; message: string }[]
  chat?: {
    conversations: number
    messagesSent: number
    mostContacted: { userId: string; username: string; avatar: string; messages: number }[]
    advice: { pose: string; message: string }[]
  }
  groups?: {
    stats: { joined: number; administered: number; totalPosts: number; totalMessages: number }
    list: { id: string; name: string; category: string; coverImage: string; memberCount: number; role: string }[]
  }
  showcase?: {
    title: string
    theme: string
    visibility: "public" | "private" | "disabled"
    followerCount: number
    exposedCount: number
    exposedValue: number
    rareCount: number
    trendPct: number
  } | null
  boost?: {
    activeCount: number
    active: {
      id: string
      targetType: "marketplace" | "auction" | "trade" | "showcase"
      tier: string
      label: string
      visibilityPct: number
      remainingMs: number
    }[]
    totalCoinsSpent: number
    counts: {
      boostMarketplaceCount: number
      boostAuctionCount: number
      boostTradeCount: number
      boostShowcaseCount: number
    }
  } | null
}

/* ------------------------------ helpers ---------------------------------- */

function eur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}g fa`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h fa`
  const mins = Math.floor(diff / 60000)
  return mins > 0 ? `${mins}m fa` : "ora"
}

const ACTIVITY_DOT: Record<string, string> = {
  item: "bg-emerald-500",
  sale: "bg-amber-500",
  trade: "bg-sky-500",
  auction: "bg-violet-500",
  post: "bg-primary",
  comment: "bg-muted-foreground",
}

/* --------------------------- small components ---------------------------- */

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/* ------------------------------- page ------------------------------------ */

export default function ProfileClient({ username }: { username: string }) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    fetch(`/api/profile/${encodeURIComponent(username)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d)
        else setError(d.message || "Profilo non trovato.")
      })
      .catch(() => setError("Impossibile caricare il profilo."))
      .finally(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Caricamento profilo...</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-destructive">{error || "Profilo non disponibile."}</p>
      </div>
    )
  }

  const {
    profile,
    level,
    reputation,
    stats,
    badges,
    activity,
    collection,
    advice,
    groupMeta,
    reviews,
    chat,
    groups,
    showcase,
    boost,
  } = data
  const reviewSummary = reviews?.summary
  const TYPE_LABEL: Record<string, string> = { seller: "Venditore", buyer: "Acquirente", trade: "Scambio" }
  const nextThreshold = level.next
  const levelProgress = nextThreshold ? Math.min(100, Math.round((reputation.score / nextThreshold) * 100)) : 100

  // Group badges by group for the achievements grid.
  const grouped = badges.reduce<Record<string, BadgeItem[]>>((acc, b) => {
    ;(acc[b.group] ||= []).push(b)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-5xl py-8">
      {/* ----------------------------- header ----------------------------- */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar || "/placeholder.svg"}
            alt={`Avatar di ${profile.name}`}
            className="h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
            {profile.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{profile.name}</h1>
            <span className="rounded-full bg-spark px-2.5 py-1 text-xs font-semibold text-spark-foreground">
              Lv.{level.level} {level.name}
            </span>
            {profile.isOwner ? (
              <Link
                href="/profile/edit"
                className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Modifica profilo
              </Link>
            ) : (
              <MessageUserButton targetUserId={profile.id} label="Invia messaggio" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 max-w-prose text-pretty text-sm text-foreground">{profile.bio}</p>}

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-foreground">
              <strong>{stats.followers}</strong> <span className="text-muted-foreground">follower</span>
            </span>
            <span className="text-foreground">
              <strong>{stats.following}</strong> <span className="text-muted-foreground">seguiti</span>
            </span>
            <Link href={`/u/${profile.username}`} className="text-spark hover:underline">
              Vedi collezione completa →
            </Link>
          </div>
        </div>
      </header>

      {/* --------------------------- stat tiles --------------------------- */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile label="Oggetti" value={stats.items} />
        <StatTile label="Vendite" value={stats.sales} />
        <StatTile label="Scambi" value={stats.trades} />
        <StatTile label="Aste vinte" value={stats.auctionsWon} />
        <StatTile label="Like" value={stats.likesReceived} />
        <StatTile label="Valutazioni AI" value={stats.aiEvaluations} />
        <StatTile label="Valore" value={eur(stats.collectionValue)} />
      </section>

      {/* -------------------- level + reputation card --------------------- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-spark/20 bg-spark-muted/30 p-5">
          <div className="flex items-start gap-3">
            <CollexSpark pose="trend" size="sm" still />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Livello {level.level} — {level.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reputazione {reputation.score}/100 · {reputation.tier}
                {reputation.reviewCount > 0 ? ` · ${reputation.avgRating}★ (${reputation.reviewCount})` : ""}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-spark" style={{ width: `${levelProgress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {nextThreshold
                  ? `${nextThreshold - reputation.score} punti al livello ${level.level + 1}`
                  : "Hai raggiunto il livello massimo!"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-semibold text-foreground">Andamento reputazione</p>
          {reputation.history.length > 1 ? (
            <TrendChart data={reputation.history} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Lo storico apparirà man mano che accumuli reputazione.
            </p>
          )}
        </div>
      </section>

      {/* ----------------------- CollexSpark advice ----------------------- */}
      <section className="mt-6 rounded-2xl border border-spark/20 bg-spark-muted/20 p-5">
        <div className="flex items-center gap-2">
          <CollexSpark pose="happy" size="sm" still />
          <h2 className="text-base font-semibold text-foreground">Consigli di CollexSpark</h2>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {advice.map((a, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
              {a.message}
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------- badges ------------------------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Badge e achievement</h2>
          <span className="text-sm text-muted-foreground">
            {data.earnedBadgeCount}/{data.totalBadgeCount} sbloccati
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(grouped).map(([group, tiers]) => (
            <div key={group} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CollexSpark pose={(groupMeta[group]?.pose as SparkPose) || "happy"} size="sm" still />
                <h3 className="text-sm font-semibold text-foreground">{groupMeta[group]?.title ?? group}</h3>
              </div>
              <ul className="flex flex-col gap-2">
                {tiers.map((b) => (
                  <li
                    key={b.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                      b.earned ? b.accent : "bg-muted/50 text-muted-foreground"
                    }`}
                    title={b.description}
                  >
                    <span className="font-medium">{b.label}</span>
                    {b.earned ? (
                      <span aria-hidden>✓</span>
                    ) : (
                      <span className="tabular-nums">
                        {b.progress}/{b.threshold}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------- recent activity -------------------------- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Attività recenti</h2>
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nessuna attività recente.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${ACTIVITY_DOT[a.type] ?? "bg-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --------------------- collection highlights -------------------- */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Collezione in evidenza</h2>
          {!collection.visible ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              La collezione di questo utente è privata.
            </p>
          ) : collection.topValued.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nessun oggetto pubblico.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Più preziosi · {collection.duplicates} duplicati
              </p>
              <div className="grid grid-cols-3 gap-2">
                {collection.topValued.map((item) => (
                  <Link
                    key={item.id}
                    href={`/u/${profile.username}/item/${item.id}`}
                    className="group overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                          {item.name}
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{eur(item.currentValue)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ----------------------------- reviews ---------------------------- */}
      {reviewSummary ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recensioni</h2>
            <Link href={`/reviews/${profile.username}`} className="text-sm font-medium text-spark hover:underline">
              Tutte le recensioni →
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Average + distribution */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-foreground">{reviewSummary.avg || 0}</p>
                <div className="pb-1">
                  <StarRating value={reviewSummary.avg} size={16} />
                  <p className="mt-0.5 text-xs text-muted-foreground">{reviewSummary.total} recensioni</p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewSummary.distribution[String(star)] ?? 0
                  const pct = reviewSummary.total ? Math.round((count / reviewSummary.total) * 100) : 0
                  return (
                    <li key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-right tabular-nums text-muted-foreground">{star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-4" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Breakdown by category + trust badges */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 text-sm font-semibold text-foreground">Per categoria</p>
              <ul className="flex flex-col gap-2">
                {(["seller", "buyer", "trade"] as const).map((t) => (
                  <li key={t} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{TYPE_LABEL[t]}</span>
                    <span className="flex items-center gap-2 text-foreground">
                      <StarRating value={reviewSummary.breakdown[t].avg} size={12} />
                      <span className="tabular-nums">{reviewSummary.breakdown[t].avg || 0}</span>
                      <span className="text-xs text-muted-foreground">({reviewSummary.breakdown[t].count})</span>
                    </span>
                  </li>
                ))}
              </ul>
              {reviewSummary.trustBadges.some((b) => b.earned) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {reviewSummary.trustBadges
                    .filter((b) => b.earned)
                    .map((b) => (
                      <span
                        key={b.id}
                        className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        {b.label}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>

            {/* Recent reviews */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 text-sm font-semibold text-foreground">Recenti</p>
              {reviews.recent.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nessuna recensione ancora.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {reviews.recent.map((r) => (
                    <li key={r._id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">{r.authorUsername || "Utente"}</span>
                        <StarRating value={r.rating} size={11} />
                      </div>
                      {r.comment ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------ community stats ------------------------- */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Community</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Post" value={stats.posts} />
          <StatTile label="Commenti" value={stats.comments} />
          <StatTile label="Like ricevuti" value={stats.likesReceived} />
          <StatTile label="Monete acquistate" value={stats.coinsPurchased} />
        </div>
      </section>

      {/* --------------------------- chat activity ------------------------ */}
      {chat ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <CollexSpark pose="happy" size="sm" still />
            <h2 className="text-lg font-semibold text-foreground">Attività Chat</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Conversazioni" value={chat.conversations} />
            <StatTile label="Messaggi inviati" value={chat.messagesSent} />
            <StatTile label="Badge Conversatore" value={badges.filter((b) => b.group === "conversatore" && b.earned).length} />
            <StatTile label="Badge Social Star" value={badges.filter((b) => b.group === "socialStar" && b.earned).length} />
          </div>

          {chat.mostContacted.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Utenti più contattati</h3>
              <ul className="flex flex-wrap gap-2">
                {chat.mostContacted.map((u) => (
                  <li key={u.userId}>
                    <Link
                      href={`/u/${u.username}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar || "/placeholder.svg"} alt={u.username} className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{u.username}</span>
                      <span className="text-xs text-muted-foreground">{u.messages}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {chat.advice.length > 0 ? (
            <div className="mt-4 space-y-2">
              {chat.advice.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-spark/20 bg-spark-muted/30 p-3">
                  <CollexSpark pose={(tip.pose as SparkPose) || "happy"} size="sm" still />
                  <p className="text-sm text-foreground">{tip.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------- groups --------------------------- */}
      {groups ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollexSpark pose="happy" size="sm" still />
              <h2 className="text-lg font-semibold text-foreground">Gruppi</h2>
            </div>
            <Link href="/groups" className="text-sm font-medium text-spark hover:underline">
              Esplora gruppi →
            </Link>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Iscritto a" value={groups.stats.joined} />
            <StatTile label="Amministra" value={groups.stats.administered} />
            <StatTile label="Post nei gruppi" value={groups.stats.totalPosts} />
            <StatTile label="Messaggi gruppo" value={groups.stats.totalMessages} />
          </div>

          {groups.list.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.list.map((g) => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {g.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverImage || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/15 to-accent/20" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.category} · {g.memberCount} membri
                    </p>
                  </div>
                  {g.role !== "member" ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {g.role === "owner" ? "Admin" : g.role}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              {profile.isOwner ? "Non fai ancora parte di nessun gruppo." : "Nessun gruppo pubblico."}
            </p>
          )}
        </section>
      ) : null}

      {/* ------------------------------ showcase -------------------------- */}
      {showcase ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollexSpark pose="trend" size="sm" still />
              <h2 className="text-lg font-semibold text-foreground">Vetrina</h2>
            </div>
            <Link href={`/showcase/${profile.username}`} className="text-sm font-medium text-spark hover:underline">
              Apri vetrina →
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground">{showcase.title || "La mia vetrina"}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{showcase.theme}</span>
              {showcase.visibility === "private" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Privata · solo gruppi</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label="Pezzi esposti" value={showcase.exposedCount} />
              <StatTile label="Valore" value={`€${Math.round(showcase.exposedValue).toLocaleString("it-IT")}`} />
              <StatTile label="Rarità" value={showcase.rareCount} />
              <StatTile label="Follower" value={showcase.followerCount} />
              <StatTile label="Trend" value={`${showcase.trendPct >= 0 ? "+" : ""}${showcase.trendPct}%`} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ boost premium --------------------- */}
      {profile.isOwner && boost ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollexSpark pose="deal" size="sm" still />
              <h2 className="text-lg font-semibold text-foreground">Boost Premium</h2>
            </div>
            <Link href="/advisor?tab=collection" className="text-sm font-medium text-spark hover:underline">
              Strategia Boost →
            </Link>
          </div>

          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Boost attivi" value={boost.activeCount} />
              <StatTile label="Coins spesi" value={boost.totalCoinsSpent} />
              <StatTile label="Annunci" value={boost.counts.boostMarketplaceCount} />
              <StatTile label="Aste" value={boost.counts.boostAuctionCount} />
            </div>
            {boost.active.length ? (
              <ul className="flex flex-col gap-2">
                {boost.active.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-card px-3 py-2 text-sm dark:border-amber-800"
                  >
                    <span className="font-medium text-foreground">{b.label}</span>
                    <span className="text-xs text-muted-foreground">
                      +{b.visibilityPct}% · {Math.max(0, Math.ceil(b.remainingMs / 3_600_000))}h rimaste
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun boost attivo. Metti in evidenza i tuoi annunci, aste o la tua vetrina con i CollexCoins.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Blocco 34 — Analytics avanzati (solo proprietario) */}
      {profile.isOwner ? (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CollexSpark pose="trend" size="sm" still />
              Analytics
            </h2>
            <Link
              href="/analytics"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Dashboard completa
            </Link>
          </div>
          <AnalyticsDashboard embedded />
        </section>
      ) : null}
    </div>
  )
}
