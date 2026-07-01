"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Profile {
  _id: string
  name: string
  username: string
  email: string
  bio: string
  birthdate: string
  address: string
  avatar: string
  visibility: "public" | "private"
}

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Pubblico", hint: "Chiunque può vedere il tuo profilo e la tua collezione." },
  { value: "private", label: "Privato", hint: "Solo tu puoi vedere la tua collezione." },
] as const

export default function ProfileEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [bio, setBio] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [address, setAddress] = useState("")
  const [avatar, setAvatar] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [username, setUsername] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    async function load() {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          router.replace("/login")
          return
        }
        const data = await res.json()
        const user: Profile = data.user
        setName(user.name || "")
        setEmail(user.email || "")
        setBio(user.bio || "")
        setBirthdate(user.birthdate ? user.birthdate.slice(0, 10) : "")
        setAddress(user.address || "")
        setAvatar(user.avatar || "")
        setVisibility(user.visibility === "private" ? "private" : "public")
        setUsername(user.username || "")
      } catch {
        setError("Impossibile caricare il profilo.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  function validate(): string | null {
    if (!name.trim() || name.trim().length < 2) return "Il nome deve avere almeno 2 caratteri."
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Inserisci un'email valida."
    if (bio.length > 500) return "La bio non può superare i 500 caratteri."
    if (birthdate) {
      const d = new Date(birthdate)
      if (Number.isNaN(d.getTime())) return "Data di nascita non valida."
      if (d > new Date()) return "La data di nascita non può essere nel futuro."
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/profile/update-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email, bio, birthdate, address, avatar, visibility }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Impossibile salvare le modifiche.")
        return
      }
      setSuccess("Profilo aggiornato con successo.")
    } catch {
      setError("Errore di rete. Riprova.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">Caricamento profilo...</div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modifica profilo</h1>
          <p className="text-sm text-muted-foreground">Aggiorna le tue informazioni e le impostazioni di visibilità.</p>
        </div>
        {username ? (
          <Link
            href={`/u/${username}`}
            className="rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Vedi profilo pubblico
          </Link>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar || "/placeholder.svg"} alt="Anteprima avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                {name ? name.charAt(0).toUpperCase() : "?"}
              </div>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="avatar" className="mb-1 block text-sm font-medium text-foreground">
              URL avatar
            </label>
            <input
              id="avatar"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </div>
        </div>

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
            Nome
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1 block text-sm font-medium text-foreground">
            Bio <span className="text-muted-foreground">({bio.length}/500)</span>
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="birthdate" className="mb-1 block text-sm font-medium text-foreground">
              Data di nascita
            </label>
            <input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </div>
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-foreground">
              Indirizzo
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-foreground">Visibilità profilo</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {VISIBILITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors ${
                  visibility === opt.value
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                    className="accent-foreground"
                  />
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-green-600 dark:text-green-500">{success}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </button>
          <Link
            href="/profile"
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  )
}
