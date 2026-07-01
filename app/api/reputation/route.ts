import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Reputation from "@/lib/models/Reputation"
import { computeReputation, reputationTier } from "@/lib/reputation"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username") || ""
    const refresh = searchParams.get("refresh") === "1"

    if (!username) return NextResponse.json({ error: "Username mancante." }, { status: 400 })

    await connectDB()

    const user = await User.findOne({ username }).select("_id username name avatar bio createdAt")
    if (!user) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 })

    let rep = await Reputation.findOne({ userId: user._id }).lean()

    // Compute on first access or when explicitly refreshed / stale (>1h).
    const stale =
      !rep || refresh || (rep && Date.now() - new Date((rep as { computedAt: string }).computedAt).getTime() > 3600_000)

    if (stale) {
      const computed = await computeReputation(String(user._id))
      rep = {
        ...computed,
        userId: user._id,
        computedAt: new Date(),
      } as unknown as typeof rep
    }

    const score = (rep as { score?: number })?.score ?? 0

    return NextResponse.json({
      user: {
        id: String(user._id),
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        memberSince: user.createdAt,
      },
      reputation: {
        score,
        tier: (rep as { tier?: string })?.tier ?? reputationTier(score),
        avgRating: (rep as { avgRating?: number })?.avgRating ?? 0,
        reviewCount: (rep as { reviewCount?: number })?.reviewCount ?? 0,
        salesCount: (rep as { salesCount?: number })?.salesCount ?? 0,
        tradesCount: (rep as { tradesCount?: number })?.tradesCount ?? 0,
        communityPoints: (rep as { communityPoints?: number })?.communityPoints ?? 0,
        history: (rep as { history?: { label: string; value: number }[] })?.history ?? [],
      },
    })
  } catch (err) {
    console.error("[v0] reputation error:", err)
    return NextResponse.json({ error: "Errore durante il caricamento della reputazione." }, { status: 500 })
  }
}
