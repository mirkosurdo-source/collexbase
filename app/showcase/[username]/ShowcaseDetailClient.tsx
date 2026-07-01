"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { chatFetch } from "@/lib/chat-client"
import CollexSpark from "@/components/collexspark/CollexSpark"
import ShowcaseEditor from "@/components/showcase/ShowcaseEditor"
import ShareShowcaseButton from "@/components/showcase/ShareShowcaseButton"
import BoostButton from "@/components/boost/BoostButton"

interface ShowcaseItem {
  id: string
  name: string
  image: string
  category: string
  rarity: string
  currentValue: number
  forSale: boolean
  forTrade: boolean
}

interface ShowcaseData {
  userId: string
  username: string
  title: string
  description: string
  theme: string
  visibility: "public" | "private" | "disabled"
  followerCount: number
  isOwner: boolean
  isFollowing: boolean
  analysis: {
    exposedCount: number
    exposedValue: number
    rareCount: number
    themes: number
    duplicates: number
    trendPct: number
    featured: ShowcaseItem[]
    rarest: ShowcaseItem[]
    topValued: ShowcaseItem[]
    wanted: ShowcaseItem[]
  }
}

function formatValue(v: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
}

function ItemGrid({ items }: { items: ShowcaseItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Nessun oggetto da mostrare.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-square bg-muted">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image || "/placeholder.svg"} alt={it.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent/20" />
            )}
          </div>
          <div className="p-2">
            <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{it.rarity}</span>
              <span className="text-xs font-semibold text-foreground">{formatValue(it.currentValue)}</span>
            </div>
            {it.forSale || it.forTrade ? (
              <div className="mt-1 flex gap-1">
                {it.forSale ? (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Vendita</span>
                ) : null}
                {it.forTrade ? (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Scambio
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export default function ShowcaseDetailClient({ username }: { username: string }) {
  const [data, setData] = useState<ShowcaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [tab, setTab] = useState<"featured" | "rarest" | "valued" | "wanted">("featured")
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [inviteUser, setInviteUser] = useState("")
  const [inviteMsg, setInviteMsg] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    chatFetch<{ success: boolean; showcase?: ShowcaseData }>(`/api/showcase/${encodeURIComponent(username)}`)
      .then((res) => {
        if (res.success && res.showcase) {
          setData(res.showcase)
          setFollowing(res.showcase.isFollowing)
          setFollowerCount(res.showcase.followerCount)
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  async function toggleFollow() {
    if (!data) return
    // Optimistic update.
    const next = !following
    setFollowing(next)
    setFollowerCount((c) => c + (next ? 1 : -1))
    try {
      const res = await chatFetch<{ success: boolean; following?: boolean; followerCount?: number }>(
        `/api/showcase/${encodeURIComponent(username)}/follow`,
        { method: "POST" },
      )
      if (res.success) {
        setFollowing(!!res.following)
        if (typeof res.followerCount === "number") setFollowerCount(res.followerCount)
      }
    } catch {
      // Revert on failure.
      setFollowing(!next)
      setFollowerCount((c) => c + (next ? -1 : 1))
    }
  }

  function share() {
    const url = `${window.location.origin}/showcase/${encodeURIComponent(username)}`
    if (navigator.share) {
      navigator.share({ title: data?.title || "Vetrina", url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <CollexSpark pose="alert" size="md" still />
        <h1 className="text-lg font-semibold text-foreground">Vetrina non disponibile</h1>
        <p className="text-sm text-muted-foreground">
          Questa vetrina non esiste, è privata o è stata disattivata dal collezionista.
        </p>
        <Link href="/showcase" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Esplora vetrine
        </Link>
      </div>
    )
  }

  const a = data.analysis
  const tabItems =
    tab === "featured" ? a.featured : tab === "rarest" ? a.rarest : tab === "valued" ? a.topValued : a.wanted

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-28 bg-gradient-to-r from-primary/15 via-accent/20 to-primary/10" />
        <div className="px-5 pb-5">
          <div className="-mt-8 mb-3 flex items-end justify-between gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-card bg-primary/10">
              <CollexSpark pose="happy" size="sm" still />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.isOwner ? (
                <button
                  onClick={() => setEditorOpen(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Modifica vetrina
                </button>
              ) : (
                <button
                  onClick={toggleFollow}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    following
                      ? "border border-border bg-card text-foreground hover:bg-accent"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {following ? "Segui già" : "Segui vetrina"}
                </button>
              )}
              <button
                onClick={share}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                {copied ? "Copiato!" : "Condividi"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{data.title || `Vetrina di ${data.username}`}</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{data.theme}</span>
            {data.visibility === "private" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Privata · solo gruppi</span>
            ) : null}
          </div>
          <Link href={`/u/${data.username}`} className="text-sm text-muted-foreground hover:underline">
            @{data.username}
          </Link>
          {data.description ? <p className="mt-2 text-sm text-foreground">{data.description}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {followerCount} {followerCount === 1 ? "follower" : "follower"}
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Pezzi esposti" value={a.exposedCount} />
        <StatTile label="Valore esposto" value={formatValue(a.exposedValue)} />
        <StatTile label="Rarità" value={a.rareCount} />
        <StatTile label="Temi" value={a.themes} />
        <StatTile label="Trend" value={`${a.trendPct >= 0 ? "+" : ""}${a.trendPct}%`} />
      </div>

      {/* Owner-only invite */}
      {data.isOwner ? (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <CollexSpark pose="happy" size="sm" still />
            <h2 className="text-sm font-semibold text-foreground">Invita a vedere la tua vetrina</h2>
          </div>
          <div className="flex gap-2">
            <input
              value={inviteUser}
              onChange={(e) => setInviteUser(e.target.value)}
              placeholder="@username"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={async () => {
                setInviteMsg("")
                const u = inviteUser.trim().replace(/^@/, "")
                if (!u) return
                try {
                  const res = await chatFetch<{ success: boolean; error?: string }>(
                    `/api/showcase/${encodeURIComponent(username)}/invite`,
                    { method: "POST", body: JSON.stringify({ username: u }) },
                  )
                  setInviteMsg(res.success ? "Invito inviato!" : res.error || "Errore.")
                  if (res.success) setInviteUser("")
                } catch {
                  setInviteMsg("Errore durante l'invito.")
                }
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Invita
            </button>
          </div>
          {inviteMsg ? <p className="mt-2 text-xs text-muted-foreground">{inviteMsg}</p> : null}
          {data.visibility === "public" ? (
            <div className="mt-3 border-t border-border pt-3">
              <ShareShowcaseButton username={data.username} title={data.title} />
            </div>
          ) : null}
          {data.visibility === "public" ? (
            <div className="mt-3 border-t border-border pt-3">
              <BoostButton
                targetType="showcase"
                targetId={data.userId}
                label="Metti in evidenza la vetrina"
                onActivated={load}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {(
          [
            ["featured", "In evidenza"],
            ["rarest", "Più rari"],
            ["valued", "Più preziosi"],
            ["wanted", "Sul mercato"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ItemGrid items={tabItems} />

      {data.isOwner ? (
        <ShowcaseEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={load} />
      ) : null}
    </div>
  )
}
