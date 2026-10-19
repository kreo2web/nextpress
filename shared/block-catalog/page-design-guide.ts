/**
 * How to build a NextPress page that looks good and works on phones. One text for
 * every agent: the MCP server offers it as a prompt and the in-editor assistant
 * reads it as its instructions. Block-by-block advice lives in `agent-notes.ts`.
 */
export const PAGE_DESIGN_GUIDE = `# Building NextPress pages

## Shape of a page
- One Page shell at the root holds the whole page. It sets the font, the content width (960px to 1440px, or full width), the side and top/bottom padding, the page background and the text colour. Change those there, not on each section.
- Header first inside the shell, footer last. If the site already has a linked header or footer template, use it (Template block) instead of making a new one.
- Then sections: a Stack (vertical) or a Group with \`tagName: "section"\`. One idea per section: hero, features, proof, pricing, questions, final call to action.
- A typical landing page: hero (main heading, one sentence, one main button), three features, proof (logos or a testimonial), questions (Accordion), a closing call to action, footer.

## Words
- One level-1 heading per page, in the hero. Sections use level 2, points inside them level 3.
- Short sentences. At most three sentences per paragraph.
- Write for the person's real business. Never use lorem ipsum. When you don't know a fact (a price, a name, a number), write a clear placeholder in brackets, such as [Your price], instead of inventing one.
- Buttons say what happens: "Book a call", not "Click here". One main button per section.

## Colour and type
- Follow the site theme with CSS variables in \`styles\`:
  - \`var(--npb-accent)\` for the brand colour (main buttons, highlights), \`var(--npb-accent-foreground)\` for text on it
  - \`var(--npb-text-primary)\`, \`var(--npb-text-secondary)\`, \`var(--npb-text-muted)\` for text
  - \`var(--npb-surface-base)\` and \`var(--npb-surface-raised)\` for backgrounds and cards
  - \`var(--npb-border-default)\` for lines, \`var(--npb-radius-surface)\` for card corners
- Use a fixed colour only when the person asks for one.
- Keep text readable: dark text on light backgrounds, light text on dark ones. Never light grey on white.
- The font comes from the page shell. Don't set a font on single blocks unless asked.

## Spacing
- Inside blocks use the shared scale: 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem. Between sections use more room (3rem to 6rem above and below).
- Space children with \`styles.gap\` on their parent rather than spacers or margins.
- New blocks start with the editor's default padding. In cards and rows, set \`padding\` on purpose so the spacing stays even.

## Phones
- Every page must work 390px wide.
- Never give a block a fixed width over 480px. Use \`width: 100%\` with a \`maxWidth\`.
- Rows must fold: a horizontal Stack or Group needs \`flexWrap: "wrap"\`, or use a grid such as \`gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))"\`. Columns fold on their own.
- After building, run the page check and apply its phone fixes.

## Pictures and links
- Look in the media library first. If nothing fits, use the placeholder image and say so. Never point images at other websites.
- Every meaningful picture gets alt text that says what it shows.
- Link only to pages that exist on this site (list them first). If a page you need doesn't exist yet, say so instead of making up an address.
- A popup opens from any link to \`#popup-<slug>\`.

## Working with the person
- Change only what was asked. When a block is selected, stay inside that block.
- Work in small steps: read the page outline, make a change, check it.
- When done, say in one or two plain sentences what changed and anything the person should fill in.
`;
