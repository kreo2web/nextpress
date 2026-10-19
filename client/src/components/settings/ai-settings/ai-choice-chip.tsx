import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type AiChoiceChipProps = {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
};

/** A quick fill under an input: a pressed state shows when the input already holds that value. */
export function AiChoiceChip({ isActive, onClick, children }: AiChoiceChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={isActive}
      onClick={onClick}
      className="h-auto min-h-10 whitespace-normal py-1.5 text-left max-sm:flex-col max-sm:items-start max-sm:gap-0.5 md:min-h-8 aria-pressed:bg-npb-interactive-bg-active aria-pressed:text-npb-interactive-text-active"
    >
      {children}
    </Button>
  );
}
