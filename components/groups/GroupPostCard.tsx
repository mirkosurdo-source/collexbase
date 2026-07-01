"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, MessageSquare, Tag, Repeat } from "lucide-react"
import { chatFetch, formatTime } from "@/lib/chat-client"

export interface GroupPostDTO {
  id: string
  kind: "discussion" | "showcase" | "sale" | "trade"
  authorId: string
  authorName: string
  authorUsername: string
  authorAvatar: string
  title: string
  body: string
  images: string[]
  price?: number | null
  likeCount: number
  commentCount: number
  liked?: boolean
  createdAt: string
}

const KIND_META: Record<string, { label: string; className: string }> = {
  discussion: { label: "Discussione", className: "bg-muted text-muted-foreground" },
  showcase: { label: "Vetrina", className: "bg-primary/10 text-primary" },
  sale: { label: "Vendita", className: "bg-chart-4/15 text-chart-4" },
  trade: { label: "Scambio", className: "bg-accent text-accent-foreground" },
}

export default function GroupPostCard({ groupId, post }: { groupId: string; post: GroupPostDTO }) {
  const [liked, setLiked] = useState(!!post.liked)
  const [likeCount, setLikeCount] = useState(post.likeCount)

  async function toggleLike() {
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    try {
      const d = await chatFetch<{ success: boolean; liked?: boolean; likeCount?: number }>(
        `/api/groups/${groupId}/posts/${post.id}/like`,
        { method: "POST" },
      )
      if (d.success && typeof d.likeCount === "number") {
        setLiked(!!d.liked)
        setLikeCount(d.likeCount)
      }
    } catch {
      // revert on failure
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    }
  }

  const meta = KIND_META[post.kind] || KIND_META.discussion

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-2 flex items-center gap-2">
        <Link href={`/u/${post.authorUsername}`} className="flex items-center gap-2">
          {post.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.authorAvatar || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {(post.authorName || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{post.authorName}</p>
            <p className="text-xs text-muted-foreground">{formatTime(post.createdAt)}</p>
          </div>
        </Link>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
          {post.kind === "sale" ? <Tag width={11} height={11} /> : post.kind === "trade" ? <Repeat width={11} height={11} /> : null}
          {meta.label}
        </span>
      </header>

      {post.title ? <h3 className="mb-1 font-semibold text-foreground">{post.title}</h3> : null}
      {post.body ? <p className="whitespace-pre-wrap text-sm text-foreground">{post.body}</p> : null}

      {post.kind === "sale" && typeof post.price === "number" ? (
        <p className="mt-2 text-lg font-bold text-foreground">€{post.price.toLocaleString("it-IT")}</p>
      ) : null}

      {post.images.length > 0 ? (
        <div className={`mt-3 grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.images.slice(0, 4).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url || "/placeholder.svg"} alt="" className="max-h-64 w-full rounded-lg object-cover" />
          ))}
        </div>
      ) : null}

      <footer className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={toggleLike}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-foreground ${liked ? "text-destructive" : ""}`}
        >
          <Heart width={16} height={16} fill={liked ? "currentColor" : "none"} />
          {likeCount}
        </button>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare width={16} height={16} />
          {post.commentCount}
        </span>
      </footer>
    </article>
  )
}
