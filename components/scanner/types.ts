/** Blocco 40 — client-side shape of a completed scan result (no server deps). */
export interface ScanResult {
  cardIdentified: {
    name: string
    set: string
    number: string
    year: number
    variant: string
    imageMatchConfidence: number
  }
  grading: {
    overall: number
    centering: number
    corners: number
    edges: number
    surface: number
  }
  centering: {
    left: number
    right: number
    top: number
    bottom: number
    percent: number
    deviation: number
  }
  defects: {
    whitening: number
    scratches: number
    dents: number
    edgeWear: number
    holoScratches: number
    printLines: number
  }
  authenticity: {
    holoPattern: number
    printPattern: number
    fontMatch: number
    borderMatch: number
    authenticityScore: number
  }
  marketValue: {
    raw: number
    graded: number
    grade10: number
    grade9: number
    grade8: number
    history: { date: string; value: number }[]
  }
  notes: string
}

/** The six photo slots the scanner accepts. */
export interface ScanSlot {
  key: string
  label: string
}

export const SCAN_SLOTS: ScanSlot[] = [
  { key: "front", label: "Fronte" },
  { key: "back", label: "Retro" },
  { key: "topLeft", label: "Angolo alto sx" },
  { key: "topRight", label: "Angolo alto dx" },
  { key: "bottomLeft", label: "Angolo basso sx" },
  { key: "bottomRight", label: "Angolo basso dx" },
]
