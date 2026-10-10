import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
import { EditorPopupsProvider } from '@/components/PageBuilder/popup-links';
import { PopupSettings } from '@/components/PageBuilder/blocks/popup/popup-settings';
import { AccordionSettings } from '@/components/PageBuilder/blocks/accordion/accordion-settings';
import { IconBlockSettings } from '@/components/PageBuilder/blocks/icon/icon-block-settings';
import BlockSettings from '@/components/PageBuilder/BlockSettings';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.setConfig({ testTimeout: 20000 });

const block = (
	name: string,
	data: Record<string, unknown>,
	styles: Record<string, unknown> = {},
	extra: Partial<BlockConfig> = {},
): BlockConfig => ({
	id: `${name}-1`,
	name,
	type: 'block',
	label: name,
	category: 'layout',
	content: { kind: 'structured', data } as BlockConfig['content'],
	styles: styles as BlockConfig['styles'],
	settings: {},
	parentId: null,
	...extra,
});

/** The data an edit saved: content-key blocks (popup, accordion) store their fields under `data`. */
const savedData = (onUpdate: ReturnType<typeof vi.fn>): Record<string, unknown> =>
	(onUpdate.mock.calls.at(-1)?.[0] as { content: { data: Record<string, unknown> } }).content.data;

/** The styles an edit saved: style-key blocks (container, icon) store them on the block. */
const savedStyles = (onUpdate: ReturnType<typeof vi.fn>): Record<string, unknown> =>
	(onUpdate.mock.calls.at(-1)?.[0] as { styles: Record<string, unknown> }).styles;

describe('popup inner padding saves one shorthand and keeps the other sides', () => {
	it('editing the top-and-bottom pair writes a two-value shorthand', async () => {
		const user = userEvent.setup();
		const onUpdate = vi.fn();
		const popup = block('core/popup', { name: 'Get updates', slug: 'get-updates', padding: '20px 24px' });
		render(
			<EditorPopupsProvider blocks={[popup]}>
				<PopupSettings block={popup} onUpdate={onUpdate} />
			</EditorPopupsProvider>,
		);
		const vertical = screen.getByRole('textbox', { name: 'Top and bottom custom value' });
		await user.clear(vertical);
		await user.type(vertical, '10');
		expect(savedData(onUpdate).padding).toBe('10px 24px');
	});
});

describe('accordion inner padding stays one or two values, the shape its published CSS reads', () => {
	it('a left-and-right preset keeps the top and bottom value', async () => {
		const user = userEvent.setup();
		const onUpdate = vi.fn();
		const accordion = block('core/accordion', {}, {}, { type: 'container', children: [] });
		render(<AccordionSettings block={accordion} onUpdate={onUpdate} />);
		await user.click(screen.getByRole('button', { name: 'Look' }));
		const pair = screen.getByRole('textbox', { name: 'Left and right custom value' });
		await user.clear(pair);
		await user.type(pair, '2rem');
		expect(savedData(onUpdate).itemPadding).toBe('20px 2rem');
	});
});

describe('container padding saves through the style patch, as the Style tab does', () => {
	it('a preset writes each side as a longhand and drops the older one-box value', async () => {
		const user = userEvent.setup();
		const onUpdate = vi.fn();
		const container = block('core/container', { tagName: 'div' }, { padding: '24px' }, { type: 'container', children: [] });
		render(
			<TooltipProvider>
				<BlockSettings block={container} onUpdate={onUpdate} />
			</TooltipProvider>,
		);
		await user.click(screen.getByRole('button', { name: 'Style' }));
		await user.click(within(screen.getByRole('radiogroup', { name: 'Padding' })).getByRole('radio', { name: 'SM' }));
		expect(savedStyles(onUpdate)).toMatchObject({
			paddingTop: '0.5rem',
			paddingRight: '0.5rem',
			paddingBottom: '0.5rem',
			paddingLeft: '0.5rem',
			padding: null,
		});
	});
});

describe('icon inner padding saves through the style patch', () => {
	it('a preset sets every side and drops the older one-box value', async () => {
		const user = userEvent.setup();
		const onUpdate = vi.fn();
		const icon = block(
			'core/icon',
			{ icon: { iconSet: 'lucide', iconName: 'Star', size: 24, sizeUnit: 'px' } },
			{ padding: '8px' },
		);
		render(
			<TooltipProvider>
				<IconBlockSettings block={icon} onUpdate={onUpdate} />
			</TooltipProvider>,
		);
		await user.click(within(screen.getByRole('radiogroup', { name: 'Inner padding' })).getByRole('radio', { name: 'MD' }));
		expect(savedStyles(onUpdate)).toMatchObject({
			paddingTop: '1rem',
			paddingRight: '1rem',
			paddingBottom: '1rem',
			paddingLeft: '1rem',
			padding: null,
		});
	});
});
