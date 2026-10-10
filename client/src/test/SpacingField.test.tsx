import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SpacingField } from '@/components/PageBuilder/spacing-field';
import { HeaderSpacingSettings } from '@/components/PageBuilder/blocks/header/header-spacing-settings';

vi.setConfig({ testTimeout: 20000 });

const NONE = { top: '', right: '', bottom: '', left: '' };
const EVEN = { top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' };

describe('SpacingField: one control for padding and margin', () => {
  it('switches between padding and margin with one toggle, and each saves to its own keys', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <SpacingField
        targets={[
          { kind: 'padding', sides: NONE },
          { kind: 'margin', sides: NONE },
        ]}
        onCommit={onCommit}
      />,
    );
    const toggle = screen.getByRole('group', { name: 'Padding or margin' });
    expect(within(toggle).getByRole('button', { name: 'Padding' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(toggle).getByRole('button', { name: 'Margin' }));
    expect(within(toggle).getByRole('button', { name: 'Margin' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('radio', { name: 'MD' }));
    expect(onCommit).toHaveBeenLastCalledWith({
      marginTop: '1rem',
      marginRight: '1rem',
      marginBottom: '1rem',
      marginLeft: '1rem',
    });
  });

  it('opens on margin when only a margin is saved, and shows the matching preset lit', () => {
    render(
      <SpacingField
        targets={[
          { kind: 'padding', sides: NONE },
          { kind: 'margin', sides: EVEN },
        ]}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Padding or margin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Margin' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'MD' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('SpacingField: presets first, then one custom box', () => {
  it('a preset writes all four sides, and None writes 0', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SpacingField targets={[{ kind: 'padding', sides: NONE }]} onCommit={onCommit} />);
    await user.click(screen.getByRole('radio', { name: 'None' }));
    expect(onCommit).toHaveBeenLastCalledWith({ paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0' });
  });

  it('a typed length goes through the custom box and saves on every side', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SpacingField targets={[{ kind: 'padding', sides: NONE }]} onCommit={onCommit} />);
    await user.type(screen.getByRole('textbox', { name: 'Padding custom value' }), '24');
    expect(onCommit).toHaveBeenLastCalledWith({ paddingTop: '24px', paddingRight: '24px', paddingBottom: '24px', paddingLeft: '24px' });
  });

  it('a saved value that matches a preset lights that chip, and the custom box stays unlit', () => {
    render(<SpacingField targets={[{ kind: 'padding', sides: { top: '1.5rem', right: '1.5rem', bottom: '1.5rem', left: '1.5rem' } }]} onCommit={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'LG' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('the arrow keys move from one preset to the next', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <SpacingField targets={[{ kind: 'padding', sides: { top: '0.5rem', right: '0.5rem', bottom: '0.5rem', left: '0.5rem' } }]} onCommit={onCommit} />,
    );
    await user.click(screen.getByRole('radio', { name: 'SM' }));
    await user.keyboard('{ArrowRight}');
    expect(onCommit).toHaveBeenLastCalledWith({ paddingTop: '1rem', paddingRight: '1rem', paddingBottom: '1rem', paddingLeft: '1rem' });
  });
});

describe('SpacingField: Reset', () => {
  it('clears every side when nothing is set as a default', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SpacingField targets={[{ kind: 'padding', sides: EVEN }]} onCommit={onCommit} />);
    await user.click(screen.getByRole('button', { name: 'Reset Padding' }));
    expect(onCommit).toHaveBeenCalledWith({ paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null });
  });

  it('is not offered when there is nothing to reset', () => {
    render(<SpacingField targets={[{ kind: 'padding', sides: NONE }]} onCommit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reset Padding' })).toBeNull();
  });

  it('returns to the default, writing only the sides that differ from it', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <SpacingField
        targets={[
          {
            kind: 'padding',
            sides: { top: '2rem', right: '1.25rem', bottom: '0.75rem', left: '1.25rem' },
            defaultSides: { top: '0.75rem', right: '1.25rem', bottom: '0.75rem', left: '1.25rem' },
          },
        ]}
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reset Padding' }));
    expect(onCommit).toHaveBeenCalledWith({ paddingTop: '0.75rem' });
  });
});

describe('SpacingField: margin and padding rules', () => {
  it('offers Auto on margin only, when the block allows it', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const { unmount } = render(
      <SpacingField targets={[{ kind: 'margin', sides: NONE }]} allowAuto onCommit={onCommit} />,
    );
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(onCommit).toHaveBeenLastCalledWith({ marginTop: 'auto', marginRight: 'auto', marginBottom: 'auto', marginLeft: 'auto' });
    unmount();
    render(<SpacingField targets={[{ kind: 'padding', sides: NONE }]} allowAuto onCommit={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Auto' })).toBeNull();
  });

  it('padding refuses a minus sign: nothing is saved and the box says why', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SpacingField targets={[{ kind: 'padding', sides: NONE }]} onCommit={onCommit} />);
    const box = screen.getByRole('textbox', { name: 'Padding custom value' });
    await user.type(box, '-5');
    expect(onCommit).not.toHaveBeenCalled();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Use zero or a positive length.')).toBeInTheDocument();
  });

  it('margin accepts a negative value, which pulls the block back', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SpacingField targets={[{ kind: 'margin', sides: NONE }]} onCommit={onCommit} />);
    await user.type(screen.getByRole('textbox', { name: 'Margin custom value' }), '-1');
    expect(onCommit).toHaveBeenLastCalledWith({ marginTop: '-1px', marginRight: '-1px', marginBottom: '-1px', marginLeft: '-1px' });
  });
});

describe('SpacingField: each side', () => {
  it('a side picked from the selector takes its own preset and saves only that side', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <SpacingField
        targets={[{ kind: 'padding', sides: { top: '1rem', right: '2rem', bottom: '3rem', left: '4rem' } }]}
        onCommit={onCommit}
      />,
    );
    await user.click(within(screen.getByRole('radiogroup', { name: 'Padding side' })).getByRole('radio', { name: 'Bottom' }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Padding bottom' })).getByRole('radio', { name: 'LG' }));
    expect(onCommit).toHaveBeenLastCalledWith({ paddingBottom: '1.5rem' });
  });
});

describe('SpacingField: hover', () => {
  it('reports which property is hovered, and clears it when the pointer leaves', async () => {
    const user = userEvent.setup();
    const onHoverArea = vi.fn();
    render(<SpacingField targets={[{ kind: 'margin', sides: NONE }]} onCommit={vi.fn()} onHoverArea={onHoverArea} />);
    await user.hover(screen.getByRole('group', { name: 'Spacing' }));
    expect(onHoverArea).toHaveBeenLastCalledWith('margin');
    await user.unhover(screen.getByRole('group', { name: 'Spacing' }));
    expect(onHoverArea).toHaveBeenLastCalledWith(null);
  });
});

describe('header spacing uses the shared control and writes only the axis it changed', () => {
  it('a side padding preset saves paddingInline and leaves paddingBlock alone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HeaderSpacingSettings value={{ paddingBlock: '0.75rem', paddingInline: '1.25rem' }} onChange={onChange} />);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Side padding' })).getByRole('radio', { name: 'Wide' }));
    expect(onChange).toHaveBeenLastCalledWith({ paddingInline: '3rem' });
  });

  it('Reset puts back only the side that moved from its default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HeaderSpacingSettings value={{ paddingBlock: '0.75rem', paddingInline: '3rem' }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Reset Padding' }));
    expect(onChange).toHaveBeenLastCalledWith({ paddingInline: '1.25rem' });
  });
});
