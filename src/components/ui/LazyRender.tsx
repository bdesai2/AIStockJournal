import { useEffect, useRef, useState } from 'react'

interface LazyRenderProps {
  children: React.ReactNode
  minHeight?: number
  rootMargin?: string
  className?: string
}

export function LazyRender({
  children,
  minHeight = 180,
  rootMargin = '300px',
  className,
}: LazyRenderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!containerRef.current || isVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [isVisible, rootMargin])

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? children : <div style={{ minHeight }} />}
    </div>
  )
}
