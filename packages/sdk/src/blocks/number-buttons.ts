import type { ButtonsBlockParams } from "./block-params.js";

/**
 * Gives every button in a row an id. The editor numbers a row's buttons "btn-1", "btn-2", … and
 * its settings panel finds each button by that id, so a button saved without one cannot be edited.
 */
export const numberButtons = (params: ButtonsBlockParams): ButtonsBlockParams => {
	const buttons = params.settings?.content?.buttons;
	if (!buttons) return params;
	return {
		...params,
		settings: {
			...params.settings,
			content: {
				...params.settings?.content,
				buttons: buttons.map((button, index) =>
					button.id ? button : { ...button, id: `btn-${index + 1}` },
				),
			},
		},
	};
};
