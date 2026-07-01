"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tutte" },
  { value: "chat", label: "Chat" },
  { value: "trade", label: "Scambi" },
  { value: "marketplace", label: "Marketplace" },
  { value: "auction", label: "Aste" },
  { value: "payment", label: "Pagamenti" },
  { value: "escrow", label: "Escrow" },
  { value: "moderation", label: "Moderazione" },
  { value: "message", label: "Messaggi" },
  { value: "system", label: "Sistema" },
]

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setToken(t)
    setChecked(true)
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const query = filter ? `?type=${filter}&limit=100` : "?limit=100"
      const res = await fetch(`/api/notifications${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setItems(data.notifications || [])
        setUnread(data.unreadCount || 0)
      }
    } catch {
      // Ignore.
    } finally {
      setLoading(false)
    }
  }, [token, filter])

  useEffect(() => {
    if (token) load()
  }, [token, load])

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

  if (!checked) return null

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifiche</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} non lette` : "Tutto letto"}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Segna tutte come lette
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Caricamento...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nessuna notifica in questa categoria.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {TYPE_LABELS[n.type] || "Sistema"}
                    </span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-destructive" aria-label="Non letta" />}
                  </div>
                  <span className="text-sm font-medium text-foreground">{n.title}</span>
                  {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
                  <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                </div>
              </div>
            )
            return (
              <li
                key={n._id}
                className={`relative rounded-lg border border-border p-4 transition-colors ${
                  n.read ? "bg-card" : "bg-accent/40"
                }`}
              >
                {n.link ? (
                  <Link href={n.link} onClick={() => markRead(n._id)} className="block pr-9 hover:opacity-90">
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead(n._id)} className="block w-full pr-9 text-left">
                    {inner}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteItem(n._id)}
                  aria-label="Elimina notifica"
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  )
}
