import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeadingBlock from '../components/PageBuilder/blocks/heading/HeadingBlock';
import TextBlock from '../components/PageBuilder/blocks/text/TextBlock';
import ButtonBlock from '../components/PageBuilder/blocks/button/ButtonBlock';
import SpacerBlock from '../components/PageBuilder/blocks/spacer/SpacerBlock';
import type { BlockConfig } from '@shared/schema-types';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  registerBlockState,
  unregisterBlockState,
  type BlockStateAccessor,
} from '../components/PageBuilder/blocks/blockStateRegistry';
import { getBlockComponent } from '../../../renderer/react/render-helpers';

describe('Block Editing', () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnUpdate = vi.fn();
  });

  describe('HeadingBlock Editing', () => {
    it('should update heading text when input changes', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: { kind: 'text', value: 'Original Heading', level: 2 } as any,
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByLabelText(/heading text/i);
      fireEvent.change(input, { target: { value: 'Updated Heading' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'Updated Heading',
          level: 2,
        },
      });
    });

    it('should update heading level when button clicked', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: { kind: 'text', value: 'Test', level: 2 } as any,
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      const h4Button = screen.getByLabelText('Heading level 4');
      fireEvent.click(h4Button);

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'Test',
          level: 4,
        },
      });
    });

    // Text alignment is now handled by the Style tab in BlockSettings (styles.textAlign),
    // not by the heading's own settings panel. See Bug #3 fix.
  });

  describe('TextBlock Editing', () => {
    it('should update text content when textarea changes', () => {
      const block: BlockConfig = {
        id: 'text-1',
        name: 'core/paragraph',
        type: 'block',
        parentId: null,
        content: { kind: 'text', value: 'Original text' } as any,
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = TextBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      const textarea = screen.getByLabelText(/text content/i);
      fireEvent.change(textarea, { target: { value: 'Updated text' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'Updated text',
        },
      });
    });

    // Text alignment is now handled centrally by BlockSettings Style tab (styles.textAlign),
    // not by individual block settings components. See tab reorganization.
  });

  describe('ButtonBlock Editing', () => {
    afterEach(() => {
      act(() => {
        unregisterBlockState('form-1');
      });
    });

    const buttonBlock = (overrides: Partial<BlockConfig> = {}): BlockConfig => ({
      id: 'button-1',
      name: 'core/button',
      type: 'block',
      parentId: null,
      content: { kind: 'text', value: 'Click me', url: 'https://example.com' } as BlockConfig['content'],
      styles: {},
      children: [],
      settings: {},
      ...overrides,
    });

    const formAccessor = (): BlockStateAccessor => ({
      getContent: () => ({}),
      getStyles: () => undefined,
      getSettings: () => undefined,
      setContent: () => {},
      setStyles: () => {},
      setSettings: () => {},
      getFullState: () => ({
        id: 'form-1',
        name: 'core/form',
        type: 'container',
        parentId: null,
        content: { kind: 'structured', data: {} },
      }),
    });

    it('should update button text', () => {
      const Settings = ButtonBlock.settings!;
      render(<Settings block={buttonBlock()} onUpdate={mockOnUpdate} />);

      const input = screen.getByLabelText(/button text/i);
      fireEvent.change(input, { target: { value: 'New button text' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'New button text',
          url: 'https://example.com',
        },
      });
    });

    it('should update button URL from the Content card, with link target under the URL', () => {
      const Settings = ButtonBlock.settings!;
      render(<Settings block={buttonBlock()} onUpdate={mockOnUpdate} />);

      expect(screen.queryByText('Link Settings')).not.toBeInTheDocument();
      expect(screen.getByText('Link target')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /sends the form/i })).toBeDisabled();
      expect(screen.getByText('Place this button inside a form to send it.')).toBeInTheDocument();

      const input = screen.getByLabelText(/link url/i);
      fireEvent.change(input, { target: { value: 'https://newurl.com' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'Click me',
          url: 'https://newurl.com',
        },
      });
    });

    it('writes icon side and icon-only through SettingsChipGroup, and binds accessible name to title', () => {
      const Settings = ButtonBlock.settings!;
      render(
        <TooltipProvider>
          <Settings
            block={buttonBlock({
              content: {
                kind: 'text',
                value: 'Click me',
                url: 'https://example.com',
                icon: { iconSet: 'lucide', iconName: 'arrow-right' },
                iconOnly: true,
              } as BlockConfig['content'],
            })}
            onUpdate={mockOnUpdate}
          />
        </TooltipProvider>,
      );

      fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Side' })).getByRole('radio', { name: 'Right' }));
      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: expect.objectContaining({ iconPosition: 'right' }),
      });

      expect(within(screen.getByRole('radiogroup', { name: 'Show' })).getByRole('radio', { name: 'Icon only' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      fireEvent.change(screen.getByLabelText(/accessible name/i), { target: { value: 'Open menu' } });
      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: expect.objectContaining({ title: 'Open menu' }),
      });
    });

    it('keeps Sends the form on when the button is already submit, even outside a form', () => {
      const Settings = ButtonBlock.settings!;
      render(
        <Settings
          block={buttonBlock({
            content: { kind: 'text', value: 'Send', action: 'submit' } as BlockConfig['content'],
          })}
          onUpdate={mockOnUpdate}
        />,
      );

      const toggle = screen.getByRole('switch', { name: /sends the form/i });
      expect(toggle).toBeEnabled();
      expect(toggle).toBeChecked();
      expect(screen.getByText('Place this button inside a form to send it.')).toBeInTheDocument();
      expect(screen.queryByLabelText(/link url/i)).not.toBeInTheDocument();
    });

    it('enables Sends the form when a form ancestor registers', () => {
      const Settings = ButtonBlock.settings!;
      render(<Settings block={buttonBlock({ parentId: 'form-1' })} onUpdate={mockOnUpdate} />);

      expect(screen.getByRole('switch', { name: /sends the form/i })).toBeDisabled();

      act(() => {
        registerBlockState('form-1', formAccessor());
      });

      expect(screen.getByRole('switch', { name: /sends the form/i })).toBeEnabled();
      expect(screen.queryByText('Place this button inside a form to send it.')).not.toBeInTheDocument();
    });

    it('shows the send hint when the button sits inside a form and submit is on', () => {
      act(() => {
        registerBlockState('form-1', formAccessor());
      });
      const Settings = ButtonBlock.settings!;
      render(
        <Settings
          block={buttonBlock({
            parentId: 'form-1',
            content: { kind: 'text', value: 'Send', action: 'submit' } as BlockConfig['content'],
          })}
          onUpdate={mockOnUpdate}
        />,
      );

      expect(screen.getByRole('switch', { name: /sends the form/i })).toBeEnabled();
      expect(screen.getByText('Inside a Form block, this button sends what visitors typed.')).toBeInTheDocument();
      expect(screen.queryByText('Place this button inside a form to send it.')).not.toBeInTheDocument();
    });

    it('sets canvas aria-label on icon-only from title, else button text, for link and submit', () => {
      const Canvas = ButtonBlock.component;
      if (!Canvas) throw new Error('The button block has no canvas component');
      const icon = { iconSet: 'lucide', iconName: 'arrow-right' };

      const { rerender } = render(
        <Canvas
          value={buttonBlock({
            content: {
              kind: 'text',
              value: 'Go',
              title: 'Go home',
              iconOnly: true,
              icon,
              url: 'https://example.com',
            } as BlockConfig['content'],
          })}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Go home');

      rerender(
        <Canvas
          value={buttonBlock({
            content: {
              kind: 'text',
              value: 'Send',
              title: '',
              iconOnly: true,
              icon,
              action: 'submit',
            } as BlockConfig['content'],
          })}
          onChange={vi.fn()}
          isPreview
        />,
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Send');
    });

    it('sets published aria-label from title, else button text, on icon-only link and submit', () => {
      const Component = getBlockComponent('core/button');
      if (!Component) throw new Error('No published renderer for core/button');

      const linkHtml = renderToStaticMarkup(
        <Component
          {...buttonBlock({
            content: {
              kind: 'text',
              value: 'Save',
              title: 'Save document',
              url: 'https://example.com',
              iconOnly: true,
              icon: { iconSet: 'lucide', iconName: 'save' },
            } as BlockConfig['content'],
          })}
        />,
      );
      expect(linkHtml).toContain('aria-label="Save document"');
      expect(linkHtml).not.toContain('>Save<');

      const submitHtml = renderToStaticMarkup(
        <Component
          {...buttonBlock({
            content: {
              kind: 'text',
              value: 'Send',
              title: '',
              action: 'submit',
              iconOnly: true,
              icon: { iconSet: 'lucide', iconName: 'send' },
            } as BlockConfig['content'],
          })}
        />,
      );
      expect(submitHtml).toContain('type="submit"');
      expect(submitHtml).toContain('aria-label="Send"');
    });
  });

  describe('SpacerBlock Editing', () => {
    it('should update spacer height via input', () => {
      const block: BlockConfig = {
        id: 'spacer-1',
        name: 'core/spacer',
        type: 'block',
        parentId: null,
        content: { kind: 'structured', data: { height: 100 } },
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = SpacerBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByRole('textbox', { name: /height custom value/i });
      fireEvent.change(input, { target: { value: '150' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'structured',
          data: { height: '150px' },
        },
      });
    });
  });

  describe('Content Merging', () => {
    it('should preserve existing content properties when updating', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: {
          kind: 'text',
          value: 'Test',
          level: 2,
          textAlign: 'center',
          anchor: 'my-anchor',
          className: 'custom-class',
        } as any,
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      // Update only the heading text
      const input = screen.getByLabelText(/heading text/i);
      fireEvent.change(input, { target: { value: 'New Text' } });

      // Should merge with existing properties
      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'New Text',
          level: 2,
          textAlign: 'center',
          anchor: 'my-anchor',
          className: 'custom-class',
        },
      });
    });

    it('should allow overwriting specific properties', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: {
          kind: 'text',
          value: 'Test',
          level: 2,
          textAlign: 'left',
        } as any,
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      // Update the level
      const h5Button = screen.getByLabelText('Heading level 5');
      fireEvent.click(h5Button);

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'Test',
          level: 5,
          textAlign: 'left',
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content gracefully', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: { kind: 'empty' },
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      render(<Settings block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByLabelText(/heading text/i);
      expect(input).toHaveValue('');

      fireEvent.change(input, { target: { value: 'New content' } });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        content: {
          kind: 'text',
          value: 'New content',
        },
      });
    });

    it('should handle undefined content', () => {
      const block: BlockConfig = {
        id: 'heading-1',
        name: 'core/heading',
        type: 'block',
        parentId: null,
        content: { kind: 'empty' },
        styles: {},
        children: [],
        settings: {},
      };

      const Settings = HeadingBlock.settings!;
      
      // Should render without crashing
      expect(() => {
        render(<Settings block={block} onUpdate={mockOnUpdate} />);
      }).not.toThrow();
    });
  });
});
