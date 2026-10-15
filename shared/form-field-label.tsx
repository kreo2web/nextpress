/** The id a field's control gets, so its label can point at it on every surface. */
export const formFieldControlId = (blockId: string): string => `np-field-${blockId}`;

/** Help line id so the control can point at it with aria-describedby. */
export const formFieldHelpId = (controlId: string): string => `${controlId}-help`;

export function readFormFieldHelp(help: string | undefined): string {
	return help?.trim() ?? "";
}

/**
 * Visible label above a form field (editor, preview and published pages). Nothing is drawn when
 * the field has no label and no help; the control then keeps its aria-label.
 */
export function FormFieldLabel({
	label,
	htmlFor,
	required,
	help,
}: {
	label: string | undefined;
	htmlFor: string;
	required?: boolean;
	help?: string;
}) {
	const text = label?.trim();
	const helpText = readFormFieldHelp(help);
	if (!text && !helpText) return null;
	return (
		<>
			{text ? (
				<label className="wp-block-field__label" htmlFor={htmlFor}>
					{text}
					{required ? (
						<span className="wp-block-field__required" aria-hidden="true">
							{" "}
							*
						</span>
					) : null}
				</label>
			) : null}
			{helpText ? (
				<p className="wp-block-field__help" id={formFieldHelpId(htmlFor)}>
					{helpText}
				</p>
			) : null}
		</>
	);
}
