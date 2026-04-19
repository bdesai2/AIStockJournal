import { useEffect, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { Code2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [showHtml, setShowHtml] = useState(false)
  const [htmlValue, setHtmlValue] = useState(value)
  const quillRef = useRef<ReactQuill>(null)

  useEffect(() => {
    setHtmlValue(value)
  }, [value])

  const handleQuillChange = (content: string) => {
    onChange(content)
    setHtmlValue(content)
  }

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value
    setHtmlValue(newHtml)
    onChange(newHtml)
  }

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['link'],
      ['clean'],
    ],
  }

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'blockquote',
    'code-block',
    'list',
    'bullet',
    'indent',
    'link',
  ]

  return (
    <div className={cn('border border-border rounded-md overflow-hidden bg-input', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/80 bg-card/40">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mr-auto">
          Rich editor
        </span>
        <button
          type="button"
          onClick={() => setShowHtml(!showHtml)}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
            showHtml
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          )}
        >
          {showHtml ? <Code2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showHtml ? 'HTML' : 'View HTML'}
        </button>
      </div>

      {/* Editor or HTML textarea */}
      {showHtml ? (
        <textarea
          value={htmlValue}
          onChange={handleHtmlChange}
          placeholder={placeholder || 'Enter HTML...'}
          className="w-full px-3 py-2 text-xs font-mono min-h-[200px] max-h-[400px] bg-input text-foreground border-0 focus:outline-none resize-none"
        />
      ) : (
        <div className="ql-editor-wrapper">
          <ReactQuill
            ref={quillRef}
            value={value}
            onChange={handleQuillChange}
            modules={modules}
            formats={formats}
            placeholder={placeholder || 'Enter content...'}
            theme="snow"
            style={{
              height: '200px',
              background: 'var(--input-bg)',
              color: 'var(--foreground)',
            }}
          />
        </div>
      )}

      <style>{`
        .ql-editor-wrapper :global(.ql-container) {
          border: none;
          font-size: 14px;
          background: var(--input-bg, #000);
        }
        .ql-editor-wrapper :global(.ql-editor) {
          padding: 12px;
          min-height: 200px;
          max-height: 400px;
          color: var(--foreground, #fff);
          background: var(--input-bg, #000);
        }
        .ql-editor-wrapper :global(.ql-editor::before) {
          color: var(--muted-foreground, #888);
        }
        .ql-editor-wrapper :global(.ql-toolbar) {
          border: 1px solid var(--border, #333);
          background: var(--card, #1a1a1a);
        }
        .ql-editor-wrapper :global(.ql-toolbar button) {
          color: var(--muted-foreground, #888);
        }
        .ql-editor-wrapper :global(.ql-toolbar button:hover) {
          color: var(--foreground, #fff);
        }
        .ql-editor-wrapper :global(.ql-toolbar button.ql-active) {
          color: var(--primary, #3b82f6);
        }
        .ql-editor-wrapper :global(.ql-toolbar.ql-snow) {
          padding: 8px;
        }
        .ql-editor-wrapper :global(.ql-editor ul),
        .ql-editor-wrapper :global(.ql-editor ol) {
          padding-left: 20px;
          margin: 8px 0;
        }
        .ql-editor-wrapper :global(.ql-editor li) {
          margin-bottom: 4px;
        }
        .ql-editor-wrapper :global(.ql-editor code) {
          background: var(--muted, #2a2a2a);
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace;
        }
        .ql-editor-wrapper :global(.ql-editor blockquote) {
          border-left: 3px solid var(--primary, #3b82f6);
          padding-left: 12px;
          margin: 8px 0;
          color: var(--muted-foreground, #888);
        }
        .ql-editor-wrapper :global(.ql-editor pre) {
          background: var(--muted, #2a2a2a);
          border-radius: 4px;
          padding: 8px;
          margin: 8px 0;
          overflow-x: auto;
        }
      `}</style>
    </div>
  )
}
