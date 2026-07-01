"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, Loader2 } from "lucide-react"

type Props = {
  /** The user to start a private conversation with. */
  targetUserId: string
  /** Optional label override (defaults to "Messaggia"). */
  label?: string
  /** Optional class override for custom styling/placement. */
  className?: string
  /** Render a compact icon-only button. */
  iconOnly?: boolean
}

/**
 * Blocco 29 — universal entry point to start a *private* (non-transactional)
 * chat with any user from the profile, community, followers, etc. It lazily
 * resolves/creates the canonical private thread via the existing Blocco 19
 * engine, then deep-links to the inbox with that thread pre-opened.
 */
export default function MessageUserButton({ targetUserId, label = "Messaggia", className, iconOnly }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function start() {
    if (busy) return
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.push("/login")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/chat/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "private", targetUserId }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.thread) {
        router.push(`/chat?t=${data.thread.id}`)
      } else {
        setError(data.message || "Impossibile avviare la chat.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-label={label}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        )}
        {!iconOnly && <span>{label}</span>}
      </button>
      {error && <span className="mt-1 text-[11px] text-destructive">{error}</span>}
    </span>
  )
}
