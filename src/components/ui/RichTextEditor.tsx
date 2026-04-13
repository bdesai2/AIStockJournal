import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Keep DOM in sync when the external value changes (e.g. switching strategies)
  useEffect(() => {
    if (!ref.current) return
    const next = value || ''
    if (ref.current.innerHTML !== next) {
      ref.current.innerHTML = next
    }
  }, [value])

  const emitChange = () => {
    if (!ref.current) return
    onChange(ref.current.innerHTML)
  }

  const exec = (command: string, arg?: string) => {
    // Ensure focus so commands apply
    if (ref.current) {
      ref.current.focus()
    }
    document.execCommand(command, false, arg)
    emitChange()
  }

  const handleInput: React.FormEventHandler<HTMLDivElement> = (e) => {
    onChange((e.target as HTMLDivElement).innerHTML)
  }

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    // Normalize empty content to empty string
    const html = (e.target as HTMLDivElement).innerHTML
    if (!html || html === '<br>') {
      onChange('')
    }
  }

  return (
    <div className={cn('border border-border rounded-md bg-input', className)}>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border/80 bg-card/40">
        <button
          type="button"
          onClick={() => exec('bold')}
          className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          U
        </button>
        <span className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          1. List
        </button>
        <span className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={() => exec('foreColor', '#00d4a1')}
          className="px-1.5 py-0.5 rounded text-[11px] text-[#00d4a1] hover:bg-accent/60"
        >
          Green
        </button>
        <button
          type="button"
          onClick={() => exec('foreColor', '#ff4d6d')}
          className="px-1.5 py-0.5 rounded text-[11px] text-[#ff4d6d] hover:bg-accent/60"
        >
          Red
        </button>
        <button
          type="button"
          onClick={() => exec('removeFormat')}
          className="ml-auto px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div
        ref={ref}
        className="px-3 py-2 text-sm min-h-[80px] max-h-[260px] overflow-auto focus:outline-none whitespace-pre-wrap leading-relaxed"
        contentEditable
        onInput={handleInput}
        onBlur={handleBlur}
        data-placeholder={placeholder}
      />
    </div>
  )
}
