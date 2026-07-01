"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Heart, Reply, Loader2 } from "lucide-react"
import { timeAgo } from "@/lib/format"

export interface CommentNode {
  id: string
  parentId: string | null
  authorId: string
  authorUsername: string
  authorAvatar: string
  body: string
  mentions: string[]
  likeCount: number
  liked: boolean
  createdAt: string
}

interface CommentThreadProps {
  postId: string
  comments: CommentNode[]
  token: string | null
  onAdded: (comment: CommentNode) => void
}

/** Renders comment text with @mentions linked to user profiles. */
function renderBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9_]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const username = part.slice(1)
      return (
        <Link key={i} href={`/u/${username}`} className="font-medium text-primary hover:underline">
          {part}
        </Link>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function CommentItem({
  comment,
  replies,
  token,
  onReply,
}: {
  comment: CommentNode
  replies: CommentNode[]
  token: string | null
  onReply: (parentId: string, username: string) => void
}) {
  const [liked, setLiked] = useState(comment.liked)
  const [likeCount, setLikeCount] = useState(comment.likeCount)

  async function toggleLike() {
    if (!token) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    try {
      const res = await fetch("/api/community/comment/like", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commentId: comment.id }),
      })
      const data = await res.json()
      if (res.ok && data.liked !== undefined) {
        setLiked(data.liked)
        setLikeCount(data.likeCount)
      }
    } catch {
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    }
  }

  return (
    <div className="flex gap-3">
      <Link href={`/u/${comment.authorUsername}`} className="shrink-0">
        {comment.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.authorAvatar || "/placeholder.svg"} alt={comment.authorUsername} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {comment.authorUsername.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-muted px-3 py-2">
          <Link href={`/u/${comment.authorUsername}`} className="text-sm font-medium text-foreground hover:underline">
            {comment.authorUsername}
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">{renderBody(comment.body)}</p>
        </div>
        <div className="mt-1 flex items-center gap-4 px-1 text-xs text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1 transition-colors hover:text-primary ${liked ? "text-primary" : ""}`}
          >
            <Heart width={13} height={13} className={liked ? "fill-primary" : ""} />
            {likeCount > 0 ? likeCount : ""}
          </button>
          <button
            type="button"
            onClick={() => onReply(comment.id, comment.authorUsername)}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Reply width={13} height={13} />
            Rispondi
          </button>
        </div>

        {replies.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 border-l border-border pl-3">
            {replies.map((r) => (
              <CommentItem key={r.id} comment={r} replies={[]} token={token} onReply={onReply} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function CommentThread({ postId, comments, token, onAdded }: CommentThreadProps) {
  const [text, setText] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { roots, repliesByParent } = useMemo(() => {
    const roots: CommentNode[] = []
    const repliesByParent = new Map<string, CommentNode[]>()
    for (const c of comments) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) || []
        arr.push(c)
        repliesByParent.set(c.parentId, arr)
      } else {
        roots.push(c)
      }
    }
    return { roots, repliesByParent }
  }, [comments])

  function handleReply(parentId: string, username: string) {
    setReplyTo({ id: parentId, username })
    setText((t) => (t.includes(`@${username}`) ? t : `@${username} ${t}`))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || submitting) return
    const body = text.trim()
    if (!body) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/community/comment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, parentId: replyTo?.id || null, body }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onAdded(data.comment)
        setText("")
        setReplyTo(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="mb-5">
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Risposta a @{replyTo.username}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-primary hover:underline">
              annulla
            </button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                submit(e)
              }
            }}
            placeholder="Scrivi un commento... usa @ per menzionare"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 width={15} height={15} className="animate-spin" /> : null}
            Invia
          </button>
        </div>
      </form>

      {roots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nessun commento. Scrivi il primo!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {roots.map((c) => (
            <CommentItem key={c.id} comment={c} replies={repliesByParent.get(c.id) || []} token={token} onReply={handleReply} />
          ))}
        </div>
      )}
    </div>
  )
}
