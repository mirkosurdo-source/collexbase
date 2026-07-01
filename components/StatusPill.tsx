type Tone = "neutral" | "success" | "danger" | "warning"

const STYLES: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
}

export default function StatusPill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
