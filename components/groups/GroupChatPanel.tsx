"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Send, Loader2 } from "lucide-react"
import { chatFetch, usePolling, formatTime } from "@/lib/chat-client"

interface GroupMsg {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string
  body: string
  createdAt: string
}

export default function GroupChatPanel({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<GroupMsg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const d = await chatFetch<{ success: boolean; messages?: GroupMsg[] }>(`/api/groups/${groupId}/messages`)
      if (d.success) setMessages(d.messages || [])
    } catch {
      // ignore
    } finally {
      setLoaded(true)
    }
  }, [groupId])

  usePolling(load, 5000, [groupId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    try {
      const d = await chatFetch<{ success: boolean; message?: GroupMsg }>(`/api/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      })
      if (d.success && d.message) {
        setMessages((prev) => [...prev, d.message!])
        setText("")
      }
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-2xl border border-border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {!loaded ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nessun messaggio. Rompi il ghiaccio!</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {m.senderAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.senderAvatar || "/placeholder.svg"} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {(m.senderName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className={`max-w-[75%] ${mine ? "items-end text-right" : ""}`}>
                  {!mine ? <p className="mb-0.5 text-xs font-medium text-muted-foreground">{m.senderName}</p> : null}
                  <div
                    className={`inline-block rounded-2xl px-3 py-1.5 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              send(e)
            }
          }}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Invia"
        >
          {sending ? <Loader2 className="animate-spin" width={16} height={16} /> : <Send width={16} height={16} />}
        </button>
      </form>
    </div>
  )
}
