"use client"

import { useState } from "react"
import BoostDialog from "@/components/boost/BoostDialog"
import type { BoostTargetType } from "@/lib/models/BoostActivation"

const TARGET_LABEL: Record<BoostTargetType, string> = {
  marketplace: "Boost annuncio",
  auction: "Boost asta",
  trade: "Boost scambio",
  showcase: "Boost vetrina",
}

/** Owner-facing button that opens the boost purchase dialog. */
export default function BoostButton({
  targetType,
  targetId,
  onActivated,
  className = "",
  size = "md",
  label,
}: {
  targetType: BoostTargetType
  targetId?: string
  onActivated?: () => void
  className?: string
  size?: "sm" | "md"
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-amber-500 font-semibold text-amber-950 transition-colors hover:bg-amber-400 ${pad} ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
        </svg>
        {label ?? TARGET_LABEL[targetType]}
      </button>
      <BoostDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={targetId}
        onActivated={() => {
          onActivated?.()
        }}
      />
    </>
  )
}
