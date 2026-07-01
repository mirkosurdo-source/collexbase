import { NextResponse } from "next/server"
import { getBoostForTarget, isBoostTargetType } from "@/lib/boost"

/** Public: returns the active boost for a given target (or null). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ targetType: string; targetId: string }> },
) {
  try {
    const { targetType, targetId } = await params
    if (!isBoostTargetType(targetType)) {
      return NextResponse.json({ success: false, message: "Tipo non valido." }, { status: 400 })
    }
    const boost = await getBoostForTarget(targetType, targetId)
    return NextResponse.json({ success: true, boost })
  } catch (error) {
    console.error("[v0] boost/for-target error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
