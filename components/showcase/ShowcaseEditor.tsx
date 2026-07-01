"use client"

import { useEffect, useState } from "react"
import { chatFetch } from "@/lib/chat-client"

interface EditorItem {
  id: string
  name: string
  image: string
  category: string
  rarity: string
  currentValue: number
}

interface ShowcaseSettings {
  title: string
  description: string
  theme: string
  visibility: "public" | "private" | "disabled"
  featuredItems: string[]
}

export default function ShowcaseEditor({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [themes, setThemes] = useState<string[]>([])
  const [maxFeatured, setMaxFeatured] = useState(12)
  const [items, setItems] = useState<EditorItem[]>([])
  const [settings, setSettings] = useState<ShowcaseSettings>({
    title: "",
    description: "",
    theme: "Custom",
    visibility: "disabled",
    featuredItems: [],
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    chatFetch<{
      success: boolean
      themes: string[]
      maxFeatured: number
      items: EditorItem[]
      showcase: ShowcaseSettings
    }>("/api/showcase")
      .then((res) => {
        if (res.success) {
          setThemes(res.themes)
          setMaxFeatured(res.maxFeatured)
          setItems(res.items)
          setSettings(res.showcase)
        }
      })
      .catch(() => setError("Impossibile caricare la vetrina."))
      .finally(() => setLoading(false))
  }, [open])

  function toggleFeatured(id: string) {
    setSettings((s) => {
      const has = s.featuredItems.includes(id)
      if (has) return { ...s, featuredItems: s.featuredItems.filter((x) => x !== id) }
      if (s.featuredItems.length >= maxFeatured) return s
      return { ...s, featuredItems: [...s.featuredItems, id] }
    })
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      const res = await chatFetch<{ success: boolean; error?: string }>("/api/showcase", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
      if (res.success) {
        onSaved()
        onClose()
      } else {
        setError(res.error || "Errore durante il salvataggio.")
      }
    } catch {
      setError("Errore durante il salvataggio.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Modifica vetrina</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent" aria-label="Chiudi">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">Caricamento…</div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Titolo</label>
              <input
                value={settings.title}
                onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
                maxLength={80}
                placeholder="La mia vetrina"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Descrizione</label>
              <textarea
                value={settings.description}
                onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
                maxLength={600}
                rows={3}
                placeholder="Racconta la tua collezione…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Tema</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  {themes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Visibilità</label>
                <select
                  value={settings.visibility}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, visibility: e.target.value as ShowcaseSettings["visibility"] }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="public">Pubblica</option>
                  <option value="private">Privata (solo gruppi)</option>
                  <option value="disabled">Disattivata</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Pezzi in evidenza</label>
                <span className="text-xs text-muted-foreground">
                  {settings.featuredItems.length}/{maxFeatured}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nessun oggetto nella collezione da esporre.
                </p>
              ) : (
                <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                  {items.map((it) => {
                    const idx = settings.featuredItems.indexOf(it.id)
                    const selected = idx >= 0
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => toggleFeatured(it.id)}
                        className={`relative overflow-hidden rounded-lg border-2 text-left transition-colors ${
                          selected ? "border-primary" : "border-transparent hover:border-border"
                        }`}
                      >
                        <div className="aspect-square bg-muted">
                          {it.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image || "/placeholder.svg"} alt={it.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent/20" />
                          )}
                        </div>
                        {selected ? (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                            {idx + 1}
                          </span>
                        ) : null}
                        <p className="truncate px-1 py-0.5 text-[11px] text-foreground">{it.name}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva vetrina"}
          </button>
        </footer>
      </div>
    </div>
  )
}
