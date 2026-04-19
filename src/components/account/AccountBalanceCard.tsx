import { useState } from 'react'
import { Edit2, X, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { fmt } from '@/lib/tradeUtils'

interface AccountBalanceCardProps {
  totalPnL: number
}

export function AccountBalanceCard({ totalPnL }: AccountBalanceCardProps) {
  const { selectedAccount, updateAccount } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [newBalance, setNewBalance] = useState(selectedAccount?.starting_balance ?? 10000)
  const [isSaving, setIsSaving] = useState(false)

  if (!selectedAccount) {
    return null
  }

  const accountSize = selectedAccount.starting_balance
  const currentBalance = accountSize + totalPnL
  const gainLoss = totalPnL
  const gainLossPercent = accountSize > 0 ? (gainLoss / accountSize) * 100 : 0

  const handleSave = async () => {
    if (!selectedAccount?.id) return

    setIsSaving(true)
    const ok = await updateAccount(selectedAccount.id, {
      starting_balance: newBalance,
    })
    setIsSaving(false)

    if (ok) {
      setIsEditing(false)
    } else {
      setNewBalance(accountSize)
    }
  }

  const handleCancel = () => {
    setNewBalance(accountSize)
    setIsEditing(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Account</p>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 hover:bg-muted/40 rounded transition-colors"
            title="Edit starting balance"
          >
            <Edit2 className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Balance display or edit input */}
      {!isEditing ? (
        <>
          <div className="space-y-1">
            <p className="text-2xl font-mono font-semibold">{fmt.currency(currentBalance)}</p>
            <p className="text-[10px] text-muted-foreground">
              Start: {fmt.currency(accountSize)}
            </p>
          </div>

          {/* P&L line */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground">P&L</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-mono font-medium ${gainLoss >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}`}>
                {gainLoss >= 0 ? '+' : ''}{fmt.currency(gainLoss)}
              </span>
              <span className={`text-[10px] font-mono ${gainLoss >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}`}>
                ({gainLoss >= 0 ? '+' : ''}{gainLossPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <input
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(parseFloat(e.target.value) || 0)}
            className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Starting balance"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={isSaving || newBalance === accountSize}
              className="flex-1 flex items-center justify-center gap-0.5 bg-primary text-primary-foreground rounded px-2 py-1 text-[9px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-2.5 h-2.5" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-0.5 bg-muted text-muted-foreground rounded px-2 py-1 text-[9px] font-medium hover:bg-muted/80 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
