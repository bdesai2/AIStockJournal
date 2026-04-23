import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Lightbulb, Image as ImageIcon, Loader2, PlusCircle, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useStrategyStore } from '@/store/strategyStore'
import { useCanAccess } from '@/lib/featureGates'
import type { Strategy, StrategyTag } from '@/types'
import { STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { UpgradeModal } from '@/components/premium/UpgradeModal'

interface StrategyFormState {
  name: string
  description: string
  notes: string
  likelihood_of_success: number
  confidence_level: 1 | 2 | 3 | 4 | 5
  tags: StrategyTag[]
}

const stripHtml = (html: string) => {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    // Allow <style> blocks so users can define CSS in the HTML editor.
    // JavaScript is still blocked: <script> tags and event handler attributes
    // (onclick, onerror, etc.) are stripped by DOMPurify's default config.
    ADD_TAGS: ['style'],
    FORCE_BODY: true,
  })

const EMPTY_FORM: StrategyFormState = {
  name: '',
  description: '',
  notes: '',
  likelihood_of_success: 0,
  confidence_level: 3,
  tags: [],
}

export function StrategiesPage() {
  const navigate = useNavigate()
  const { user, subscription } = useAuthStore()
  const {
    strategies,
    loading,
    error,
    fetchStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    uploadScreenshot,
    deleteScreenshot,
  } = useStrategyStore()

  // Feature access check
  const canCreateStrategies = useCanAccess('STRATEGY_LIBRARY', subscription?.tier)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view')
  const [form, setForm] = useState<StrategyFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchStrategies(user.id)
    }
  }, [user?.id, fetchStrategies])

  const selectedStrategy: Strategy | undefined = useMemo(
    () => (selectedId ? strategies.find((s) => s.id === selectedId) : undefined),
    [strategies, selectedId]
  )

  useEffect(() => {
    // In view/edit modes, auto-select the first strategy if none is selected yet.
    // In create mode we keep selection empty so the new form starts blank.
    if (mode !== 'create' && !selectedId && strategies.length > 0) {
      setSelectedId(strategies[0].id)
    }
  }, [strategies, selectedId, mode])

  useEffect(() => {
    if (selectedStrategy) {
      // Merge legacy separate fields into unified notes field on load
      const legacyParts: string[] = [
        selectedStrategy.setup_rules,
        selectedStrategy.entry_conditions,
        selectedStrategy.exit_conditions,
        selectedStrategy.strengths,
        selectedStrategy.weaknesses,
      ].filter(Boolean) as string[]
      const notes = legacyParts.join('')

      setForm({
        name: selectedStrategy.name,
        description: selectedStrategy.description ?? '',
        notes,
        likelihood_of_success: selectedStrategy.likelihood_of_success ?? 0,
        confidence_level: (selectedStrategy.confidence_level as StrategyFormState['confidence_level']) ?? 3,
        tags: selectedStrategy.tags ?? [],
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [selectedStrategy?.id])

  const startNew = () => {
    if (!canCreateStrategies) {
      setShowUpgradeModal(true)
      return
    }
    setEditingId(null)
    setSelectedId(null)
    setMode('create')
    setForm(EMPTY_FORM)
  }

  const handleSelect = (strategy: Strategy) => {
    setSelectedId(strategy.id)
    setEditingId(null)
    setMode('view')
  }

  const handleChange = (field: keyof StrategyFormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tag: StrategyTag) => {
    setForm((prev) => {
      const has = prev.tags.includes(tag)
      return {
        ...prev,
        tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      }
    })
  }

  const handleSave = async () => {
    if (!user?.id) return
    if (!form.name.trim()) return

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updateStrategy(editingId, {
          name: form.name.trim(),
          description: form.description || undefined,
          setup_rules: form.notes || undefined,
          entry_conditions: undefined,
          exit_conditions: undefined,
          strengths: undefined,
          weaknesses: undefined,
          likelihood_of_success: Number.isFinite(form.likelihood_of_success)
            ? form.likelihood_of_success
            : undefined,
          confidence_level: form.confidence_level,
          tags: form.tags,
        })
        if (updated) {
          setMode('view')
          setEditingId(null)
        }
      } else {
        const created = await createStrategy({
          user_id: user.id,
          name: form.name.trim(),
          description: form.description || undefined,
          setup_rules: form.notes || undefined,
          entry_conditions: undefined,
          exit_conditions: undefined,
          strengths: undefined,
          weaknesses: undefined,
          likelihood_of_success: Number.isFinite(form.likelihood_of_success) ? form.likelihood_of_success : undefined,
          confidence_level: form.confidence_level,
          tags: form.tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        if (created) {
          setSelectedId(created.id)
          setEditingId(null)
          setMode('view')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    const strategy = strategies.find((s) => s.id === editingId)
    if (!strategy) return
    if (!window.confirm(`Delete strategy "${strategy.name}"? This cannot be undone.`)) return
    const ok = await deleteStrategy(editingId)
    if (ok) {
      setEditingId(null)
      setSelectedId(null)
      setMode('view')
      setForm(EMPTY_FORM)
    }
  }

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !selectedStrategy?.id) return
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    for (const file of files) {
      await uploadScreenshot(user.id, selectedStrategy.id, file)
    }
    e.target.value = ''
  }

  const currentScreenshots = selectedStrategy?.screenshots ?? []
  const diagramScreenshots = currentScreenshots.filter((s: any) => s.label === 'diagram')
  const exampleScreenshots = currentScreenshots.filter((s: any) => s.label !== 'diagram')

  const handleDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !selectedStrategy?.id) return
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    for (const file of files) {
      await uploadScreenshot(user.id, selectedStrategy.id, file, 'diagram')
    }
    e.target.value = ''
  }

  return (
    <div className="p-6 space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-wider">STRATEGIES</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Codify your playbook with clear rules, visuals, and examples.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          New Strategy
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px,minmax(0,1fr)] gap-4">
        {/* Strategy list */}
        <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 max-h-[calc(100vh-200px)] overflow-auto">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-1 mb-1">
            Your playbook
          </p>
          {loading && strategies.length === 0 && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading strategies…
            </div>
          )}
          {!loading && strategies.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 py-4">
              No strategies yet. Create your first one to document a setup.
            </p>
          )}
          {strategies.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded-md text-xs flex flex-col gap-0.5 border border-transparent hover:border-primary/40 hover:bg-accent/40 transition-colors',
                selectedId === s.id ? 'border-primary/60 bg-accent/60' : ''
              )}
            >
              <span className="font-medium text-foreground text-[13px] truncate">{s.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {stripHtml(s.description ?? '') || 'No description yet'}
              </span>
            </button>
          ))}
        </div>

        {/* Editor / view + diagram */}
        <div className="space-y-4">
          {/* View mode: cheatsheet-style strategy card */}
          {mode === 'view' && selectedStrategy && (
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-display tracking-wide mb-1">{selectedStrategy.name}</h2>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Confidence: <span className="font-mono font-semibold text-foreground">{selectedStrategy.confidence_level ?? 3}/5</span></span>
                      {typeof selectedStrategy.likelihood_of_success === 'number' && (
                        <span>Win rate: <span className="font-mono font-semibold text-foreground">{selectedStrategy.likelihood_of_success}%</span></span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreateStrategies) {
                        setShowUpgradeModal(true)
                        return
                      }
                      if (!selectedStrategy) return
                      setEditingId(selectedStrategy.id)
                      setMode('edit')
                    }}
                    className="px-3 py-1.5 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                </div>

                {selectedStrategy.description && (
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {selectedStrategy.description}
                  </p>
                )}
              </div>

              {/* Notes */}
              {selectedStrategy.setup_rules && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div
                    className="strategy-notes"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedStrategy.setup_rules) }}
                  />
                </div>
              )}

              {/* Tags */}
              {selectedStrategy.tags && selectedStrategy.tags.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStrategy.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-primary/15 text-primary/90 border border-primary/30"
                      >
                        {STRATEGY_TAG_LABELS[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit/create mode: strategy form */}
          {(mode === 'edit' || mode === 'create') && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Strategy details
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Name the setup, describe it in rich detail, and capture your exact rules.
                </p>
              </div>
              {saving && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Opening Range Breakout"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="High-level overview of when and why you trade this setup."
                  rows={3}
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Document setup rules, entry &amp; exit conditions, strengths, and weaknesses. Use the HTML view for full control.
                </p>
                <RichTextEditor
                  value={form.notes}
                  onChange={(val) => handleChange('notes', val)}
                  placeholder="Describe your setup rules, entry conditions, exit logic, strengths, and weaknesses…"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Strategy tags</label>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Choose which playbook tags best describe this strategy.
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(STRATEGY_TAG_LABELS).map(([key, label]) => {
                    const tag = key as StrategyTag
                    const isActive = form.tags.includes(tag)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium transition-colors border',
                          isActive
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-input border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Confidence level</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleChange('confidence_level', level)}
                      className={cn(
                        'flex-1 py-1.5 text-[11px] rounded-md border text-center',
                        form.confidence_level === level
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-input text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Likelihood of success</span>
                  <span className="text-[10px] text-muted-foreground">Estimated win rate for this setup</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={form.likelihood_of_success}
                    onChange={(e) => handleChange('likelihood_of_success', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[11px] font-mono">
                    {form.likelihood_of_success}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 mt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name.trim() || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/60 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
                  {editingId ? 'Save changes' : 'Create strategy'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Diagram + screenshots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Strategy diagram</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Upload your own diagram images that visually explain this setup.
              </p>

              {!selectedStrategy?.id && (
                <p className="text-[11px] text-muted-foreground/80">
                  Save the strategy first, then you can upload diagram images.
                </p>
              )}

              {selectedStrategy?.id && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-1.5 rounded-md border border-dashed border-border hover:border-primary/60 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <ImageIcon className="w-3 h-3" />
                    Add diagram image
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleDiagramUpload}
                    />
                  </label>

                  {diagramScreenshots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {diagramScreenshots.map((s: any) => (
                        <div key={s.id} className="relative group">
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={s.url}
                              alt={s.label ?? 'strategy diagram'}
                              className="w-full max-h-80 object-contain rounded-md border border-border hover:border-primary/50 transition-colors"
                            />
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteScreenshot(s.id, s.storage_path)}
                            className="absolute top-1 right-1 bg-background/80 rounded-full px-1 py-0.5 text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/80">
                      No diagram images yet. Upload one or more annotated charts showing the ideal setup.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Screenshots</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Attach annotated charts or examples that illustrate the strategy in action.
              </p>

              {!selectedStrategy?.id && (
                <p className="text-[11px] text-muted-foreground/80">
                  Save the strategy first, then you can upload screenshots.
                </p>
              )}

              {selectedStrategy?.id && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-1.5 rounded-md border border-dashed border-border hover:border-primary/60 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <ImageIcon className="w-3 h-3" />
                    Add screenshots
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleScreenshotUpload}
                    />
                  </label>

                  {exampleScreenshots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {exampleScreenshots.map((s: any) => (
                        <div key={s.id} className="relative group">
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={s.url}
                              alt={s.label ?? 'strategy screenshot'}
                              className="w-28 h-20 object-cover rounded-md border border-border hover:border-primary/50 transition-colors"
                            />
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteScreenshot(s.id, s.storage_path)}
                            className="absolute top-1 right-1 bg-background/80 rounded-full px-1 py-0.5 text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/80">
                      No screenshots yet. Upload examples once the strategy is saved.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade modal for Strategy Library */}
      {showUpgradeModal && (
        <UpgradeModal
          isOpen={true}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            setShowUpgradeModal(false)
            navigate('/pricing')
          }}
        />
      )}
    </div>
  )
}
