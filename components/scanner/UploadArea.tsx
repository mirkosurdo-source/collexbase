"use client"

import type React from "react"
import { useRef, useState } from "react"
import { SCAN_SLOTS } from "./types"

/**
 * Blocco 40 — six-slot photo uploader (front, back, 4 corners).
 *
 * The front photo is required; the rest are optional but improve grading
 * accuracy. Each slot accepts drag & drop or click-to-browse, shows a preview
 * and can be cleared. Files are kept in a parent-owned record keyed by slot.
 */
export default function UploadArea({
  files,
  onChange,
  disabled,
}: {
  files: Record<string, File>
  onChange: (next: Record<string, File>) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SCAN_SLOTS.map((slot, i) => (
        <Slot
          key={slot.key}
          slotKey={slot.key}
          label={slot.label}
          required={i === 0}
          file={files[slot.key]}
          disabled={disabled}
          onSet={(file) => onChange({ ...files, [slot.key]: file })}
          onClear={() => {
            const next = { ...files }
            delete next[slot.key]
            onChange(next)
          }}
        />
      ))}
    </div>
  )
}

function Slot({
  slotKey,
  label,
  required,
  file,
  disabled,
  onSet,
  onClear,
}: {
  slotKey: string
  label: string
  required?: boolean
  file?: File
  disabled?: boolean
  onSet: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const preview = file ? URL.createObjectURL(file) : null

  function handleFiles(list: FileList | null) {
    const f = list?.[0]
    if (f && f.type.startsWith("image/")) onSet(f)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Carica ${label}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) handleFiles(e.dataTransfer.files)
        }}
        className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-input bg-muted/40"
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/60"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview || "/placeholder.svg"} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">Trascina o tocca</span>
        )}
        {file ? (
          <button
            type="button"
            aria-label={`Rimuovi ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-sm text-foreground shadow"
          >
            ×
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
