import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Settings } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface AccountSelectorProps {
  onManageClick: () => void
}

export function AccountSelector({ onManageClick }: AccountSelectorProps) {
  const { selectedAccount, accounts, setSelectedAccount } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      })
    }
  }, [isOpen])

  if (!selectedAccount || accounts.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors text-sm"
      >
        <span className="truncate max-w-[120px] text-foreground">{selectedAccount.account_name}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="fixed w-56 rounded-lg border border-border bg-card shadow-2xl z-[99999]"
          style={{
            top: `${position.top}px`,
            right: `${position.right}px`
          }}
        >
          {/* Account List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  setSelectedAccount(account.id)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  selectedAccount.id === account.id
                    ? 'bg-primary/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{account.account_name}</span>
                  {selectedAccount.id === account.id && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {account.broker && `${account.broker} · `}
                  Balance: ${account.starting_balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-1 pb-1">
            {/* Create New Account */}
            <button
              onClick={() => {
                onManageClick()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Account
            </button>

            {/* Manage Accounts */}
            <button
              onClick={() => {
                onManageClick()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Accounts
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[99998]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
