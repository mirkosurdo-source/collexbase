import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { verifyToken } from "@/lib/auth/jwt"

const PAGE_SIZE = 10

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  value_asc: { value: 1 },
  value_desc: { value: -1 },
  year_asc: { year: 1 },
  year_desc: { year: -1 },
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("query")?.trim() || ""
    const category = searchParams.get("category")?.trim() || ""
    const condition = searchParams.get("condition")?.trim() || ""
    const yearMin = parseNumber(searchParams.get("yearMin"))
    const yearMax = parseNumber(searchParams.get("yearMax"))
    const valueMin = parseNumber(searchParams.get("valueMin"))
    const valueMax = parseNumber(searchParams.get("valueMax"))
    const sort = searchParams.get("sort") || "name_asc"

    let page = parseNumber(searchParams.get("page")) ?? 1
    if (page < 1) page = 1

    // Base filter: always scope to the authenticated user
    const filter: Record<string, unknown> = { userId: decoded.userId }

    // Text search across name, category, year and condition
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(escaped, "i")
      const orConditions: Record<string, unknown>[] = [
        { name: regex },
        { category: regex },
        { condition: regex },
      ]
      const numericQuery = Number(query)
      if (Number.isFinite(numericQuery)) {
        orConditions.push({ year: numericQuery })
      }
      filter.$or = orConditions
    }

    if (category) {
      filter.category = new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    }

    if (condition) {
      filter.condition = new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    }

    // Year range
    const yearFilter: Record<string, number> = {}
    if (yearMin !== null) yearFilter.$gte = yearMin
    if (yearMax !== null) yearFilter.$lte = yearMax
    if (Object.keys(yearFilter).length > 0) filter.year = yearFilter

    // Value range
    const valueFilter: Record<string, number> = {}
    if (valueMin !== null) valueFilter.$gte = valueMin
    if (valueMax !== null) valueFilter.$lte = valueMax
    if (Object.keys(valueFilter).length > 0) filter.value = valueFilter

    const sortOption = SORT_MAP[sort] || SORT_MAP.name_asc

    const total = await CollectionItem.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > totalPages) page = totalPages

    const items = await CollectionItem.find(filter)
      .sort(sortOption)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)

    return NextResponse.json(
      {
        success: true,
        items,
        total,
        page,
        totalPages,
        pageSize: PAGE_SIZE,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore search collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
