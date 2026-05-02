# Implementation Plan - Cash Box (Wallet) Management

This plan introduces a formal system to track the cash box (صندوق المصاري). It allows starting the day with an opening balance, recording manual cash movements (IN/OUT), and closing the shift to reconcile the drawer.

## 1. Database Schema
Create a new migration `0020_add_wallet_management.sql`:
- `wallet_sessions`: Tracks opening and closing of the cash drawer.
- `wallet_transactions`: Tracks manual cash adjustments (deposits/withdrawals) not linked to sales or expenses.

## 2. Backend Services
- **`walletService.ts`**:
    - `getActiveSession()`: Check if there's an unclosed session.
    - `openSession(openingBalance)`: Start a new shift.
    - `closeSession(actualClosingBalance)`: Close the shift and calculate expected vs actual.
    - `addTransaction(amount, type, reason)`: Record a manual cash movement.
    - `getWalletStatus()`: Return current expected balance based on `Opening + Sales + Cash In - Expenses - Cash Out`.

## 3. IPC Layer
- Add new IPC invokes in `shared/ipc/types.ts`.
- Register handlers in `registerIpc.ts`.

## 4. UI Components (Renderer)
- **`StartSessionModal`**: A dialog that pops up if no session is active when trying to use the POS.
- **`CashBoxPage`**: A new module for:
    - Viewing current status.
    - Quick actions: "Add Cash", "Withdraw Cash".
    - History of manual adjustments.
    - "End Shift" button.
- **`EndShiftSummary`**: A summary view showing the discrepancy (if any) between expected and counted cash.

## 5. Localization
- Add Arabic and English keys for all new terms (Opening Balance, Cash Box, Withdraw, Deposit, etc.).

## 6. Integration
- Update POS to check for an active session before allowing a sale.
- Ensure `expenses` marked as `paid_from_cash` are subtracted from the wallet's expected balance.
