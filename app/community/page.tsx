"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PenSquare, Loader2 } from "lucide-react"
import PostCard, { type PostSummary } from "@/components/community/PostCard"
import CommunitySidebar from "@/components/community/CommunitySidebar"
import { CATEGORIES } from "@/lib/collection-helpers"

const FEEDS = [
  { key: "recent", label: "Recenti" },
  { key: "popular", label: "Popolari" },
  { key: "following", label: "Seguiti" },
  { key: "liked", label: "Mi piace" },
]

export default function CommunityPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [feed, setFeed] = useState("recent")
  const [category, setCategory] = useState("")
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setToken(t)
    // Allow deep-linking to a category (e.g. from the sidebar trend chips).
    const urlCategory = new URLSearchParams(window.location.search).get("category")
    if (urlCategory) setCategory(urlCategory)
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ kind: "post", feed, page: String(page) })
      if (category) params.set("category", category)
      const res = await fetch(`/api/community/post/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setPosts(data.posts || [])
        setTotalPages(data.totalPages || 1)
      }
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [token, feed, category, page])

  useEffect(() => {
    load()
  }, [load])

  // Reset to first page when the feed or category changes.
  useEffect(() => {
    setPage(1)
  }, [feed, category])

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <main className="min-w-0">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          <p className="text-sm text-muted-foreground">Condividi i pezzi della tua collezione e scopri quelli degli altri.</p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PenSquare width={16} height={16} />
          Pubblica
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-2 border-b border-border">
        {FEEDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFeed(f.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              feed === f.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            category === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Tutte
        </button>
        {CATEGORIES.map((c: string) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>Nessun post da mostrare.</p>
          {feed === "following" ? (
            <p className="mt-1 text-sm">Segui altri collezionisti per vedere i loro post qui.</p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} token={token} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
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
      </main>

      <CommunitySidebar token={token} />
    </div>
  )
}
