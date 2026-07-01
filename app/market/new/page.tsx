"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CATEGORIES } from "@/lib/collection-helpers"

const CONDITIONS = ["Nuovo", "Come nuovo", "Ottimo", "Buono", "Discreto", "Rovinato"]
const RARITIES = ["Comune", "Non comune", "Raro", "Ultra raro", "Leggendario"]

export default function NewListingPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  const [form, setForm] = useState({
    itemName: "",
    description: "",
    category: "",
    condition: "Ottimo",
    rarity: "Comune",
    year: "",
    value: "",
    image: "",
    price: "",
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [photoInput, setPhotoInput] = useState("")
  const [acceptsTrade, setAcceptsTrade] = useState(false)
  const [acceptsItemPlusCash, setAcceptsItemPlusCash] = useState(false)
  const [acceptsItemPlusCoins, setAcceptsItemPlusCoins] = useState(false)

  const [aiPrice, setAiPrice] = useState<{ suggested: number; min: number; max: number; rationale: string[] } | null>(
    null,
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setToken(t)
  }, [router])

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addPhoto() {
    const url = photoInput.trim()
    if (url && photos.length < 8) {
      setPhotos((prev) => [...prev, url])
      setPhotoInput("")
    }
  }

  async function suggestPrice() {
    setError("")
    const value = Number(form.value)
    if (!Number.isFinite(value) || value <= 0) {
      setError("Inserisci prima un valore stimato per ottenere il prezzo AI.")
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/market/ai/price", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          value,
          category: form.category,
          condition: form.condition,
          rarity: form.rarity,
          year: form.year ? Number(form.year) : null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAiPrice(data.suggestion)
        if (!form.price) update("price", String(data.suggestion.suggested))
      } else {
        setError(data.message || "Impossibile calcolare il prezzo AI.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.itemName.trim()) {
      setError("Il nome dell'oggetto è obbligatorio.")
      return
    }
    const price = Number(form.price)
    if (!Number.isFinite(price) || price <= 0) {
      setError("Inserisci un prezzo valido.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/market/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          year: form.year ? Number(form.year) : null,
          value: form.value ? Number(form.value) : 0,
          price,
          photos,
          acceptsTrade,
          acceptsItemPlusCash,
          acceptsItemPlusCoins,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/market/item/${data.listing._id}`)
      } else {
        setError(data.message || "Impossibile pubblicare l'annuncio.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
  const labelClass = "mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"

  return (
    <div className="py-10">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Nuovo annuncio</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Pubblica un oggetto in vendita, scambio o offerta mista.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label className={labelClass} htmlFor="itemName">
              Nome oggetto
            </label>
            <input id="itemName" value={form.itemName} onChange={(e) => update("itemName", e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="description">
              Descrizione
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="category">
                Categoria
              </label>
              <select id="category" value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                <option value="">Seleziona...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="condition">
                Stato
              </label>
              <select id="condition" value={form.condition} onChange={(e) => update("condition", e.target.value)} className={inputClass}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="rarity">
                Rarità
              </label>
              <select id="rarity" value={form.rarity} onChange={(e) => update("rarity", e.target.value)} className={inputClass}>
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="year">
                Anno
              </label>
              <input id="year" type="number" value={form.year} onChange={(e) => update("year", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="image">
              Immagine principale (URL)
            </label>
            <input id="image" value={form.image} onChange={(e) => update("image", e.target.value)} className={inputClass} placeholder="https://..." />
          </div>

          <div>
            <label className={labelClass}>Foto aggiuntive ({photos.length}/8)</label>
            <div className="flex gap-2">
              <input
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
                className={inputClass}
                placeholder="URL foto aggiuntiva"
              />
              <button
                type="button"
                onClick={addPhoto}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Aggiungi
              </button>
            </div>
            {photos.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <li
                    key={`${p}-${i}`}
                    className="flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    <span className="max-w-[160px] truncate">{p}</span>
                    <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Rimuovi foto">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="value">
                Valore stimato €
              </label>
              <input id="value" type="number" value={form.value} onChange={(e) => update("value", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="price">
                Prezzo di vendita €
              </label>
              <input id="price" type="number" value={form.price} onChange={(e) => update("price", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* AI price advisor */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Prezzo AI consigliato</p>
              <button
                type="button"
                onClick={suggestPrice}
                disabled={aiLoading}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {aiLoading ? "Calcolo..." : "Calcola"}
              </button>
            </div>
            {aiPrice && (
              <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                <p className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                  € {aiPrice.suggested}{" "}
                  <span className="text-sm font-normal text-neutral-500">
                    (range € {aiPrice.min}–€ {aiPrice.max})
                  </span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                  {aiPrice.rationale.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Deal modes */}
          <fieldset className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <legend className="px-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Modalità accettate</legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={acceptsTrade} onChange={(e) => setAcceptsTrade(e.target.checked)} />
                Accetta scambi
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={acceptsItemPlusCash} onChange={(e) => setAcceptsItemPlusCash(e.target.checked)} />
                Accetta oggetto + denaro
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={acceptsItemPlusCoins} onChange={(e) => setAcceptsItemPlusCoins(e.target.checked)} />
                Accetta oggetto + monete
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {busy ? "Pubblicazione..." : "Pubblica annuncio"}
          </button>
        </form>
      </div>
    </div>
  )
}
