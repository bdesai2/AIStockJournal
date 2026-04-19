# Multi-Account Support - Phase 7 Verification Plan

## Overview
This document outlines the complete verification testing for the multi-account implementation across all 6 phases.

---

## Test Scenarios

### 1. Account Creation & Management
**Test Case 1.1: Create First Account**
- [ ] User logs in → authStore initializes
- [ ] `initAuth()` calls `fetchAccounts()`
- [ ] If no accounts exist, auto-create default account
- [ ] First account is auto-selected
- [ ] Account selector in header shows account name

**Test Case 1.2: Create Additional Account**
- [ ] Click account selector → "New Account" button visible
- [ ] Click "New Account" → ManageAccountsModal opens
- [ ] Enter account name (e.g., "TD Swing Trading")
- [ ] Enter starting balance (e.g., 10000)
- [ ] Optional: Enter broker name
- [ ] Click "Create Account"
- [ ] New account appears in list
- [ ] Can immediately select it

**Test Case 1.3: Edit Account Details**
- [ ] Click account selector → "Manage Accounts" button
- [ ] ManageAccountsModal opens showing all accounts
- [ ] Click pencil icon on account → Edit mode activates
- [ ] Edit account name and/or broker
- [ ] Click "Save" → Account updated
- [ ] Changes persist when revisiting
- [ ] AccountBalanceCard shows correct name

**Test Case 1.4: Delete Account**
- [ ] Navigate to Settings → "Manage Accounts"
- [ ] Create 2+ accounts (can't delete if only 1)
- [ ] Click delete icon on non-selected account
- [ ] Confirmation modal appears
- [ ] Confirm deletion
- [ ] Account removed from list and database
- [ ] Associated trades deleted (cascading)
- [ ] Cannot delete currently selected account (button disabled)

---

### 2. Account Switching
**Test Case 2.1: Sweet Switching**
- [ ] Click account selector dropdown
- [ ] See list of accounts with balances
- [ ] Select Account A → App immediately updates
- [ ] Sidebar account name changes
- [ ] Dashboard/trades list updates (now shows Account A trades)
- [ ] Select Account B → Repeats seamlessly
- [ ] LocalStorage saves last selected account

**Test Case 2.2: Account Persistence**
- [ ] Select Account A
- [ ] Navigate to other pages (Dashboard, Trades, Journal)
- [ ] Reload page
- [ ] Account A is still selected (from localStorage)
- [ ] Correct trades show for Account A

**Test Case 2.3: Account Selector Shows Current**
- [ ] Account selector dropdown shows all accounts
- [ ] Currently selected account has blue dot indicator
- [ ] "Currently selected" text appears in account details
- [ ] Switching accounts updates indicator instantly

---

### 3. Trade Isolation
**Test Case 3.1: Create Trade in Account A**
- [ ] Select Account A
- [ ] Log new trade (AAPL, 100 shares, entry 150, exit 155)
- [ ] Trade created successfully
- [ ] Trade appears in Trades page
- [ ] Trade visible in Dashboard
- [ ] Trade in Journal calendar

**Test Case 3.2: Create Trade in Account B**
- [ ] Switch to Account B
- [ ] Create different trade (TSLA, 50 shares, entry 250, exit 260)
- [ ] Trade created for Account B

**Test Case 3.3: Verify Trade Isolation**
- [ ] Switch back to Account A
- [ ] ONLY AAPL trade visible
- [ ] TSLA trade NOT visible
- [ ] Switch to Account B
- [ ] ONLY TSLA trade visible
- [ ] AAPL trade NOT visible
- [ ] Repeat switching: trades stay isolated

**Test Case 3.4: Edit Trade in Account**
- [ ] Select Account A
- [ ] Edit AAPL trade
- [ ] Change quantity, price, notes
- [ ] Save changes
- [ ] Changes persist when switching back to Account A
- [ ] Changes do NOT affect Account B's trades

**Test Case 3.5: Delete Trade**
- [ ] Select Account A
- [ ] Delete AAPL trade
- [ ] Trade removed from Account A
- [ ] Switch to Account B
- [ ] TSLA trade still there (not affected)
- [ ] Switch back to Account A
- [ ] AAPL trade gone

---

### 4. Account-Scoped Statistics

**Test Case 4.1: Dashboard Stats Per Account**
- [ ] Create 3 trades in Account A (2 wins, 1 loss):
  - Trade 1: +$200 (profitable)
  - Trade 2: +$150 (profitable)
  - Trade 3: -$100 (loss)
- [ ] Check Dashboard stats for Account A:
  - Total P&L: +$250
  - Win Rate: 66.7% (2/3)
  - Total Trades: 3

**Test Case 4.2: Different Stats for Account B**
- [ ] Create 2 trades in Account B (1 win, 1 loss):
  - Trade 1: +$500 (profitable)
  - Trade 2: -$200 (loss)
- [ ] Check Dashboard stats for Account B:
  - Total P&L: +$300
  - Win Rate: 50% (1/2)
  - Total Trades: 2
- [ ] Stats are completely different from Account A

**Test Case 4.3: Switch & Verify Stats Update**
- [ ] View Account A dashboard
- [ ] Note stats: 3 trades, +$250 P&L, 66.7% WR
- [ ] Switch to Account B
- [ ] Stats update instantly: 2 trades, +$300 P&L, 50% WR
- [ ] Switch back to Account A
- [ ] Stats revert: 3 trades, +$250 P&L, 66.7% WR

**Test Case 4.4: Account Balance Card Uses Account Starting Balance**
- [ ] Set Account A starting balance: $10,000
- [ ] Create trade with +$500 P&L
- [ ] Account Balance Card shows:
  - Current Balance: $10,500
  - Start: $10,000
  - P&L: +$500
  - Gain: +5%
- [ ] Edit Account A starting balance to $20,000
- [ ] Account Balance Card updates:
  - Current Balance: $20,500
  - Start: $20,000
  - P&L: +$500
  - Gain: +2.5%

---

### 5. Per-Account Risk Calculations

**Test Case 5.1: Risk % Uses Account Starting Balance**
- [ ] Account A starting balance: $10,000
- [ ] Log trade: Entry $100, Stop $95, Qty 100 shares
- [ ] Initial Risk = (100-95) × 100 = $500
- [ ] Risk % = (500/10000) × 100 = 5%
- [ ] Form shows Risk%: 5%

**Test Case 5.2: Risk % Changes With Account Balance**
- [ ] Edit Account A starting balance to $50,000
- [ ] Edit same trade (don't change stop/entry)
- [ ] Risk % auto-recalculates = (500/50000) × 100 = 1%
- [ ] Form shows Risk%: 1%

**Test Case 5.3: Different Risk % Per Account**
- [ ] Account A: $10,000 starting balance
- [ ] Account B: $50,000 starting balance
- [ ] Create identical trade (same entry, stop, qty) in both
- [ ] Account A: Risk% = 5%
- [ ] Account B: Risk% = 1%

---

### 6. Account Settings Integration

**Test Case 6.1: Settings Page Shows Manage Accounts Button**
- [ ] Navigate to Settings
- [ ] "Trading Accounts" section visible
- [ ] "Manage Accounts" button present
- [ ] Click button → ManageAccountsModal opens

**Test Case 6.2: Settings vs Account Management**
- [ ] Settings page shows:
  - Display Name (user-level)
  - Broker (user-level default)
  - Default Risk % (user-level)
  - Timezone (user-level)
  - NOT: Account-specific fields
- [ ] ManageAccountsModal shows:
  - All accounts with starting balance
  - Create new account
  - Edit each account
  - Delete accounts

---

### 7. Database Integrity

**Test Case 7.1: Verify RLS Policies**
- [ ] User can only see their own accounts
- [ ] User can only see their own trades
- [ ] Trades with account_id are properly linked
- [ ] Account ownership verified by user_id

**Test Case 7.2: Cascading Delete**
- [ ] Create Account C with 5 trades
- [ ] Delete Account C from ManageAccountsModal
- [ ] Verify in database:
  - Account C deleted
  - All 5 trades deleted (cascade)
  - No orphaned trade records

**Test Case 7.3: Account Starting Balance Updates**
- [ ] Edit Account A starting balance to $25,000
- [ ] Verify in database: accounts.starting_balance = 25000
- [ ] Edit AccountBalanceCard - click pencil
- [ ] Change to $30,000
- [ ] Click Save
- [ ] Verify in database: accounts.starting_balance = 30000

---

### 8. User Experience Flow

**Test Case 8.1: Onboarding → First Trade**
1. [ ] User logs in first time
2. [ ] Auth initializes, creates default account (if none exists)
3. [ ] Dashboard shows:
   - Account name in header
   - Empty state message
   - "Log Your First Trade" button
4. [ ] Click "Log Your First Trade"
5. [ ] Fill form with:
   - Ticker: AAPL
   - Entry: $150
   - Exit: $155
   - Qty: 100
   - Select Account A (already selected)
6. [ ] Click Save
7. [ ] Trade saved to Account A
8. [ ] Dashboard updates with first trade stats
9. [ ] Journal shows trade
10. [ ] Trades page shows trade

**Test Case 8.2: Multi-Account Trading Workflow**
1. [ ] Create Account A (IB Main) - $10,000
2. [ ] Create Account B (TD Swing) - $25,000
3. [ ] Log 3 trades in Account A
4. [ ] Switch to Account B
5. [ ] Log 2 trades in Account B
6. [ ] Dashboard shows Account B stats (2 trades)
7. [ ] Sidebar shows Account B name
8. [ ] Trades page shows only Account B trades
9. [ ] Journal shows only Account B trades
10. [ ] Switch back to Account A
11. [ ] All Account A trades reappear
12. [ ] Stats revert to Account A

**Test Case 8.3: Account Maintenance Workflow**
1. [ ] Navigate to Settings
2. [ ] Click "Manage Accounts"
3. [ ] Create new account (Account C - Paper Trading - $5,000)
4. [ ] Edit Account C name to "Paper Rules"
5. [ ] Create 1 trade in Account C
6. [ ] Edit Account C starting balance to $10,000
7. [ ] Close modal
8. [ ] Switch to Account C
9. [ ] Verify Account Balance Card uses new $10,000 balance
10. [ ] Delete Account C
11. [ ] Verify Account C non-existent
12. [ ] Auto-switch to another account

---

## Test Data Setup

### Recommended Test Structure

**Account A (IB Main)**
- Starting Balance: $10,000
- Trades:
  - AAPL: +$300 (stock, long)
  - MSFT: -$150 (stock, long)
  - SPY: +$200 (etf, long)
- Expected Stats: 3 trades, +$350 P&L, 66.7% WR

**Account B (TD Swing)**
- Starting Balance: $25,000
- Trades:
  - TSLA: +$500 (stock, long)
  - QQQ: +$100 (etf, long)
- Expected Stats: 2 trades, +$600 P&L, 100% WR

**Account C (Paper)**
- Starting Balance: $5,000
- Trades: (None initially - created during testing)

---

## Verification Checklist

### Phase 1-2: Type System ✅
- [x] Account type defined
- [x] Trade has account_id field
- [x] UserProfile doesn't have account_size
- [x] Types compile without errors

### Phase 3: Auth State ✅
- [x] useAuthStore has account methods
- [x] selectedAccount and selectedAccountId state
- [x] localStorage persistence for account selection
- [x] fetchAccounts in initAuth

### Phase 4: Trade Queries ✅
- [x] fetchTrades requires accountId
- [x] All pages pass selectedAccountId
- [x] Trades filtered by account_id in queries
- [x] createTrade includes account_id

### Phase 5: UI Components ✅
- [x] AccountSelector component created
- [x] ManageAccountsModal component created
- [x] Header shows account selector
- [x] Settings links to modal

### Phase 6: Page Updates ✅
- [x] AccountBalanceCard uses selectedAccount.starting_balance
- [x] NewTradePage uses selectedAccount for risk%
- [x] SettingsPage has Manage Accounts button
- [x] All pages fetch trades with accountId

### Phase 7: Verification
- [ ] All user flows tested
- [ ] Stats properly scoped
- [ ] Trade isolation verified
- [ ] Account switching smooth
- [ ] Database integrity confirmed
- [ ] No TypeScript errors
- [ ] No runtime errors

---

## Manual Testing Commands

```bash
# Build the project
npm run build

# Run dev server
npm run dev

# Run tests (if applicable)
npm run test

# Check for TypeScript errors
tsc --noEmit
```

---

## Success Criteria

✅ **All tests pass if:**
1. User can create multiple accounts
2. Accounts show in selector with balances
3. Switching accounts changes displayed trades
4. Stats are correct per account
5. Risk% calculations use account balance
6. Account Balance Card shows correct balance
7. Trades isolated per account
8. No crashes or errors
9. localStorage persists selection
10. All TypeScript compiles without errors

---

## Sign-Off

- [ ] Phase 7 verification complete
- [ ] All test cases passed
- [ ] Ready for production deployment
- [ ] Multi-account feature stable and tested

Date: ______________
Tester: ______________
