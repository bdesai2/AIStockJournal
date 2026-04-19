import { Crown } from 'lucide-react'

interface ProBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline'
  showText?: boolean
  className?: string
}

export function ProBadge({
  size = 'sm',
  variant = 'solid',
  showText = true,
  className = '',
}: ProBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-2.5 py-1.5 text-sm gap-1.5',
    lg: 'px-3 py-2 text-base gap-2',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const variantClasses = {
    solid:
      'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30',
    outline: 'border border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20',
  }

  return (
    <div
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      <Crown className={iconSizes[size]} />
      {showText && <span>Pro</span>}
    </div>
  )
}
