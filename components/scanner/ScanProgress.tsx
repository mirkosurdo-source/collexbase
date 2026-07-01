"use client"

import { useEffect, useState } from "react"

/**
 * Blocco 40 — animated step-by-step progress shown while the (inline) analysis
 * runs. The backend processes synchronously, so this is a perceived-progress
 * animation that advances through the documented pipeline steps and parks on
 * the last step until the real result arrives.
 */
const STEPS = [
  "Caricamento immagini",
  "OCR e identificazione",
  "Scanner 3D (profondità, riflessi)",
  "Rilevamento difetti",
  "Analisi centratura",
  "Analisi angoli e bordi",
  "Verifica autenticità",
  "Calcolo grading",
  "Stima valore di mercato",
]

export default function ScanProgress({ active }: { active: boolean }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!active) {
      setStep(0)
      return
    }
    // Advance through steps, slowing near the end (park on the last few).
    const id = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s))
    }, 1400)
    return () => clearInterval(id)
  }, [active])

  const percent = Math.round(((step + 1) / STEPS.length) * 100)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">Analisi in corso</h2>
        <span className="text-sm font-medium text-primary">{percent}%</span>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="flex flex-col gap-2">
        {STEPS.map((label, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={current ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
                {current ? <span className="ml-1 animate-pulse">…</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
