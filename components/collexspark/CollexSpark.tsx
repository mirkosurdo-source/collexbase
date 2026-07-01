"use client"

import Image from "next/image"

// The seven official CollexSpark poses (Blocco 22 §1).
export type SparkPose = "happy" | "alert" | "deal" | "auction" | "duplicate" | "wishlist" | "trend"

const POSE_SRC: Record<SparkPose, string> = {
  happy: "/collexspark/happy.png",
  alert: "/collexspark/alert.png",
  deal: "/collexspark/deal.png",
  auction: "/collexspark/auction.png",
  duplicate: "/collexspark/duplicate.png",
  wishlist: "/collexspark/wishlist.png",
  trend: "/collexspark/trend.png",
}

const POSE_ALT: Record<SparkPose, string> = {
  happy: "CollexSpark felice: valore in aumento",
  alert: "CollexSpark in allerta: rischio o calo di valore",
  deal: "CollexSpark: opportunità nel marketplace",
  auction: "CollexSpark: suggerimento asta",
  duplicate: "CollexSpark: duplicati da vendere",
  wishlist: "CollexSpark: oggetto della wishlist disponibile",
  trend: "CollexSpark: analisi dei trend di valore",
}

const SIZE_PX: Record<NonNullable<CollexSparkProps["size"]>, number> = {
  sm: 64,
  md: 112,
  lg: 168,
  xl: 240,
}

export interface CollexSparkProps {
  pose?: SparkPose
  size?: "sm" | "md" | "lg" | "xl"
  /** Optional speech-bubble message shown next to the avatar. */
  message?: string
  /** Disable the idle float animation. */
  still?: boolean
  className?: string
}

/**
 * CollexSpark — the official AI Advisor mascot (Blocco 22).
 * Renders one of seven expressive poses with an optional speech bubble.
 */
export default function CollexSpark({ pose = "happy", size = "md", message, still, className }: CollexSparkProps) {
  const px = SIZE_PX[size]

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <div className={`relative shrink-0 ${still ? "" : "animate-spark-float"}`} style={{ width: px, height: px }}>
        <Image
          src={POSE_SRC[pose] || "/placeholder.svg"}
          alt={POSE_ALT[pose]}
          width={px}
          height={px}
          className="h-full w-full object-contain drop-shadow-md"
          priority={size === "xl"}
        />
      </div>

      {message ? (
        <div className="relative max-w-xs rounded-2xl border border-border bg-card px-4 py-2.5 text-sm leading-relaxed text-card-foreground shadow-sm">
          <span
            aria-hidden="true"
            className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card"
          />
          {message}
        </div>
      ) : null}
    </div>
  )
}
