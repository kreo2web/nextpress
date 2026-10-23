import { useEffect, useRef, useState, type ReactElement } from 'react';

const CANVAS_ID = 'builder-canvas';

type Rect = { left: number; top: number; width: number; height: number };

/** The block's place on screen, and the visible part of the canvas it must stay inside. */
type BlockBox = Rect & { radius: string; clip: Rect };

const findBlock = (blockId: string): HTMLElement | null => {
  const canvas = document.getElementById(CANVAS_ID) ?? document;
  return canvas.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
};

const toRect = ({ left, top, width, height }: DOMRect): Rect => ({ left, top, width, height });

/** The nearest ancestor that scrolls: the canvas's visible window. The outline is clipped to it so it never covers the top bar or sidebars. */
const findScrollViewport = (element: HTMLElement): HTMLElement => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
  }
  return document.documentElement;
};

const readBox = (element: HTMLElement): BlockBox => ({
  ...toRect(element.getBoundingClientRect()),
  radius: getComputedStyle(element).borderRadius,
  clip: toRect(findScrollViewport(element).getBoundingClientRect()),
});

/**
 * Outlines the block the assistant's run is limited to. Positioned in viewport coordinates so it can sit
 * in the lock overlay without caring about that container's offsets, and clipped to the canvas's visible
 * window. It follows the block through scroll and resize, and renders nothing when the block is not on
 * the canvas.
 */
export function AiFocusHighlight({ blockId }: { blockId: string }): ReactElement | null {
  const [box, setBox] = useState<BlockBox | null>(null);
  const observedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let frame: number | null = null;

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;

    const update = (): void => {
      frame = null;
      const element = findBlock(blockId);
      if (element !== observedRef.current) {
        if (observedRef.current) observer?.unobserve(observedRef.current);
        if (element) observer?.observe(element);
        observedRef.current = element;
      }
      setBox(element ? readBox(element) : null);
    };

    function schedule(): void {
      if (frame !== null) return;
      frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      observedRef.current = null;
    };
  }, [blockId]);

  if (!box) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed overflow-hidden"
      style={{ left: box.clip.left, top: box.clip.top, width: box.clip.width, height: box.clip.height }}>
      <div
        className="npb-ai-pulse absolute left-0 top-0"
        style={{
          width: box.width,
          height: box.height,
          transform: `translate(${box.left - box.clip.left}px, ${box.top - box.clip.top}px)`,
          borderRadius: box.radius,
          boxShadow: '0 0 0 2px var(--npb-accent), 0 0 18px 2px color-mix(in srgb, var(--npb-accent) 35%, transparent)',
        }}
      />
    </div>
  );
}
