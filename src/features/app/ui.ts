import { createContext, useContext } from 'react'

/** Opens the app's sheets and dialogs from anywhere inside the app shell. */
export type AppUI = {
  openBill: (billId: string) => void
  openAddBill: () => void
  openAddChore: () => void
  openAddMenu: () => void
  confirmChore: (choreId: string) => void
  openChore: (choreId: string) => void
  openNotifications: () => void
  openEditProfile: () => void
  confirmLeave: () => void
  confirmRemove: (memberId: string) => void
}

export const AppUIContext = createContext<AppUI | null>(null)

export function useAppUI(): AppUI {
  const ui = useContext(AppUIContext)
  if (!ui) throw new Error('useAppUI must be used inside <AppShell>')
  return ui
}
