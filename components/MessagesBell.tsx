"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

interface ConversationItem {
  _id: string
  otherUserId: string
  otherUsername: string
  otherAvatar: string
  lastMessage: string
  lastSenderId: string
  lastMessageAt: string
  unread: number
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "ora"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min fa`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h fa`
  const days = Math.floor(hours / 24)
  return `${days} g fa`
}

function initials(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase()
}

export default function MessagesBell() {
  const [token, setToken] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ConversationItem[]>([])
  const [unread, setUnread] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToken(localStorage.getItem("token"))
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setItems((data.conversations || []).slice(0, 6))
        setUnread(data.totalUnread || 0)
      }
    } catch {
      // Silent: the navbar should never break.
    }
  }, [token])

  // Poll for new messages every 20s.
  useEffect(() => {
    if (!token) return
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [token, load])

  // Close the panel on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  // Hide for logged-out visitors.
  if (!token) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Messaggi${unread > 0 ? `, ${unread} non letti` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Messaggi</span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessuna conversazione.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((c) => (
                  <li key={c._id} className={c.unread > 0 ? "bg-accent/40" : ""}>
                    <Link
                      href={`/messages/${c._id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {c.otherAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.otherAvatar || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(c.otherUsername)
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{c.otherUsername}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                        </span>
                        <span
                          className={`truncate text-xs ${c.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                        >
                          {c.lastSenderId && c.lastSenderId !== c.otherUserId ? "Tu: " : ""}
                          {c.lastMessage || "Nessun messaggio"}
                        </span>
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                          {c.unread > 9 ? "9+" : c.unread}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 text-center">
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-foreground transition-colors hover:underline"
            >
              Vedi tutti
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
