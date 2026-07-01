"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { chatFetch } from "@/lib/chat-client"
import { CATEGORIES } from "@/lib/collection-helpers"

export default function CreateGroupDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [privacy, setPrivacy] = useState<"public" | "private">("public")
  const [coverImage, setCoverImage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 3) {
      setError("Il nome deve avere almeno 3 caratteri.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await chatFetch<{ success: boolean; group?: { id: string }; message?: string }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name, description, category, privacy, coverImage }),
      })
      if (res.success && res.group) {
        router.push(`/groups/${res.group.id}`)
      } else {
        setError(res.message || "Impossibile creare il gruppo.")
        setSubmitting(false)
      }
    } catch {
      setError("Errore di rete. Riprova.")
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Crea un nuovo gruppo"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Crea un gruppo</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent" aria-label="Chiudi">
            <X width={18} height={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="g-name" className="mb-1 block text-sm font-medium text-foreground">
              Nome
            </label>
            <input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Es. Collezionisti Pokémon Italia"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="g-desc" className="mb-1 block text-sm font-medium text-foreground">
              Descrizione
            </label>
            <textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Di cosa parla il gruppo?"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="g-cat" className="mb-1 block text-sm font-medium text-foreground">
                Categoria
              </label>
              <select
                id="g-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {CATEGORIES.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="g-priv" className="mb-1 block text-sm font-medium text-foreground">
                Privacy
              </label>
              <select
                id="g-priv"
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as "public" | "private")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="public">Pubblico</option>
                <option value="private">Privato (su invito)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="g-cover" className="mb-1 block text-sm font-medium text-foreground">
              Immagine di copertina (URL, opzionale)
            </label>
            <input
              id="g-cover"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" width={16} height={16} /> : null}
              Crea gruppo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
