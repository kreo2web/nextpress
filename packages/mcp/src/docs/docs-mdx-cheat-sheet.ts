/** A code fence, written once so the examples can sit in a template literal. */
const FENCE = "```";

/**
 * The exact MDX syntax of every component a docs page may use, with the attributes each one takes.
 * The tags and attributes are the server's allowlist (`shared/markdown/doc-component-props.ts`), and
 * a test keeps this text and that list in step.
 */
export const DOCS_MDX_CHEAT_SHEET = `# MDX cheat sheet

Docs text is MDX: Markdown plus the components below. Use only the tags and attributes listed here.
The editor keeps these; anything else is dropped or shown as plain text.

## Rules that keep MDX working

- Put every block tag on its own line: Tabs, Tab, Steps, Step, Cards, Card, Accordion, CodeGroup, FileTree,
  Example, Param, Callout and the short callouts, and Update.
- After an opening block tag, leave one blank line. Before its closing tag, leave one blank line.
- Put attribute values in double quotes, such as title="Install".
- Do not write HTML tags, imports or JavaScript. Keep curly braces and less-than signs inside code.
- Kbd and Badge sit inside a sentence, so they do not need a line of their own.

## Markdown

- Headings: ## for a section, ### for a part, #### for a detail. Do not use a single # heading.
- Bold, italic, inline code, and links such as [Install](/docs/getting-started/install).
- Lists: lines that start with a dash, or with a number and a dot.
- Tables: a header row, a line of dashes under it, then one row per line, each cell between vertical bars:

| Setting | Default | What it does |
|---|---|---|
| title | the docs name | The name shown in the header |
| search | on | Whether the search button shows |
- Quotes: a line that starts with a greater-than sign.
- Pictures: on a line of their own, as an exclamation mark, alt text in square brackets, then the url in round brackets.

## Code blocks

Name the language right after the opening fence. Options follow it on the same line, in this order: line
marks, title, then showLineNumbers.

${FENCE}ts {2,4-6} title="app.ts" showLineNumbers
const name = "NextPress"
const greeting = "Hello, " + name
const shout = greeting.toUpperCase()
${FENCE}

- {2,4-6} marks lines 2, 4, 5 and 6. Marked lines stand out from the rest.
- title="app.ts" shows a file name above the code.
- showLineNumbers numbers every line.

## Diagrams

A Mermaid diagram is a code block whose language is mermaid:

${FENCE}mermaid
graph LR
  Write --> Check
  Check --> Publish
${FENCE}

## Callout

<Callout type="warning" title="Back up first">

Export the docs before you delete a page.

</Callout>

- type is note, tip, warning, danger or success. Any other value shows as a note.
- title is optional and shows as the callout's heading.

The short forms take the same title attribute. Each one is a callout of its type: Note (note), Tip (tip),
Warning (warning), Danger (danger), Info (a note) and Check (a success).

<Tip title="Faster">

Use the search box to find any page.

</Tip>

<Warning title="Check the address">

Changing an address breaks links to the old one.

</Warning>

<Note title="Good to know">

Notes can hold a heading and any text.

</Note>

<Info title="Versions">

This page is for the current version.

</Info>

<Check title="Done">

Your page is saved as a draft.

</Check>

<Danger title="Cannot be undone">

Deleting a page removes its text for good.

</Danger>

## Tabs

<Tabs>

<Tab title="macOS">

Text for macOS.

</Tab>

<Tab title="Linux">

Text for Linux.

</Tab>

</Tabs>

- Tab: title is the label on the tab. A Tabs block holds Tab blocks and nothing else.

## CodeGroup

<CodeGroup>

${FENCE}sh title="npm"
npm install @nextpress-org/sdk
${FENCE}

${FENCE}sh title="pnpm"
pnpm add @nextpress-org/sdk
${FENCE}

</CodeGroup>

- Each code block inside becomes one tab. Its label is its title, or its language when it has no title.

## Steps

<Steps marker="number">

<Step title="Install">

Run the installer and wait for it to finish.

</Step>

<Step title="Sign in">

Open the dashboard and sign in with your account.

</Step>

</Steps>

- Steps: marker is number (the default), dot, or icon.
- Step: title is the step's name. icon is a Lucide icon name such as rocket. It only shows with marker="icon".

<Steps marker="icon">

<Step title="Launch" icon="rocket">

Press the launch button.

</Step>

</Steps>

## Cards

<Cards cols="2">

<Card title="Install" href="/docs/getting-started/install">

Get NextPress running.

</Card>

<Card title="Your first page" href="/docs/getting-started/first-page">

Make a page and check how it looks.

</Card>

</Cards>

- Cards: cols is how many cards sit side by side on a desktop, from 1 to 4. The default is 2. Phones always show one.
- Card: title is the heading. href is where the whole card links: a docs address or an https link.

## Accordion

<Accordion title="Can I use my own domain?">

Yes. Add the domain in the settings, then point its DNS record at the site.

</Accordion>

- Accordion: title is the question. The text opens when the reader clicks it.

## FileTree

<FileTree>

- my-app/
  - src/
    - app.ts  # the entry point
  - package.json

</FileTree>

- FileTree holds a list. Each line is a file or a folder, and indented lines sit inside the folder above.
- A # comment after a name explains it. A name in bold on its own line is highlighted.

## Param

<Param name="limit" type="number" default="20">

How many items to show, from 1 to 100.

</Param>

<Param name="id" type="string" required>

The page's id, from get_docs_tree.

</Param>

- Param: name, type and default are optional text. required is a bare word with no value.
- The text under a Param says what the option does.

## Example

<Example layout="side">

${FENCE}ts
const total = 2 + 3
${FENCE}

The result is 5.

</Example>

- Example: the first code block is the code, and the text after it is the result.
- layout is side (the default: code and result side by side on wide screens) or stacked (the result under
  the code). Phones always stack them.

## Kbd and Badge

Press <Kbd>Ctrl</Kbd> and <Kbd>K</Kbd> to search.

This feature is <Badge tone="success" look="soft">New</Badge>.

- Kbd is one key on the keyboard. It takes no attributes.
- Badge is a short label. tone is accent, neutral, success, warning or danger. look is soft, outline or solid.

## Update

<Update label="0.4.0" description="Docs pages from the SDK and MCP">

Agents can list, add, move and write docs pages.

</Update>

- Update is one release note. label is the version or the date, and description is one sentence.
  Put the newest release first.
`;
