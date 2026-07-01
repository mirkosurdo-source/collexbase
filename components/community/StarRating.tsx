"use client"

import { Star } from "lucide-react"

interface StarRatingProps {
  value: number
  /** When provided, the component is interactive and reports the chosen rating. */
  onChange?: (value: number) => void
  size?: number
  className?: string
}

/** Read-only or interactive 1-5 star rating. */
export default function StarRating({ value, onChange, size = 16, className = "" }: StarRatingProps) {
  const interactive = typeof onChange === "function"
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value)
        const StarIcon = (
          <Star
            width={size}
            height={size}
            className={filled ? "fill-chart-4 text-chart-4" : "fill-transparent text-muted-foreground"}
          />
        )
        if (!interactive) {
          return <span key={star}>{StarIcon}</span>
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === Math.round(value)}
            aria-label={`${star} stelle`}
            onClick={() => onChange?.(star)}
            className="cursor-pointer transition-transform hover:scale-110"
          >
            {StarIcon}
          </button>
        )
      })}
    </div>
  )
}
