"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react"
import { timeAgo } from "@/lib/format"
import FollowButton from "@/components/community/FollowButton"
import MessageUserButton from "@/components/chat/MessageUserButton"
import ShareToGroupButton from "@/components/groups/ShareToGroupButton"

export interface PostSummary {
  id: string
  authorId: string
  authorUsername: string
  authorAvatar: string
  kind: "post" | "blog"
  blogType?: string
  title?: string
  excerpt: string
  images: string[]
  category?: string
  tags: string[]
  likeCount: number
  commentCount: number
  shareCount: number
  liked: boolean
  saved: boolean
  isOwner?: boolean
  followingAuthor?: boolean
  createdAt: string
}

interface PostCardProps {
  post: PostSummary
  token: string | null
  onChange?: (post: PostSummary) => void
}

/** A single community feed entry with optimistic like/save toggles. */
export default function PostCard({ post, token, onChange }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [saved, setSaved] = useState(post.saved)
  const [busy, setBusy] = useState(false)

  async function toggleLike() {
    if (!token || busy) return
    setBusy(true)
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    try {
      const res = await fetch("/api/community/post/like", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id }),
      })
      const data = await res.json()
      if (res.ok && data.liked !== undefined) {
        setLiked(data.liked)
        setLikeCount(data.likeCount)
        onChange?.({ ...post, liked: data.liked, likeCount: data.likeCount })
      }
    } catch {
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    } finally {
      setBusy(false)
    }
  }

  async function toggleSave() {
    if (!token) return
    const next = !saved
    setSaved(next)
    try {
      const res = await fetch("/api/community/post/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id }),
      })
      const data = await res.json()
      if (res.ok && data.saved !== undefined) setSaved(data.saved)
    } catch {
      setSaved(!next)
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Link href={`/u/${post.authorUsername}`} className="shrink-0">
          {post.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.authorAvatar || "/placeholder.svg"}
              alt={post.authorUsername}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {post.authorUsername.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <Link href={`/u/${post.authorUsername}`} className="font-medium text-foreground hover:underline">
            {post.authorUsername}
          </Link>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.createdAt)}
            {post.category ? ` · ${post.category}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {post.kind === "blog" && post.blogType ? (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
              {post.blogType}
            </span>
          ) : null}
          {token && !post.isOwner ? (
            <>
              <MessageUserButton targetUserId={post.authorId} label="Messaggia" />
              <FollowButton userId={post.authorId} token={token} initialFollowing={post.followingAuthor} />
            </>
          ) : null}
        </div>
      </div>

      <Link href={`/community/${post.id}`} className="mt-3 block">
        {post.title ? <h3 className="text-lg font-semibold text-foreground text-balance">{post.title}</h3> : null}
        {post.excerpt ? <p className="mt-1 whitespace-pre-wrap text-pretty text-sm text-foreground/90">{post.excerpt}</p> : null}
      </Link>

      {post.images.length > 0 ? (
        <Link href={`/community/${post.id}`} className="mt-3 block">
          <div className={`grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {post.images.slice(0, 4).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src || "/placeholder.svg"}
                alt={`Immagine ${i + 1}`}
                className="h-48 w-full rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        </Link>
      ) : null}

      {post.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-5 text-muted-foreground">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${liked ? "text-primary" : ""}`}
          aria-pressed={liked}
        >
          <Heart width={18} height={18} className={liked ? "fill-primary" : ""} />
          {likeCount}
        </button>
        <Link href={`/community/${post.id}`} className="flex items-center gap-1.5 text-sm hover:text-foreground">
          <MessageCircle width={18} height={18} />
          {post.commentCount}
        </Link>
        <button
          type="button"
          onClick={toggleSave}
          className={`ml-auto flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${saved ? "text-primary" : ""}`}
          aria-pressed={saved}
        >
          <Bookmark width={18} height={18} className={saved ? "fill-primary" : ""} />
        </button>
        {token ? (
          <ShareToGroupButton postId={post.id} postExcerpt={post.excerpt} />
        ) : (
          <Share2 width={18} height={18} className="opacity-50" />
        )}
      </div>
    </article>
  )
}
