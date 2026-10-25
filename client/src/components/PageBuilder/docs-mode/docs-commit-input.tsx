import { useState, type ReactElement } from "react";
import { Input } from "@/components/ui/input";

type Props = {
	id: string;
	value: string;
	/** Called with the new text: while typing when `live`, else when the box loses focus or Enter is pressed. */
	onCommit: (value: string) => void;
	/** True when each keystroke is a cheap local edit (the docs home); false when each commit is a save to the server. */
	live?: boolean;
	placeholder?: string;
	ariaLabel?: string;
	className?: string;
};

/**
 * A text box for a setting that is saved by the server. WHY it doesn't send every keystroke: that
 * would be a save a letter, and half a word would reach visitors. The text is kept here and sent
 * once the person stops (focus leaves, or Enter). A change that arrives from elsewhere shows at
 * once, unless the person is typing in this box.
 */
export function CommitInput({ id, value, onCommit, live = false, placeholder, ariaLabel, className }: Props): ReactElement {
	const [text, setText] = useState(value);
	const [focused, setFocused] = useState(false);
	const [lastValue, setLastValue] = useState(value);
	if (value !== lastValue) {
		setLastValue(value);
		if (!focused) setText(value);
	}

	const commit = (next: string): void => {
		if (next !== value) onCommit(next);
	};

	return (
		<Input
			id={id}
			className={className}
			value={text}
			placeholder={placeholder}
			aria-label={ariaLabel}
			onFocus={() => setFocused(true)}
			onChange={(event) => {
				setText(event.target.value);
				if (live) commit(event.target.value);
			}}
			onBlur={() => {
				setFocused(false);
				commit(text);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") commit(text);
			}}
		/>
	);
}
