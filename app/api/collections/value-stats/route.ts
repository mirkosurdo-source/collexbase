import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { getAuthUserId } from "@/lib/auth/request"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"

function unit(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Builds a trend ending exactly at `total`, drifting backwards deterministically.
function trend(total: number, points: number, fmt: (i: number) => string, seedBase: number) {
  const series: { label: string; value: number }[] = []
  for (let i = points - 1; i >= 0; i--) {
    const drift = (unit(seedBase + i * 7.13) - 0.5) * 0.4
    const factor = 1 - (i / points) * 0.25 + drift * (i / points)
    series.push({ label: fmt(i), value: Math.max(0, Math.round(total * Math.max(0.1, factor))) })
  }
  if (series.length) series[series.length - 1].value = total
  return series
}

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()
    const raw = (await CollectionItem.find({ userId }).lean()) as RawItem[]
    const items = raw.map(normalizeItem)

    let totalValue = 0
    const catMap = new Map<string, { category: string; value: number; count: number }>()
    for (const item of items) {
      totalValue += item.currentValue
      const key = item.category
      if (!catMap.has(key)) catMap.set(key, { category: key, value: 0, count: 0 })
      const bucket = catMap.get(key)!
      bucket.value += item.currentValue
      bucket.count += 1
    }

    const valueByCategory = Array.from(catMap.values()).sort((a, b) => b.value - a.value)
    const seed = totalValue + items.length

    const now = new Date()
    const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]

    const ranges = {
      day: trend(totalValue, 24, (i) => `${String((now.getHours() - i + 24) % 24).padStart(2, "0")}:00`, seed + 1),
      week: trend(totalValue, 7, (i) => dayNames[(now.getDay() - i + 7) % 7], seed + 2),
      month: trend(totalValue, 30, (i) => `${30 - i}`, seed + 3),
      year: trend(totalValue, 12, (i) => monthNames[(now.getMonth() - i + 12) % 12], seed + 4),
    }

    return NextResponse.json({
      success: true,
      totalItems: items.length,
      totalValue,
      valueByCategory,
      trend: ranges,
    })
  } catch (error) {
    console.error("[v0] Errore value-stats:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
