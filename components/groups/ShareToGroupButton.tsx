"use client"

import { useState } from "react"
import { Share2, Loader2, Check, X } from "lucide-react"
import { chatFetch } from "@/lib/chat-client"

interface MyGroup {
  id: string
  name: string
  category: string
  coverImage: string
}

/**
 * Lets a user repost a community post into one of their groups as a "showcase"
 * group post. Reuses the group posts API (Blocco 30).
 */
export default function ShareToGroupButton({
  postId,
  postExcerpt,
  postTitle,
  postImages = [],
}: {
  postId: string
  postExcerpt: string
  postTitle?: string
  postImages?: string[]
}) {
  const sourceUrl = `/community/post/${postId}`
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<MyGroup[] | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  async function openDialog() {
    setOpen(true)
    if (groups) return
    try {
      const d = await chatFetch<{ success: boolean; groups?: MyGroup[] }>("/api/groups/mine")
      setGroups(d.success ? d.groups || [] : [])
    } catch {
      setGroups([])
    }
  }

  async function share(groupId: string) {
    setSharingId(groupId)
    try {
      const body = [postExcerpt, `\nDalla community: ${sourceUrl}`].filter(Boolean).join("\n")
      const d = await chatFetch<{ success: boolean }>(`/api/groups/${groupId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          kind: "showcase",
          title: postTitle || "",
          body,
          images: postImages.slice(0, 4),
        }),
      })
      if (d.success) {
        setDoneId(groupId)
        setTimeout(() => {
          setOpen(false)
          setDoneId(null)
        }, 900)
      }
    } catch {
      // ignore
    } finally {
      setSharingId(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center text-muted-foreground transition-colors hover:text-primary"
        aria-label="Condividi in un gruppo"
        title="Condividi in un gruppo"
      >
        <Share2 width={18} height={18} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Condividi in un gruppo"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Condividi in un gruppo</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                aria-label="Chiudi"
              >
                <X width={16} height={16} />
              </button>
            </div>

            {groups === null ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Non fai parte di nessun gruppo. Unisciti a un gruppo per condividere qui.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => share(g.id)}
                      disabled={sharingId !== null}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {g.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.coverImage || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-primary/15 to-accent/20" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{g.category}</p>
                      </div>
                      {doneId === g.id ? (
                        <Check width={16} height={16} className="text-primary" />
                      ) : sharingId === g.id ? (
                        <Loader2 className="animate-spin text-muted-foreground" width={16} height={16} />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
