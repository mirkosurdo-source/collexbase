"use client"

import { useState } from "react"

export type ProfileUser = {
  id: string
  name: string
  username: string
  email: string
  bio?: string
  birthdate?: string
  address?: string
  avatar?: string
}

type Props = {
  user: ProfileUser
  onCancel: () => void
  onSaved: (user: ProfileUser) => void
}

function toDateInputValue(value?: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export default function EditProfileClient({ user, onCancel, onSaved }: Props) {
  const [name, setName] = useState(user.name ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [birthdate, setBirthdate] = useState(toDateInputValue(user.birthdate))
  const [address, setAddress] = useState(user.address ?? "")
  const [avatar, setAvatar] = useState(user.avatar ?? "")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (name.trim().length < 2) {
      setError("Il nome deve avere almeno 2 caratteri.")
      return
    }
    if (bio.length > 500) {
      setError("La bio non può superare i 500 caratteri.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      setError("Sessione scaduta. Effettua di nuovo l'accesso.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, bio, birthdate, address, avatar }),
      })
      const data = await res.json()

      if (data.success) {
        onSaved(data.user)
      } else {
        setError(data.message || "Aggiornamento non riuscito.")
      }
    } catch {
      setError("Errore di rete. Riprova più tardi.")
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
  const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-400"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          Nome
        </label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="avatar" className={labelClass}>
          Avatar (URL)
        </label>
        <input
          id="avatar"
          type="url"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <p className="mt-1 text-right text-xs text-neutral-400">{bio.length}/500</p>
      </div>

      <div>
        <label htmlFor="birthdate" className={labelClass}>
          Data di nascita
        </label>
        <input
          id="birthdate"
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="address" className={labelClass}>
          Indirizzo
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
