"use client"

import { useState } from "react"
import { UserPlus, UserCheck, Loader2 } from "lucide-react"

interface FollowButtonProps {
  userId: string
  token: string | null
  initialFollowing?: boolean
  size?: "sm" | "md"
  onChange?: (following: boolean) => void
  className?: string
}

/**
 * Blocco 25 — reusable follow toggle backed by /api/community/follow.
 * Optimistic with rollback on error.
 */
export default function FollowButton({
  userId,
  token,
  initialFollowing = false,
  size = "sm",
  onChange,
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!token || busy) return
    const next = !following
    setFollowing(next)
    setBusy(true)
    try {
      const res = await fetch("/api/community/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.ok && typeof data.following === "boolean") {
        setFollowing(data.following)
        onChange?.(data.following)
      } else {
        setFollowing(!next)
      }
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  const pad = size === "md" ? "px-3.5 py-2 text-sm" : "px-3 py-1.5 text-xs"
  const icon = size === "md" ? 15 : 13

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !token}
      aria-pressed={following}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-60 ${pad} ${
        following
          ? "border border-border text-muted-foreground hover:text-foreground"
          : "bg-primary text-primary-foreground hover:opacity-90"
      } ${className ?? ""}`}
    >
      {busy ? (
        <Loader2 width={icon} height={icon} className="animate-spin" />
      ) : following ? (
        <UserCheck width={icon} height={icon} />
      ) : (
        <UserPlus width={icon} height={icon} />
      )}
      {following ? "Segui già" : "Segui"}
    </button>
  )
}
