import { useState } from 'react'
import { X, Trash2, Plus, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface ManageAccountsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ManageAccountsModal({ isOpen, onClose }: ManageAccountsModalProps) {
  const {
    user,
    accounts,
    selectedAccountId,
    createAccount,
    deleteAccount,
    updateAccount,
  } = useAuthStore()

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('10000')
  const [newAccountBroker, setNewAccountBroker] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBroker, setEditBroker] = useState('')

  if (!isOpen || !user?.id) return null

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      setError('Account name is required')
      return
    }
    if (!newAccountBalance || Number(newAccountBalance) <= 0) {
      setError('Starting balance must be greater than 0')
      return
    }

    setIsCreating(true)
    setError(null)
    const created = await createAccount(user.id, newAccountName, Number(newAccountBalance), newAccountBroker || undefined)
    setIsCreating(false)

    if (created) {
      setNewAccountName('')
      setNewAccountBalance('10000')
      setNewAccountBroker('')
    } else {
      setError('Failed to create account')
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!window.confirm(`Delete account "${accounts.find(a => a.id === accountId)?.account_name}"? This cannot be undone.`)) {
      return
    }

    setIsDeleting(accountId)
    setError(null)
    const ok = await deleteAccount(accountId)
    setIsDeleting(null)

    if (!ok) {
      setError('Failed to delete account')
    }
  }

  const handleSaveEdit = async (accountId: string) => {
    if (!editName.trim()) {
      setError('Account name is required')
      return
    }

    const ok = await updateAccount(accountId, {
      account_name: editName,
      broker: editBroker || undefined,
    })

    if (ok) {
      setEditingId(null)
      setEditName('')
      setEditBroker('')
    } else {
      setError('Failed to update account')
    }
  }

  const handleEditClick = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (account) {
      setEditingId(accountId)
      setEditName(account.account_name)
      setEditBroker(account.broker || '')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg border border-border max-w-lg w-full max-h-[600px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-display tracking-wider">Manage Accounts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Create New Account */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Create New Account</h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Account Name</label>
              <input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g., IB Main, TD Swing Trading"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Starting Balance ($)</label>
              <input
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                type="number"
                step="100"
                min="0"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Broker (Optional)</label>
              <input
                value={newAccountBroker}
                onChange={(e) => setNewAccountBroker(e.target.value)}
                placeholder="e.g., IBKR, TD Ameritrade"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              onClick={handleCreateAccount}
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Account
            </button>
          </div>

          {/* Existing Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Your Accounts ({accounts.length})</h3>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedAccountId === account.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-border/80'
                    }`}
                  >
                    {editingId === account.id ? (
                      // Edit mode
                      <div className="space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          value={editBroker}
                          onChange={(e) => setEditBroker(e.target.value)}
                          placeholder="Broker"
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(account.id)}
                            className="flex-1 px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null)
                              setEditName('')
                              setEditBroker('')
                            }}
                            className="flex-1 px-3 py-1.5 rounded text-xs border border-border hover:bg-accent"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => handleEditClick(account.id)}>
                          <p className="font-medium text-sm">{account.account_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {account.broker && `${account.broker} · `}
                            Starting balance: ${account.starting_balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                          {selectedAccountId === account.id && (
                            <p className="text-xs text-primary mt-1">Currently selected</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditClick(account.id)}
                            className="p-1.5 rounded hover:bg-accent transition-colors"
                            title="Edit account"
                          >
                            {/* Edit icon */}
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {accounts.length > 1 && (
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              disabled={isDeleting === account.id || selectedAccountId === account.id}
                              className="p-1.5 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={selectedAccountId === account.id ? 'Cannot delete selected account' : 'Delete account'}
                            >
                              {isDeleting === account.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
