"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import MessageItem, { type ChatMessage } from "@/components/messages/MessageItem"
import OfferComposer from "@/components/messages/OfferComposer"

interface OtherUser {
  _id: string
  otherUserId: string
  otherUsername: string
  otherAvatar: string
  isSeller: boolean
  otherTyping: boolean
  activeNegotiation: boolean
}

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🔥", "🎉", "😎", "🤝", "💰", "📦", "❤️", "😅", "🤔", "👌", "✨"]

function initials(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase()
}

export default function ChatThreadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const conversationId = params?.id as string

  const [token, setToken] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState("")
  const [other, setOther] = useState<OtherUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [busyOffer, setBusyOffer] = useState(false)
  const [error, setError] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [composer, setComposer] = useState<{ mode: "new" | "counter"; messageId?: string } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const messageCountRef = useRef(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastTypingPing = useRef(0)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.push("/login")
      return
    }
    setToken(t)
    // Decode the userId from the JWT payload (best-effort, no verification needed client-side).
    try {
      const payload = JSON.parse(atob(t.split(".")[1]))
      setCurrentUserId(payload.userId || "")
    } catch {
      setCurrentUserId("")
    }
  }, [router])

  const markRead = useCallback(
    async (t: string) => {
      try {
        await fetch("/api/messages/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ id: conversationId }),
        })
      } catch {
        // Ignore.
      }
    },
    [conversationId],
  )

  const load = useCallback(async () => {
    if (!token || !conversationId) return
    try {
      const res = await fetch(`/api/messages/thread?id=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setOther(data.conversation)
        setMessages(data.messages || [])
        markRead(token)
      } else {
        setError(data.message || "Conversazione non trovata.")
      }
    } catch {
      setError("Errore di caricamento.")
    } finally {
      setLoading(false)
    }
  }, [token, conversationId, markRead])

  useEffect(() => {
    if (!token) return
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [token, load])

  // Auto-scroll when new messages arrive or typing indicator toggles.
  useEffect(() => {
    if (messages.length !== messageCountRef.current) {
      messageCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const pingTyping = useCallback(() => {
    if (!token) return
    const now = Date.now()
    if (now - lastTypingPing.current < 2500) return
    lastTypingPing.current = now
    fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversationId, typing: true }),
    }).catch(() => {})
  }, [token, conversationId])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !token || sending) return
    setSending(true)
    setError("")
    setText("")
    setShowEmoji(false)
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, text: trimmed }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message || "Invio non riuscito.")
        setText(trimmed)
      } else {
        await load()
      }
    } catch {
      setError("Errore di rete.")
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  async function uploadFile(file: File, kind: "image" | "attachment") {
    if (!token) return
    setSending(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("conversationId", conversationId)
      const res = await fetch(kind === "image" ? "/api/messages/send-image" : "/api/messages/send-attachment", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!data.success) setError(data.message || "Caricamento non riuscito.")
      else await load()
    } catch {
      setError("Errore durante il caricamento.")
    } finally {
      setSending(false)
    }
  }

  async function offerAction(endpoint: string, messageId: string) {
    if (!token) return
    setBusyOffer(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, messageId }),
      })
      const data = await res.json()
      if (!data.success) setError(data.message || "Operazione non riuscita.")
      else await load()
    } catch {
      setError("Errore di rete.")
    } finally {
      setBusyOffer(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col py-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/messages"
          className="inline-flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Indietro
        </Link>
        {other && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {other.otherAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.otherAvatar || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(other.otherUsername)
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{other.otherUsername}</span>
                {other.isSeller && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Venditore
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {other.otherTyping ? "sta scrivendo..." : other.activeNegotiation ? "Trattativa in corso" : "Online di recente"}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento messaggi...</p>
        ) : error && messages.length === 0 ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nessun messaggio. Scrivi qualcosa o fai una proposta per iniziare.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageItem
                key={m._id}
                message={m}
                currentUserId={currentUserId}
                busy={busyOffer}
                onPreviewImage={(url) => setPreview(url)}
                onAccept={(id) => offerAction("/api/messages/offer/accept", id)}
                onReject={(id) => offerAction("/api/messages/offer/reject", id)}
                onWithdraw={(id) => offerAction("/api/messages/offer/withdraw", id)}
                onCounter={(id) => setComposer({ mode: "counter", messageId: id })}
              />
            ))}
          </ul>
        )}
        {other?.otherTyping && messages.length > 0 && (
          <p className="mt-3 text-xs italic text-muted-foreground">{`${other.otherUsername} sta scrivendo...`}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && messages.length > 0 && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* Proposal bar */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setComposer({ mode: "new" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Fai una proposta
        </button>
        <button
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Foto
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Allegato
        </button>
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="relative mt-3 flex items-end gap-2">
        {showEmoji && (
          <div className="absolute bottom-14 left-0 z-10 grid grid-cols-8 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setText((prev) => prev + emoji)
                  setShowEmoji(false)
                }}
                className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent"
          aria-label="Emoji"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            pingTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={1}
          placeholder="Scrivi un messaggio..."
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Invia
        </button>
      </form>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file, "image")
          e.target.value = ""
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file, "attachment")
          e.target.value = ""
        }}
      />

      {/* Image lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || "/placeholder.svg"} alt="Anteprima" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      )}

      {/* Offer composer */}
      {composer && token && (
        <OfferComposer
          token={token}
          conversationId={conversationId}
          mode={composer.mode}
          originalMessageId={composer.messageId}
          onClose={() => setComposer(null)}
          onSent={load}
        />
      )}
    </div>
  )
}
