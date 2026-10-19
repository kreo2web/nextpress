import type { CSSProperties, JSX } from 'react';
import { SITE_ROLE_LABELS, type SiteStanding } from '@shared/access';
import { Badge } from '@/components/ui/badge';

/** Accent tints are mixed in place: Tailwind 3 can't fade a CSS-variable colour with `/10`. */
export const accentTint = (percent: number): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, var(--npb-accent) ${percent}%, transparent)`,
});

const LOOK: Record<SiteStanding, { className: string; style?: CSSProperties }> = {
  owner: { className: 'text-npb-accent', style: accentTint(16) },
  admin: { className: 'text-npb-accent', style: accentTint(10) },
  editor: { className: 'bg-npb-interactive-bg-active text-npb-interactive-text-active' },
  subscriber: { className: 'bg-npb-surface-inset text-npb-text-secondary' },
};

/** A role as a quiet label; the owner reads strongest. */
export function RoleBadge({ standing }: { standing: SiteStanding }): JSX.Element {
  const look = LOOK[standing];
  return (
    <Badge variant="secondary" className={`border-0 font-medium ${look.className}`} style={look.style}>
      {SITE_ROLE_LABELS[standing]}
    </Badge>
  );
}
