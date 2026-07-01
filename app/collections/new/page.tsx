"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
const labelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300"

export default function NewCollectionPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    year: "",
    value: "",
    condition: "",
    image: "",
  })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (form.name.trim().length < 1) {
      setError("Il nome dell'oggetto è obbligatorio.")
      return
    }
    if (form.year && Number.isNaN(Number(form.year))) {
      setError("L'anno deve essere un numero.")
      return
    }
    if (form.value && Number.isNaN(Number(form.value))) {
      setError("Il valore deve essere un numero.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/collections/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (data.success) {
        router.push("/collections")
      } else {
        setError(data.message || "Impossibile aggiungere l'oggetto.")
      }
    } catch {
      setError("Impossibile aggiungere l'oggetto.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/collections" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna alle collezioni
        </Link>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Nuovo oggetto
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className={labelClass}>
                Nome *
              </label>
              <input id="name" className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className={labelClass}>
                Descrizione
              </label>
              <textarea
                id="description"
                rows={3}
                className={inputClass}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="category" className={labelClass}>
                  Categoria
                </label>
                <input
                  id="category"
                  className={inputClass}
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="condition" className={labelClass}>
                  Condizione
                </label>
                <input
                  id="condition"
                  className={inputClass}
                  value={form.condition}
                  onChange={(e) => update("condition", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="year" className={labelClass}>
                  Anno
                </label>
                <input
                  id="year"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.year}
                  onChange={(e) => update("year", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="value" className={labelClass}>
                  Valore (€)
                </label>
                <input
                  id="value"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.value}
                  onChange={(e) => update("value", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="image" className={labelClass}>
                URL immagine
              </label>
              <input
                id="image"
                className={inputClass}
                value={form.image}
                onChange={(e) => update("image", e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {submitting ? "Salvataggio..." : "Aggiungi oggetto"}
              </button>
              <Link
                href="/collections"
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Annulla
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
