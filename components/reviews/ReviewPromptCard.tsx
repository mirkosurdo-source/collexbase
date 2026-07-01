"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"
import StarRating from "@/components/community/StarRating"

type ReviewType = "seller" | "buyer" | "trade"

interface ReviewPromptCardProps {
  /** Username of the user being reviewed. */
  targetUsername: string
  type: ReviewType
  /** Transaction reference so a user reviews a given deal only once. */
  refId: string
  title?: string
  pose?: SparkPose
  className?: string
}

/**
 * Blocco 28 — contextual "leave a review" card shown on completed
 * marketplace orders, trades and won auctions. It auto-hides if the current
 * user has already reviewed this transaction.
 */
export default function ReviewPromptCard({
  targetUsername,
  type,
  refId,
  title = "Lascia una recensione",
  pose = "deal",
  className = "",
}: ReviewPromptCardProps) {
  const [token, setToken] = useState<string | null>(null)
  const [myUsername, setMyUsername] = useState<string | null>(null)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [ready, setReady] = useState(false)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    setToken(t)
    if (t) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setMyUsername(d.user.username)
        })
        .catch(() => {})
    }
  }, [])

  const checkExisting = useCallback(async () => {
    if (!refId || !myUsername) {
      setReady(true)
      return
    }
    try {
      const res = await fetch(`/api/reviews/transaction/${encodeURIComponent(refId)}`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.reviews)) {
        const mine = data.reviews.some(
          (r: { authorUsername?: string; type?: string }) => r.authorUsername === myUsername && r.type === type,
        )
        setAlreadyReviewed(mine)
      }
    } catch {
      // ignore — allow showing the form
    } finally {
      setReady(true)
    }
  }, [refId, myUsername, type])

  useEffect(() => {
    checkExisting()
  }, [checkExisting])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUsername, type, rating, comment, refId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDone(true)
      } else {
        setError(data.error || "Invio recensione non riuscito.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setSubmitting(false)
    }
  }

  // Hide entirely if not logged in, reviewing self, or already reviewed.
  if (!ready) return null
  if (!token || !myUsername || myUsername === targetUsername || alreadyReviewed) return null

  return (
    <div className={`rounded-2xl border border-spark/20 bg-spark-muted/30 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <CollexSpark pose={done ? "happy" : pose} size="sm" still />
        <div className="min-w-0 flex-1">
          {done ? (
            <p className="text-sm font-medium text-foreground">Grazie! La tua recensione è stata pubblicata.</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Valuta la tua esperienza con @{targetUsername}.
              </p>
              <form onSubmit={submit} className="mt-3">
                <StarRating value={rating} onChange={setRating} size={24} />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Aggiungi un commento (opzionale)..."
                  className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-spark px-4 py-2 text-sm font-medium text-spark-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 width={15} height={15} className="animate-spin" /> : null}
                  Invia recensione
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
