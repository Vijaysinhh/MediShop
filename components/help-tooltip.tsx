'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface HelpTooltipProps {
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function HelpTooltip({ text, side = 'top', className }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <HelpCircle className={cn('w-4 h-4 text-muted-foreground hover:text-foreground cursor-help transition-colors', className)} tabIndex={0} />
      {isVisible && (
        <div className={cn(
          'absolute z-50 bg-foreground text-background text-xs px-3 py-1.5 rounded-md whitespace-nowrap',
          side === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' :
          side === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' :
          side === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' :
          'left-full ml-2 top-1/2 -translate-y-1/2'
        )}>
          {text}
        </div>
      )}
    </div>
  );
}

interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
  required?: boolean;
}

export function LabelWithTooltip({ label, tooltip, required }: LabelWithTooltipProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-sm font-semibold">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <HelpTooltip text={tooltip} />
    </div>
  );
}
