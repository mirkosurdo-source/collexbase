import { withApiKey, ApiError } from "@/lib/public-api"
import { scanSingle } from "@/lib/scan"

// POST /api/public/advisor/analyze — AI valuation + advice for a single item photo.
// Body: { imageUrl: string, category?: string }
export async function POST(req: Request) {
  return withApiKey(req, "read:advisor", async () => {
    let body: { imageUrl?: string; category?: string }
    try {
      body = await req.json()
    } catch {
      throw new ApiError(400, "Body JSON non valido.")
    }
    const imageUrl = (body.imageUrl || "").trim()
    if (!imageUrl) throw new ApiError(400, "Campo 'imageUrl' obbligatorio.")
    if (!/^https?:\/\//i.test(imageUrl)) throw new ApiError(400, "'imageUrl' deve essere un URL http(s) valido.")

    const result = await scanSingle(imageUrl, body.category)
    return {
      identification: result.identification,
      grading: result.grading,
      value: result.value,
      advisor: result.advisor,
      spark: result.spark,
      isRare: result.isRare,
    }
  })
}
