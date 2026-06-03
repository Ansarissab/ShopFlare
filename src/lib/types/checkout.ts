export interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
}

export interface ManualOrderFormProps {
  endpoint: string
  successMethod: string
  submitLabel: string
}

export interface BankTransferInstructionsProps {
  orderNumber: string
  totalCents: number
}
