"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, Flame, BookOpen, Heart, MessageCircle, Sparkles } from "lucide-react"
import CollexSpark from "@/components/collexspark/CollexSpark"
import FollowButton from "@/components/community/FollowButton"

interface RecommendedUser {
  userId: string
  username: string
  avatar: string
  name: string
  posts: number
  likes: number
}
interface TrendingCategory {
  category: string
  posts: number
  likes: number
}
interface PopularPost {
  id: string
  title: string
  authorUsername: string
  likeCount: number
  commentCount: number
  category: string
}
interface RecentBlog {
  id: string
  title: string
  authorUsername: string
  blogType: string
  category: string
}

interface DiscoverData {
  recommendedUsers: RecommendedUser[]
  trending: TrendingCategory[]
  popularPosts: PopularPost[]
  recentBlogs: RecentBlog[]
  sparkTip: string
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Blocco 25 — community discovery sidebar with a CollexSpark social tip. */
export default function CommunitySidebar({ token }: { token: string | null }) {
  const [data, setData] = useState<DiscoverData | null>(null)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    fetch("/api/community/discover", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setData(d)
      })
      .catch(() => {})
  }, [token])

  return (
    <aside className="flex flex-col gap-4">
      {/* CollexSpark social advisor */}
      <section className="rounded-xl border border-spark/30 bg-spark-muted/30 p-4">
        <div className="flex items-start gap-3">
          <CollexSpark pose="happy" size="sm" still />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles width={14} height={14} className="text-spark" />
              CollexSpark
            </p>
            <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
              {data?.sparkTip ?? "Carico i consigli per la community..."}
            </p>
          </div>
        </div>
      </section>

      {data && data.recommendedUsers.length > 0 ? (
        <Panel title="Collezionisti consigliati" icon={<Sparkles width={15} height={15} className="text-primary" />}>
          <ul className="flex flex-col gap-3">
            {data.recommendedUsers.map((u) => (
              <li key={u.userId} className="flex items-center gap-2.5">
                <Link href={`/u/${u.username}`} className="shrink-0">
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar || "/placeholder.svg"} alt={u.username} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {u.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${u.username}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                    {u.username}
                  </Link>
                  <p className="text-xs text-muted-foreground">{u.likes} mi piace</p>
                </div>
                <FollowButton userId={u.userId} token={token} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data && data.trending.length > 0 ? (
        <Panel title="Trend della community" icon={<TrendingUp width={15} height={15} className="text-primary" />}>
          <div className="flex flex-wrap gap-2">
            {data.trending.map((t) => (
              <Link
                key={t.category}
                href={`/community?category=${encodeURIComponent(t.category)}`}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.category} · {t.posts}
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      {data && data.popularPosts.length > 0 ? (
        <Panel title="Post popolari" icon={<Flame width={15} height={15} className="text-primary" />}>
          <ul className="flex flex-col gap-3">
            {data.popularPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="group block">
                  <p className="line-clamp-2 text-sm text-foreground group-hover:text-primary">{p.title}</p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart width={12} height={12} />
                      {p.likeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle width={12} height={12} />
                      {p.commentCount}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data && data.recentBlogs.length > 0 ? (
        <Panel title="Blog recenti" icon={<BookOpen width={15} height={15} className="text-primary" />}>
          <ul className="flex flex-col gap-3">
            {data.recentBlogs.map((b) => (
              <li key={b.id}>
                <Link href={`/community/${b.id}`} className="group block">
                  <p className="line-clamp-2 text-sm text-foreground group-hover:text-primary">{b.title}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {b.blogType || "articolo"} · {b.authorUsername}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/community/blog" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            Vedi tutto il blog
          </Link>
        </Panel>
      ) : null}
    </aside>
  )
}
