'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { getIndianMobileDigits } from '@/lib/indian-mobile';
import { cn } from '@/lib/utils';

interface IndianMobileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (nationalNumber: string) => void;
  inputClassName?: string;
}

export function IndianMobileInput({
  value,
  onChange,
  className,
  inputClassName,
  ...inputProps
}: IndianMobileInputProps) {
  return (
    <div className={cn('flex h-10 w-full overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', className)}>
      <span className="flex items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">
        +91
      </span>
      <Input
        {...inputProps}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        value={getIndianMobileDigits(value)}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
        className={cn('h-full rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0', inputClassName)}
        placeholder="98765 43210"
      />
    </div>
  );
}
