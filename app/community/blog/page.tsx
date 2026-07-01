"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Clock, MessageCircle, Heart, PenSquare } from "lucide-react"
import { timeAgo } from "@/lib/format"

interface BlogPost {
  id: string
  authorUsername: string
  authorAvatar: string
  blogType: string
  title: string
  excerpt: string
  cover: string
  category?: string
  tags: string[]
  likeCount: number
  commentCount: number
  readMinutes: number
  createdAt: string
}

const TYPES = [
  { key: "", label: "Tutti" },
  { key: "guide", label: "Guide" },
  { key: "discussion", label: "Discussioni" },
  { key: "help", label: "Aiuto" },
]

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [blogType, setBlogType] = useState("")
  const [sort, setSort] = useState("recent")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, page: String(page) })
      if (blogType) params.set("blogType", blogType)
      if (search) params.set("q", search)
      const res = await fetch(`/api/community/blog/list?${params.toString()}`)
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
  }, [blogType, sort, search, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [blogType, sort, search])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blog & Guide</h1>
          <p className="text-sm text-muted-foreground">Articoli, guide e discussioni della community di collezionisti.</p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PenSquare width={16} height={16} />
          Scrivi un articolo
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setBlogType(t.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                blogType === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(q.trim())
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </form>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="recent">Recenti</option>
            <option value="popular">Popolari</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          Nessun articolo trovato.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/community/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
            >
              {p.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover || "/placeholder.svg"} alt={p.title} className="h-40 w-full object-cover" />
              ) : null}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold capitalize text-primary">
                    {p.blogType || "articolo"}
                  </span>
                  {p.category ? <span className="text-xs text-muted-foreground">{p.category}</span> : null}
                </div>
                <h2 className="font-semibold text-foreground text-balance group-hover:text-primary">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{p.authorUsername}</span>
                  <span>·</span>
                  <span>{timeAgo(p.createdAt)}</span>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock width={13} height={13} />
                    {p.readMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart width={13} height={13} />
                    {p.likeCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle width={13} height={13} />
                    {p.commentCount}
                  </span>
                </div>
              </div>
            </Link>
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
    </div>
  )
}
