"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

interface NotificationItem {
  _id: string
  type: "auction" | "trade" | "message" | "system" | "chat" | "marketplace" | "payment" | "escrow" | "moderation"
  title: string
  body?: string
  link?: string
  context?: { kind: string; id: string } | null
  read: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  auction: "Asta",
  trade: "Scambio",
  message: "Messaggio",
  system: "Sistema",
  chat: "Chat",
  marketplace: "Marketplace",
  payment: "Pagamento",
  escrow: "Escrow",
  moderation: "Moderazione",
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

export default function NotificationBell() {
  const [token, setToken] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // Tracks the most recent server time we've seen, for incremental ?since polling.
  const sinceRef = useRef<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem("token"))
  }, [])

  // Full (re)load of the latest notifications — used on mount and after actions.
  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/notifications?limit=8", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setItems(data.notifications || [])
        setUnread(data.unreadCount || 0)
        if (data.serverTime) sinceRef.current = data.serverTime
      }
    } catch {
      // Silent: the bell should never break the navbar.
    }
  }, [token])

  // Lightweight incremental poll: only fetch notifications newer than `since`.
  const poll = useCallback(async () => {
    if (!token) return
    try {
      const since = sinceRef.current
      const query = since ? `?since=${encodeURIComponent(since)}&limit=8` : "?limit=8"
      const res = await fetch(`/api/notifications${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) return
      if (data.serverTime) sinceRef.current = data.serverTime
      const fresh: NotificationItem[] = data.notifications || []
      if (fresh.length > 0) {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p._id))
          const merged = [...fresh.filter((f) => !seen.has(f._id)), ...prev]
          return merged.slice(0, 8)
        })
      }
      // unreadCount is authoritative from the server.
      setUnread(data.unreadCount || 0)
    } catch {
      // Silent.
    }
  }, [token])

  // Initial load, then lightweight incremental polling every 15s.
  useEffect(() => {
    if (!token) return
    load()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [token, load, poll])

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

  async function markAllRead() {
    if (!token) return
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
    } catch {
      // Ignore.
    }
  }

  async function markRead(id: string) {
    if (!token) return
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      setUnread((prev) => Math.max(0, prev - 1))
    } catch {
      // Ignore.
    }
  }

  async function deleteItem(id: string) {
    if (!token) return
    const target = items.find((n) => n._id === id)
    setItems((prev) => prev.filter((n) => n._id !== id))
    if (target && !target.read) setUnread((prev) => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Ignore: optimistic removal already applied.
    }
  }

  // Hide the bell entirely for logged-out visitors.
  if (!token) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifiche${unread > 0 ? `, ${unread} non lette` : ""}`}
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
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
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
            <span className="text-sm font-semibold">Notifiche</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Segna tutte come lette
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessuna notifica.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const content = (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {TYPE_LABELS[n.type] || "Sistema"}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{n.title}</span>
                      {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                    </div>
                  )
                  return (
                    <li key={n._id} className={`group relative ${n.read ? "" : "bg-accent/40"}`}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            markRead(n._id)
                            setOpen(false)
                          }}
                          className="block px-4 py-3 pr-9 transition-colors hover:bg-accent"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markRead(n._id)}
                          className="block w-full px-4 py-3 pr-9 text-left transition-colors hover:bg-accent"
                        >
                          {content}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteItem(n._id)}
                        aria-label="Elimina notifica"
                        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-foreground transition-colors hover:underline"
            >
              Vedi tutte
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
