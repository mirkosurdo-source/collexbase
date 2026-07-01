"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Heart, Bookmark, ArrowLeft, Loader2, UserPlus, UserCheck } from "lucide-react"
import CommentThread, { type CommentNode } from "@/components/community/CommentThread"
import { timeAgo } from "@/lib/format"

interface PostDetail {
  id: string
  authorId: string
  authorUsername: string
  authorAvatar: string
  kind: "post" | "blog"
  blogType?: string
  title?: string
  body: string
  images: string[]
  category?: string
  tags: string[]
  visibility: string
  likeCount: number
  commentCount: number
  liked: boolean
  saved: boolean
  followingAuthor: boolean
  isOwner: boolean
  createdAt: string
}

export default function PostDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const postId = params?.id

  const [token, setToken] = useState<string | null>(null)
  const [post, setPost] = useState<PostDetail | null>(null)
  const [comments, setComments] = useState<CommentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    setToken(localStorage.getItem("token"))
  }, [])

  const load = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      const t = localStorage.getItem("token")
      if (t) headers.Authorization = `Bearer ${t}`
      const res = await fetch(`/api/community/post/item?id=${postId}`, { headers })
      const data = await res.json()
      if (res.ok && data.success) {
        setPost(data.post)
        setComments(data.comments || [])
        setFollowing(data.post.followingAuthor)
      } else {
        setError(data.message || "Post non disponibile.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    load()
  }, [load])

  async function toggleLike() {
    if (!token || !post) return
    const next = !post.liked
    setPost({ ...post, liked: next, likeCount: post.likeCount + (next ? 1 : -1) })
    try {
      const res = await fetch("/api/community/post/like", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id }),
      })
      const data = await res.json()
      if (res.ok) setPost((p) => (p ? { ...p, liked: data.liked, likeCount: data.likeCount } : p))
    } catch {
      load()
    }
  }

  async function toggleSave() {
    if (!token || !post) return
    const next = !post.saved
    setPost({ ...post, saved: next })
    try {
      await fetch("/api/community/post/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id }),
      })
    } catch {
      setPost((p) => (p ? { ...p, saved: !next } : p))
    }
  }

  async function toggleFollow() {
    if (!token || !post) return
    const next = !following
    setFollowing(next)
    try {
      const res = await fetch("/api/market/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sellerId: post.authorId }),
      })
      const data = await res.json()
      if (res.ok && typeof data.following === "boolean") setFollowing(data.following)
    } catch {
      setFollowing(!next)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">{error || "Post non trovato."}</p>
        <Link href="/community" className="mt-4 inline-block text-primary hover:underline">
          Torna alla community
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => router.push("/community")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft width={16} height={16} />
        Community
      </button>

      <article className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Link href={`/u/${post.authorUsername}`} className="shrink-0">
            {post.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.authorAvatar || "/placeholder.svg"} alt={post.authorUsername} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
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
          {!post.isOwner && token ? (
            <button
              type="button"
              onClick={toggleFollow}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                following ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              {following ? <UserCheck width={14} height={14} /> : <UserPlus width={14} height={14} />}
              {following ? "Segui già" : "Segui"}
            </button>
          ) : null}
        </div>

        {post.kind === "blog" && post.blogType ? (
          <span className="mt-4 inline-block rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
            {post.blogType}
          </span>
        ) : null}
        {post.title ? <h1 className="mt-3 text-2xl font-bold text-foreground text-balance">{post.title}</h1> : null}
        {post.body ? <p className="mt-3 whitespace-pre-wrap text-pretty text-foreground/90 leading-relaxed">{post.body}</p> : null}

        {post.images.length > 0 ? (
          <div className={`mt-4 grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {post.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src || "/placeholder.svg"} alt={`Immagine ${i + 1}`} className="w-full rounded-lg border border-border object-cover" />
            ))}
          </div>
        ) : null}

        {post.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-5 border-t border-border pt-4 text-muted-foreground">
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${post.liked ? "text-primary" : ""}`}
          >
            <Heart width={19} height={19} className={post.liked ? "fill-primary" : ""} />
            {post.likeCount}
          </button>
          <span className="text-sm">{post.commentCount} commenti</span>
          <button
            type="button"
            onClick={toggleSave}
            className={`ml-auto flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${post.saved ? "text-primary" : ""}`}
          >
            <Bookmark width={19} height={19} className={post.saved ? "fill-primary" : ""} />
            {post.saved ? "Salvato" : "Salva"}
          </button>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Commenti</h2>
        <CommentThread
          postId={post.id}
          comments={comments}
          token={token}
          onAdded={(c) => {
            setComments((prev) => [...prev, c])
            setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p))
          }}
        />
      </section>
    </div>
  )
}
