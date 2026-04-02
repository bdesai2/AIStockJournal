import { BookOpen } from 'lucide-react'

export function JournalPage() {
  return (
    <div className="p-6 animate-in">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-display tracking-wider">DAILY JOURNAL</h1>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Daily Journal</h3>
        <p className="text-muted-foreground text-sm">
          Calendar-based daily journal with pre/post-market notes is coming in Milestone 2.
        </p>
      </div>
    </div>
  )
}
