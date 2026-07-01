"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  chatFetch,
  usePolling,
  type ChatAttachment,
  type ChatMessageDTO,
  type ChatThreadDTO,
  type ChatUserDTO,
} from "@/lib/chat-client"
import ChatHeader from "./ChatHeader"
import ChatMessageList from "./ChatMessageList"
import ChatInput from "./ChatInput"

export default function ChatWindow({
  threadId,
  currentUserId,
  backHref = "/chat",
  onActivity,
}: {
  threadId: string
  currentUserId: string
  backHref?: string
  onActivity?: () => void
}) {
  const [thread, setThread] = useState<ChatThreadDTO | null>(null)
  const [otherUser, setOtherUser] = useState<ChatUserDTO | null>(null)
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [blocked, setBlocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lastTimeRef = useRef<string | null>(null)
  // Simulated presence: derived from the other user's recent activity.
  const [online, setOnline] = useState(false)

  const mergeMessages = useCallback((incoming: ChatMessageDTO[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) map.set(m.id, m)
      return Array.from(map.values()).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    })
  }, [])

  const markRead = useCallback(async () => {
    await chatFetch("/api/chat/read", { method: "POST", body: JSON.stringify({ threadId }) }).catch(() => {})
  }, [threadId])

  const poll = useCallback(async () => {
    const since = lastTimeRef.current
    const url = `/api/chat/thread/${threadId}${since ? `?since=${encodeURIComponent(since)}` : ""}`
    const res = await chatFetch<{
      success: boolean
      thread?: ChatThreadDTO
      otherUser?: ChatUserDTO | null
      blocked?: boolean
      messages?: ChatMessageDTO[]
      serverTime?: string
    }>(url)
    if (!res.success) return
    if (res.thread) setThread(res.thread)
    if (res.otherUser !== undefined) setOtherUser(res.otherUser ?? null)
    if (typeof res.blocked === "boolean") setBlocked(res.blocked)
    if (res.messages && res.messages.length > 0) {
      mergeMessages(res.messages)
      const newest = res.messages[res.messages.length - 1]
      // If the other user sent something recently, treat them as "online".
      const fromOther = res.messages.some((m) => m.senderId !== currentUserId)
      if (fromOther) setOnline(true)
      lastTimeRef.current = newest.createdAt
      await markRead()
      onActivity?.()
    }
    if (res.serverTime && !lastTimeRef.current) lastTimeRef.current = res.serverTime
    setLoaded(true)
  }, [threadId, mergeMessages, markRead, currentUserId, onActivity])

  // Reset when the thread changes.
  useEffect(() => {
    setMessages([])
    setThread(null)
    setOtherUser(null)
    setBlocked(false)
    setLoaded(false)
    lastTimeRef.current = null
    void markRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  usePolling(poll, 4000, [threadId])

  async function handleSend(text: string, attachments: ChatAttachment[]): Promise<boolean> {
    const res = await chatFetch<{ success: boolean; message?: ChatMessageDTO | string }>("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ threadId, text, attachments }),
    })
    if (res.success && typeof res.message === "object") {
      mergeMessages([res.message])
      lastTimeRef.current = res.message.createdAt
      onActivity?.()
      return true
    }
    return false
  }

  async function block() {
    if (!otherUser) return
    await chatFetch("/api/chat/block", { method: "POST", body: JSON.stringify({ targetUserId: otherUser.id }) })
    setBlocked(true)
  }
  async function unblock() {
    if (!otherUser) return
    await chatFetch("/api/chat/unblock", { method: "POST", body: JSON.stringify({ targetUserId: otherUser.id }) })
    setBlocked(false)
  }

  const suspended = thread?.status === "suspended"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        thread={thread}
        otherUser={otherUser}
        blocked={blocked}
        online={online}
        onBlock={block}
        onUnblock={unblock}
        backHref={backHref}
      />
      {loaded ? (
        <ChatMessageList messages={messages} currentUserId={currentUserId} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Caricamento messaggi…</div>
      )}
      <ChatInput
        threadId={threadId}
        disabled={blocked || suspended}
        disabledReason={suspended ? "Questa conversazione è stata sospesa da un moderatore." : blocked ? "Hai bloccato questo utente o sei stato bloccato." : undefined}
        onSend={handleSend}
      />
    </div>
  )
}
