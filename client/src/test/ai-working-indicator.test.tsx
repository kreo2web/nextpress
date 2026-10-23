import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiWorkingDots, AiWorkingStatus } from '@/components/PageBuilder/assistant/ai-working-indicator';
import { AiFocusHighlight } from '@/components/PageBuilder/assistant/ai-focus-highlight';
import { flashChangedBlocks } from '@/components/PageBuilder/assistant/flash-changed-blocks';

const INDEX_CSS = readFileSync(resolve(process.cwd(), 'client/src/index.css'), 'utf8');
const REDUCED_MOTION_STOPS_PULSE = /@media \(prefers-reduced-motion: reduce\) \{\s*\.npb-ai-dot,\s*\.npb-ai-pulse \{\s*animation: none;/;
const SECOND_MS = 1000;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {
    FakeResizeObserver.instances.push(this);
  }
}

const mountCanvasBlock = (blockId: string, box: { left: number; top: number; width: number; height: number }): HTMLElement => {
  const canvas = document.createElement('div');
  canvas.id = 'builder-canvas';
  const block = document.createElement('div');
  block.setAttribute('data-block-id', blockId);
  block.getBoundingClientRect = () => ({
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  });
  canvas.append(block);
  document.body.append(canvas);
  return block;
};

describe('AiWorkingStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById('builder-canvas')?.remove();
  });

  it('shows the live step as a polite status', () => {
    render(<AiWorkingStatus step="Writing the pricing section" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Writing the pricing section');
  });

  it('falls back to a plain working line when there is no step yet', () => {
    render(<AiWorkingStatus step={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('The assistant is working…');
  });

  it('hides the elapsed time for the first ten seconds', () => {
    render(<AiWorkingStatus step="Working" />);
    act(() => {
      vi.advanceTimersByTime(9 * SECOND_MS);
    });
    expect(screen.getByRole('status')).not.toHaveTextContent('for ');
  });

  it('shows elapsed time in words once it has run for a while', () => {
    render(<AiWorkingStatus step="Working" />);
    act(() => {
      vi.advanceTimersByTime(20 * SECOND_MS);
    });
    expect(screen.getByRole('status')).toHaveTextContent('for less than a minute');

    act(() => {
      vi.advanceTimersByTime(100 * SECOND_MS);
    });
    expect(screen.getByRole('status')).toHaveTextContent('for about 2 minutes');
  });

  it('stops its clock on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<AiWorkingStatus step="Working" />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe('AiWorkingDots', () => {
  it('draws three accent dots, staggered so they rise in a wave', () => {
    const { container } = render(<AiWorkingDots />);
    const dots = container.querySelectorAll<HTMLElement>('.npb-ai-dot');
    expect(dots).toHaveLength(3);
    expect(dots[1].style.animationDelay).toBe('160ms');
    expect(dots[2].style.animationDelay).toBe('320ms');
  });

  it('stops the dots under reduced motion and leaves them at full opacity', () => {
    expect(INDEX_CSS).toMatch(REDUCED_MOTION_STOPS_PULSE);
    expect(INDEX_CSS).toMatch(/\.npb-ai-dot \{\s*opacity: 1;/);
  });
});

describe('AiFocusHighlight', () => {
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
    document.getElementById('builder-canvas')?.remove();
    vi.restoreAllMocks();
  });

  it('outlines the block it finds on the canvas, at its position', () => {
    mountCanvasBlock('hero', { left: 40, top: 120, width: 300, height: 80 });
    const { container } = render(<AiFocusHighlight blockId="hero" />);
    const outline = container.querySelector<HTMLElement>('.npb-ai-pulse');
    expect(outline).not.toBeNull();
    expect(outline?.style.width).toBe('300px');
    expect(outline?.style.height).toBe('80px');
    expect(outline?.style.transform).toBe('translate(40px, 120px)');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('stays inside the part of the canvas that scrolls, so it never covers the top bar or sidebars', () => {
    const block = mountCanvasBlock('hero', { left: 40, top: 120, width: 300, height: 80 });
    const viewport = document.createElement('div');
    viewport.style.overflowY = 'auto';
    viewport.getBoundingClientRect = () => ({ left: 20, top: 100, width: 600, height: 400 }) as DOMRect;
    const canvas = block.closest('#builder-canvas') ?? block;
    canvas.parentElement?.insertBefore(viewport, canvas);
    viewport.append(canvas);

    const { container } = render(<AiFocusHighlight blockId="hero" />);
    const clip = container.firstElementChild as HTMLElement;
    expect([clip.style.left, clip.style.top, clip.style.width, clip.style.height]).toEqual(['20px', '100px', '600px', '400px']);
    expect(clip.className).toContain('overflow-hidden');
    expect(container.querySelector<HTMLElement>('.npb-ai-pulse')?.style.transform).toBe('translate(20px, 20px)');
    viewport.remove();
  });

  it('renders nothing when the block is not on the canvas', () => {
    const { container } = render(<AiFocusHighlight blockId="missing" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('watches the block for size changes and removes every listener on unmount', () => {
    const block = mountCanvasBlock('hero', { left: 0, top: 0, width: 10, height: 10 });
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<AiFocusHighlight blockId="hero" />);

    const observer = FakeResizeObserver.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(block);
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true });

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('flashChangedBlocks', () => {
  const originalAnimate = HTMLElement.prototype.animate;
  let matchMediaSpy: { mockRestore: () => void } | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    HTMLElement.prototype.animate = originalAnimate;
    matchMediaSpy?.mockRestore();
    document.getElementById('builder-canvas')?.remove();
    document.querySelectorAll('body > div[aria-hidden="true"]').forEach((node) => node.remove());
  });

  it('brightens the changed block and fades an outline on the block itself, adding nothing to the page', () => {
    const block = mountCanvasBlock('intro', { left: 8, top: 16, width: 200, height: 40 });
    const animate = vi.fn();
    block.animate = animate as HTMLElement['animate'];
    const nodesBefore = document.body.querySelectorAll('*').length;

    flashChangedBlocks(['intro']);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0.55, outline: '2px solid var(--npb-accent)', outlineOffset: '2px' },
        { opacity: 1, outline: '2px solid transparent', outlineOffset: '2px' },
      ],
      expect.objectContaining({ duration: 1200 }),
    );
    expect(document.body.querySelectorAll('*')).toHaveLength(nodesBefore);
  });

  it('does nothing when there are no ids', () => {
    flashChangedBlocks([]);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(document.querySelectorAll('body > div[aria-hidden="true"]')).toHaveLength(0);
  });
});
