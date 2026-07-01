// Canonical collectible categories shown across public profiles.
export const CATEGORIES = [
  "Pokémon",
  "One Piece",
  "Labubu",
  "LEGO",
  "Funko Pop",
  "Manga",
  "Fumetti",
  "Videogiochi retro",
  "Console retro",
  "Monete",
  "Banconote",
  "Francobolli",
  "Orologi",
  "Sneakers",
  "Modellini",
  "Memorabilia",
] as const

export type RawItem = Record<string, unknown>

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

// Deterministic pseudo-random in [0,1) from a string seed (stable across renders).
function seededUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * Builds a stable value-history series ending at currentValue. Used for the
 * item value chart when no real history has been recorded yet.
 */
export function buildValueHistory(currentValue: number, seed: string, points = 12): { label: string; value: number }[] {
  const series: { label: string; value: number }[] = []
  const now = new Date()
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(now.getMonth() - i)
    // Drift the historical value within +/-25% of the current value.
    const drift = (seededUnit(seed, i) - 0.5) * 0.5
    const factor = 1 - (i / points) * 0.3 + drift * (i / points)
    series.push({
      label: date.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      value: Math.max(0, Math.round(currentValue * Math.max(0.1, factor))),
    })
  }
  series[series.length - 1] = {
    label: now.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
    value: currentValue,
  }
  return series
}

/** Normalizes a raw collection document into the full item shape used by the public UI. */
export function normalizeItem(item: RawItem) {
  const id = String(item._id ?? "")
  const value = num(item.value)
  const currentValue = num(item.currentValue, value)
  return {
    id,
    name: str(item.name, "Oggetto senza nome"),
    description: str(item.description),
    category: str(item.category, "Senza categoria"),
    year: typeof item.year === "number" ? item.year : null,
    image: str(item.image),
    condition: str(item.condition, "—"),
    rarity: str(item.rarity, "Comune"),
    series: str(item.series, "—"),
    set: str(item.set, "—"),
    certification: str(item.certification, "Non certificato"),
    quantity: num(item.quantity, 1),
    paidPrice: num(item.paidPrice, value),
    value,
    currentValue,
    forSale: Boolean(item.forSale),
    forTrade: Boolean(item.forTrade),
    purchaseDate: item.purchaseDate ?? item.createdAt ?? null,
    valueHistory: buildValueHistory(currentValue || value, id || str(item.name)),
  }
}
