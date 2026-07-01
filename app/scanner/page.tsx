"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import UploadArea from "@/components/scanner/UploadArea"
import ScanProgress from "@/components/scanner/ScanProgress"
import ScanResultView from "@/components/scanner/ScanResultView"
import { SCAN_SLOTS, type ScanResult } from "@/components/scanner/types"

const CATEGORIES = ["carte", "funko pop", "statuette", "modellini", "monete/banconote", "altro"]

export default function ScannerPage() {
  const router = useRouter()
  const [files, setFiles] = useState<Record<string, File>>({})
  const [category, setCategory] = useState("carte")
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [resultImages, setResultImages] = useState<string[]>([])
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) router.replace("/login")
  }, [token, router])

  // Ordered list of selected files (front first), used for upload + previews.
  const orderedFiles = useMemo(
    () => SCAN_SLOTS.map((s) => files[s.key]).filter((f): f is File => Boolean(f)),
    [files],
  )
  const hasFront = Boolean(files[SCAN_SLOTS[0].key])

  const startScan = useCallback(async () => {
    if (!token || !hasFront || scanning) return
    setScanning(true)
    setError("")
    setResult(null)

    const localPreviews = orderedFiles.map((f) => URL.createObjectURL(f))

    try {
      const fd = new FormData()
      fd.append("category", category)
      for (const f of orderedFiles) fd.append("images", f)

      const res = await fetch("/api/scanner/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (res.ok && data.success && data.result) {
        setResult(data.result as ScanResult)
        setResultImages(localPreviews)
      } else {
        setError(data.message || "Analisi non riuscita. Riprova.")
      }
    } catch {
      setError("Errore di rete. Riprova.")
    } finally {
      setScanning(false)
    }
  }, [token, hasFront, scanning, orderedFiles, category])

  function reset() {
    setFiles({})
    setResult(null)
    setResultImages([])
    setError("")
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground text-balance">Scanner 3D / OCR</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Grading automatico professionale: identificazione, centratura, angoli, bordi, superficie,
          difetti, autenticità e valore di mercato.
        </p>
      </header>

      {!result && !scanning ? (
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label htmlFor="category" className="text-sm font-medium text-card-foreground">
                Categoria
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Carica fino a 6 foto. Il <strong className="text-foreground">fronte</strong> è obbligatorio;
              retro e angoli migliorano la precisione del grading.
            </p>

            <UploadArea files={files} onChange={setFiles} disabled={scanning} />
          </section>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={startScan}
            disabled={!hasFront}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Avvia scansione ({orderedFiles.length}/6)
          </button>
        </div>
      ) : null}

      {scanning ? <ScanProgress active={scanning} /> : null}

      {result && !scanning ? (
        <div className="flex flex-col gap-5">
          <ScanResultView result={result} images={resultImages} />
          <button
            type="button"
            onClick={reset}
            className="self-start rounded-lg border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Nuova scansione
          </button>
        </div>
      ) : null}
    </main>
  )
}
