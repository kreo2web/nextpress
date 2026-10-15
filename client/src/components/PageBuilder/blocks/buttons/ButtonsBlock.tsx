import React from 'react';
import type { BlockConfig, BlockContent } from '@shared/schema-types';
import { readStructuredBlockData } from '@shared/read-block-content';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SettingsLabel, SettingsSection } from '../../shared';
import { SettingsChipGroup } from '../../settings-chip-group';
import { LinkTargetChips } from '../shared/link-settings';
import { Plus, Trash2, SquareMousePointer } from 'lucide-react';
import { createBlockDefinition } from '../createBlockDefinition';
import { BlockShell } from '../shared/block-shell';
import { useSettingsState } from '../useSettingsState';
import { buttonsGroupStyle } from '@shared/buttons-group-style';

// ============================================================================
// TYPES
// ============================================================================

interface ButtonItem {
  id: string;
  text: string;
  url: string;
  linkTarget?: '_self' | '_blank';
  rel?: string;
  title?: string;
  className?: string;
}

type ButtonsLayout = 'flex-start' | 'center' | 'flex-end' | 'space-between';
type ButtonsOrientation = 'horizontal' | 'vertical';

type ButtonsData = {
  buttons?: ButtonItem[];
  layout?: ButtonsLayout;
  orientation?: ButtonsOrientation;
  className?: string;
};

const BUTTONS_LAYOUT_OPTIONS = [
  { value: 'flex-start', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'Right' },
  { value: 'space-between', label: 'Space between', accessibleName: 'Space between' },
] as const;

const BUTTONS_ORIENTATION_OPTIONS = [
  { value: 'horizontal', label: 'Row' },
  { value: 'vertical', label: 'Stack' },
] as const;

function isButtonsLayout(value: string): value is ButtonsLayout {
  return (
    value === 'flex-start' ||
    value === 'center' ||
    value === 'flex-end' ||
    value === 'space-between'
  );
}

function isButtonsOrientation(value: string): value is ButtonsOrientation {
  return value === 'horizontal' || value === 'vertical';
}

type ButtonsContent = BlockContent & {
  data?: ButtonsData;
};

const DEFAULT_DATA: ButtonsData = {
  buttons: [
    {
      id: 'btn-1',
      text: 'Click Me',
      url: '#',
      linkTarget: '_self',
      rel: '',
      title: '',
      className: '',
    },
  ],
  layout: 'flex-start',
  orientation: 'horizontal',
  className: '',
};

const DEFAULT_CONTENT: ButtonsContent = {
  kind: 'structured',
  data: DEFAULT_DATA,
};

// ============================================================================
// RENDERER
// ============================================================================

interface ButtonsRendererProps {
  content: ButtonsContent;
  styles?: React.CSSProperties;
}

function ButtonsRenderer({ content, styles }: ButtonsRendererProps) {
  const buttonsData = readStructuredBlockData(content, DEFAULT_DATA);
  
  const buttons: ButtonItem[] = Array.isArray(buttonsData?.buttons)
    ? buttonsData.buttons
    : [];

  const layout = buttonsData?.layout || 'flex-start';
  const orientation = buttonsData?.orientation || 'horizontal';
  const extraClassName = [
    orientation === 'vertical' ? 'is-vertical' : '',
    layout === 'center' ? 'is-content-justification-center' : '',
    layout === 'flex-end' || layout === 'right' ? 'is-content-justification-right' : '',
    layout === 'space-between' ? 'is-content-justification-space-between' : '',
    buttonsData?.className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <BlockShell
      blockClass="wp-block-buttons"
      className={extraClassName || undefined}
      style={buttonsGroupStyle({ layout, orientation, styles })}>
      {buttons.map((button, index) => {
        const buttonClassName = ['wp-block-button', button.className || '']
          .filter(Boolean)
          .join(' ');

        return (
          <div key={button.id || index} className={buttonClassName}>
            <a
              className="wp-block-button__link wp-element-button"
              href={button.url}
              target={button.linkTarget}
              rel={button.rel}
              title={button.title}
              style={{
                backgroundColor: 'var(--npb-accent)',
                color: 'var(--npb-text-inverse)',
                padding: '12px 24px',
                borderRadius: 'var(--npb-radius-input, 4px)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                width: orientation === 'vertical' ? '100%' : undefined,
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }}>
              {button.text}
            </a>
          </div>
        );
      })}
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface ButtonsSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function ButtonsSettings({ block, onUpdate }: ButtonsSettingsProps) {
  const { content: buttonsData, updateContent } = useSettingsState<ButtonsData>({
    block,
    onUpdate,
    defaultContent: DEFAULT_DATA,
  });

  const buttons: ButtonItem[] = Array.isArray(buttonsData?.buttons)
    ? buttonsData.buttons
    : [];

  const updateButtons = (newButtons: ButtonItem[]) => {
    updateContent({ buttons: newButtons });
  };

  const addButton = () => {
    const newButton: ButtonItem = {
      id: `btn-${Date.now()}`,
      text: 'Button',
      url: '#',
      linkTarget: '_self',
      rel: '',
      title: '',
      className: '',
    };
    updateButtons([...buttons, newButton]);
  };

  const removeButton = (index: number) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    updateButtons(newButtons);
  };

  const updateButton = (index: number, updates: Partial<ButtonItem>) => {
    const newButtons = buttons.map((btn, i) =>
      i === index ? { ...btn, ...updates } : btn
    );
    updateButtons(newButtons);
  };

  return (
    <SettingsSection>
      <div className="flex justify-between items-center">
        <SettingsLabel>Buttons</SettingsLabel>
        <Button type="button" variant="outline" size="sm" onClick={addButton}>
          <Plus className="w-4 h-4 mr-1" />
          Add Button
        </Button>
      </div>

      <div className="divide-y divide-npb-border-default">
        {buttons.map((button, index) => (
          <div key={button.id || index} className="space-y-3 py-4 first:pt-0 last:pb-0">
            <div className="flex justify-between items-center">
              <SettingsLabel>Button {index + 1}</SettingsLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                aria-label={`Remove button ${index + 1}`}
                onClick={() => removeButton(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <SettingsLabel htmlFor={`btn-text-${index}`}>Button Text</SettingsLabel>
              <Input
                id={`btn-text-${index}`}
                value={button.text}
                onChange={(e) => updateButton(index, { text: e.target.value })}
                placeholder="Button text"
                className="mt-1 h-9"
              />
            </div>

            <div>
              <SettingsLabel htmlFor={`btn-url-${index}`}>URL</SettingsLabel>
              <Input
                id={`btn-url-${index}`}
                value={button.url}
                onChange={(e) => updateButton(index, { url: e.target.value })}
                placeholder="https://example.com"
                className="mt-1 h-9"
              />
            </div>

            <LinkTargetChips
              value={button.linkTarget}
              onChange={({ target }) => updateButton(index, { linkTarget: target })}
            />
          </div>
        ))}
      </div>

      <SettingsChipGroup
        label="Alignment"
        options={[...BUTTONS_LAYOUT_OPTIONS]}
        value={buttonsData?.layout || 'flex-start'}
        onChange={(value) => {
          if (!isButtonsLayout(value)) return;
          updateContent({ layout: value });
        }}
      />

      <SettingsChipGroup
        label="Direction"
        options={[...BUTTONS_ORIENTATION_OPTIONS]}
        value={buttonsData?.orientation || 'horizontal'}
        onChange={(value) => {
          if (!isButtonsOrientation(value)) return;
          updateContent({ orientation: value });
        }}
      />
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const ButtonsBlock = createBlockDefinition<ButtonsContent>({
  id: 'core/buttons',
  label: 'Buttons',
  icon: SquareMousePointer,
  description: 'A row of buttons',
  category: 'basic',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: { margin: '1em 0' },
  settings: ButtonsSettings,
  hasSettings: true,
  render: ({ content, styles }) => <ButtonsRenderer content={content} styles={styles} />,
});

export default ButtonsBlock;
