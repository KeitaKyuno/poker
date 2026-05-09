'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'

type PinInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'inputMode' | 'maxLength'>

export const PinInput = React.forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  { onChange, ...props },
  ref
) {
  return (
    <Input
      {...props}
      ref={ref}
      type="password"
      inputMode="numeric"
      maxLength={4}
      autoComplete="off"
      onChange={(event) => {
        const sanitized = event.target.value.replace(/\D/g, '').slice(0, 4)
        if (sanitized !== event.target.value) {
          event.target.value = sanitized
        }
        onChange?.(event)
      }}
    />
  )
})
