import type { Metadata } from "next"
import { Suspense } from "react"
import ChatPageClient from "./ChatPageClient"

export const metadata: Metadata = {
  title: "Chat | CollexBase",
  description: "Messaggi privati e conversazioni legate a scambi, vendite e aste.",
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
      }
    >
      <ChatPageClient />
    </Suspense>
  )
}
