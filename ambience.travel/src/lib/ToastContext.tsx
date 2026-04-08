/* ToastContext.ts
 * Global toast notification system for ambience.SPORTS.
 *
 * Usage:
 *   const { toast } = useToast()
 *   toast.success('Bet settled.')
 *   toast.error('Failed to save — please try again.')
 *   toast.warning('No active sportsbooks found.')
 *   toast.info('Tip: use book:DK to filter by book.')
 *
 * Wire-up (App.tsx):
 *   1. Wrap app with <ToastProvider>
 *   2. Render <ToastContainer /> once, outside Layout (alongside TutorialModal)
 */

import { createContext, useContext } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:        string
  variant:   ToastVariant
  message:   string
  duration:  number   // ms before auto-dismiss; 0 = sticky (manual dismiss only)
  exiting:   boolean  // true during exit animation
}

export interface ToastAPI {
  success: (message: string, duration?: number) => string
  error:   (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
  info:    (message: string, duration?: number) => string
  dismiss: (id: string) => void
}

export interface ToastContextValue {
  toasts: Toast[]
  toast:  ToastAPI
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: {
    success: () => '',
    error:   () => '',
    warning: () => '',
    info:    () => '',
    dismiss: () => {},
  },
})

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}