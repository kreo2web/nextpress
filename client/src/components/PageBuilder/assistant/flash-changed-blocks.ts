const FLASH_MS = 1200;
const FLASH_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Briefly brightens the blocks the assistant just changed and fades an accent outline around them, so
 * the eye finds them on a long page. The outline is on the block itself: it takes no room, scrolls with
 * the block and stays inside the canvas. Waits two frames for the canvas to render the change; skipped
 * entirely under reduced motion.
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
            { opacity: 0.55, outline: '2px solid var(--npb-accent)', outlineOffset: '2px' },
            { opacity: 1, outline: '2px solid transparent', outlineOffset: '2px' },
          ],
          { duration: FLASH_MS, easing: FLASH_EASING },
        );
      });
    }),
  );
};
