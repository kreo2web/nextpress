const FLASH_MS = 1200;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Briefly outlines the blocks the assistant just changed, so the eye finds them on a long page.
 * Outline takes no room, so nothing shifts. Waits two frames for the canvas to render the change;
 * skipped entirely under reduced motion.
 */
export const flashChangedBlocks = (ids: string[]): void => {
  if (ids.length === 0 || prefersReducedMotion()) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const canvas = document.getElementById('builder-canvas') ?? document;
      ids.forEach((id) => {
        const element = canvas.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
        element?.animate?.(
          [
            { outline: '2px solid var(--npb-accent)', outlineOffset: '2px' },
            { outline: '2px solid transparent', outlineOffset: '2px' },
          ],
          { duration: FLASH_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        );
      });
    }),
  );
};
