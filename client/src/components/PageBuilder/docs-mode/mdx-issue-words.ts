/**
 * The MDX reader's complaints, in plain words. The reader's own sentences name its internals
 * ("expected a character that can start a name, such as a letter, `$`, or `_`"), which no writer
 * should have to decode. An answer it gives that is not listed here is shown as it came.
 */

type Rule = { when: RegExp; say: (match: RegExpExecArray) => string };

const RULES: Rule[] = [
	{ when: /^Expected a closing tag for `<([^>`]+)>`/, say: (match) => `<${match[1]}> is opened but never closed` },
	{ when: /^Unexpected closing tag `<\/([^>`]+)>`, expected corresponding closing tag for `<([^>`]+)>`/, say: (match) => `</${match[1]}> comes before <${match[2]}> is closed` },
	{ when: /^Unexpected closing slash/, say: () => "A closing tag has no opening tag before it" },
	{ when: /^Unexpected end of file/, say: () => "A tag is started but never finished" },
	{ when: /^Unexpected character `[^`]*` \(U\+[0-9A-F]+\) before attribute value/, say: () => 'A tag setting needs its value in quotes, like type="tip"' },
	{ when: /^Unexpected character `[^`]*` \(U\+[0-9A-F]+\) before name/, say: () => "A < starts a tag here. To write a less-than sign, type &lt; instead" },
	{ when: /^Unexpected character/, say: () => "There is a character here that doesn't belong inside a tag" },
];

export function describeMdxProblem(message: string): string {
	const text = message.trim();
	for (const rule of RULES) {
		const match = rule.when.exec(text);
		if (match) return rule.say(match);
	}
	return text.replace(/[.\s]+$/, "") || "This text can't be read as MDX";
}
