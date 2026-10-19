import React from 'react';
import type { BlockConfig, BlockContent } from '@shared/schema-types';
import { readStructuredBlockData } from '@shared/read-block-content';
import { SquareMousePointer } from 'lucide-react';
import { createBlockDefinition } from '../createBlockDefinition';
import { BlockShell } from '../shared/block-shell';
import { buttonsGroupStyle } from '@shared/buttons-group-style';
import { buttonsItemLinkStyle } from '@shared/buttons-item-look';
import { catalogMeta } from '../catalog-meta';
import {
  ButtonsSettings,
  DEFAULT_DATA,
  type ButtonItem,
  type ButtonsData,
} from './buttons-settings';

type ButtonsContent = BlockContent & {
  data?: ButtonsData;
};

const DEFAULT_CONTENT: ButtonsContent = {
  kind: 'structured',
  data: DEFAULT_DATA,
};

interface ButtonsRendererProps {
  content: ButtonsContent;
  styles?: React.CSSProperties;
}

function ButtonsRenderer({ content, styles }: ButtonsRendererProps) {
  const buttonsData = readStructuredBlockData(content, DEFAULT_DATA);
  const buttons: ButtonItem[] = Array.isArray(buttonsData?.buttons) ? buttonsData.buttons : [];
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
        const buttonClassName = ['wp-block-button', button.className || ''].filter(Boolean).join(' ');
        return (
          <div key={button.id || index} className={buttonClassName}>
            <a
              className="wp-block-button__link wp-element-button"
              href={button.url}
              target={button.linkTarget}
              rel={button.rel}
              title={button.title}
              style={buttonsItemLinkStyle({ item: button, orientation })}>
              {button.text}
            </a>
          </div>
        );
      })}
    </BlockShell>
  );
}

const ButtonsBlock = createBlockDefinition<ButtonsContent>({
  ...catalogMeta('core/buttons'),
  icon: SquareMousePointer,
  defaultContent: DEFAULT_CONTENT,
  settings: ButtonsSettings,
  hasSettings: true,
  render: ({ content, styles }) => <ButtonsRenderer content={content} styles={styles} />,
});

export default ButtonsBlock;
