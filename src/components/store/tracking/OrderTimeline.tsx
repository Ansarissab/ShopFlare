'use client'

import type { ReactElement } from 'react'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/Provider'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { OrderTimelineProps } from '@/lib/types/order'

// Timeline steps — exclude 'cancelled' (shown separately)
const TIMELINE_STEPS = ORDER_STATUSES.filter(
  (s): s is Exclude<OrderStatus, 'cancelled'> => s !== 'cancelled',
)

type StepState = 'completed' | 'current' | 'upcoming'

function stepState(step: string, currentStatus: OrderStatus): StepState {
  if (currentStatus === 'cancelled') return 'upcoming'
  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus as Exclude<OrderStatus, 'cancelled'>)
  const stepIdx = TIMELINE_STEPS.indexOf(step as Exclude<OrderStatus, 'cancelled'>)
  if (stepIdx < currentIdx) return 'completed'
  if (stepIdx === currentIdx) return 'current'
  return 'upcoming'
}

// Simple icon paths — inline SVG for zero-dep
function StepIcon({ step, state }: { step: string; state: StepState }) {
  const baseClass = cn(
    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
    {
      'border-(--success) bg-(--success) text-white': state === 'completed',
      'border-(--accent) bg-(--accent) text-(--accent-fg)': state === 'current',
      'border-(--muted-fg) bg-background text-(--muted-fg)': state === 'upcoming',
    },
  )

  const icons: Record<string, ReactElement> = {
    pending: (
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    confirmed: (
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <polyline
          points="20 6 9 17 4 12"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    processing: (
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    shipped: (
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="1" y="3" width="15" height="13" rx="1" strokeWidth="2" />
        <path d="M16 8h4l3 5v3h-7V8z" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="5.5" cy="18.5" r="2.5" strokeWidth="2" />
        <circle cx="18.5" cy="18.5" r="2.5" strokeWidth="2" />
      </svg>
    ),
    delivered: (
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  }

  return <div className={baseClass}>{icons[step]}</div>
}

export function OrderTimeline({ status, trackingNumber, carrier }: OrderTimelineProps) {
  const t = useT()
  if (status === 'cancelled') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">{t.tracking.status}</p>
        <Badge variant="destructive" className="w-fit text-sm px-3 py-1">
          {t.orderStatusLabels.cancelled}
        </Badge>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-muted-foreground">{t.tracking.timeline}</p>

      {/* Steps */}
      <ol className="flex flex-col gap-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const state = stepState(step, status)
          const isLast = idx === TIMELINE_STEPS.length - 1

          return (
            <li key={step} className="flex items-start gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <StepIcon step={step} state={state} />
                {!isLast && (
                  <div
                    className={cn('mt-0.5 w-0.5 flex-1 min-h-8', {
                      'bg-(--success)': state === 'completed',
                      'bg-(--muted-fg)/30': state !== 'completed',
                    })}
                  />
                )}
              </div>

              {/* Label + shipping info */}
              <div className="flex flex-col gap-0.5 pb-4">
                <span
                  className={cn('text-sm font-medium', {
                    'text-(--success)': state === 'completed',
                    'text-(--accent)': state === 'current',
                    'text-(--muted-fg)': state === 'upcoming',
                  })}
                >
                  {t.orderStatusLabels[step as keyof typeof t.orderStatusLabels]}
                </span>

                {/* Show tracking info under the 'shipped' step */}
                {step === 'shipped' && state !== 'upcoming' && (trackingNumber || carrier) && (
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {carrier && (
                      <span>
                        {t.tracking.carrier}: {carrier}
                      </span>
                    )}
                    {trackingNumber && (
                      <span>
                        {t.tracking.trackingNumber}:{' '}
                        <span className="font-mono">{trackingNumber}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
