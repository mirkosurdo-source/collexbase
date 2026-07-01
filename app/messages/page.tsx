"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface ConversationItem {
  _id: string
  otherUserId: string
  otherUsername: string
  otherAvatar: string
  isSeller: boolean
  lastMessage: string
  lastSenderId: string
  lastMessageAt: string
  unread: number
  activeNegotiation: boolean
  otherTyping: boolean
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

export default function MessagesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.push("/login")
      return
    }
    setToken(t)
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch {
      // Ignore.
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [token, load])

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messaggi</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento conversazioni...</p>
      ) : conversations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Non hai ancora nessuna conversazione. Inizia a messaggiare con altri collezionisti dalle pagine del
            marketplace o della community.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {conversations.map((c) => (
            <li key={c._id}>
              <Link
                href={`/messages/${c._id}`}
                className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-base font-semibold text-muted-foreground">
                  {c.otherAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.otherAvatar || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(c.otherUsername)
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground">{c.otherUsername}</span>
                      {c.isSeller && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Venditore
                        </span>
                      )}
                      {c.activeNegotiation && (
                        <span className="shrink-0 rounded-full bg-chart-4/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chart-4">
                          Trattativa
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                  </span>
                  <span
                    className={`truncate text-sm ${
                      c.otherTyping
                        ? "italic text-primary"
                        : c.unread > 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {c.otherTyping ? (
                      "sta scrivendo..."
                    ) : (
                      <>
                        {c.lastSenderId && c.lastSenderId !== c.otherUserId ? "Tu: " : ""}
                        {c.lastMessage || "Nessun messaggio"}
                      </>
                    )}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                    {c.unread > 9 ? "9+" : c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
