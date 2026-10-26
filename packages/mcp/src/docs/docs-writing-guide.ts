/**
 * How to write a good docs page in NextPress, in plain words. The MDX syntax of each component is
 * in the cheat sheet (`docs-mdx-cheat-sheet.ts`); this file says when to use each one.
 */
export const DOCS_WRITING_GUIDE = `# Writing docs pages in NextPress

NextPress draws the docs around each page: the header, the sidebar, the title, the description under
the title, "On this page", and the previous and next links. Your text is the page under the title.

## Each page

- One idea per page. A reader comes to find one answer. When a page covers two things, make two pages.
- A description. One or two plain sentences that say what the reader gets from the page. It shows under
  the title, in search and in link previews. Every page needs one: save it with write_docs_page.
- A short opening. The first paragraph says what the page covers and who it is for.
- Sections with ## headings. Use ### and #### for parts of a section. Do not use a single # heading: the
  page title already takes that place.
- Six sections at most. When a page needs more, split it into pages under a group.
- No table of contents. "On this page" is built from the headings.

## Words

- Short sentences, one idea in each paragraph. Write to "you".
- Plain words. Say "turn on", not "enable". The first time a technical word appears, say what it means.
- Use the names the screens use, for buttons, menus and fields, so the reader can find them.
- Do not write "simply", "just", "easy" or "obviously". A hard step should not sound small.
- Write commands, file names, field names and code in backticks.
- Use a list for three or more things of the same kind. Use Steps for things done in order.
- Name a link after where it goes: "Set up AI", not "click here".

## Pick the right component

| The page needs | Use |
|---|---|
| Things done in order | Steps |
| One option of several, such as an operating system | Tabs |
| The same command for several tools (npm, pnpm, bun) | CodeGroup |
| A warning that the reader could lose data or break a live site | Warning |
| Something that cannot be undone, or that exposes a secret | Danger |
| A faster or safer way | Tip |
| Context the reader can skip | Note |
| A result that shows the task worked | Check |
| A flow between parts, or the order of things in a system | A Mermaid diagram |
| An overview page that leads to the pages under it | Cards |
| An answer most readers do not need, such as an FAQ or an advanced option | Accordion |
| An option, a field or an argument, with its type and default | Param |
| Code beside the result it gives | Example |
| A folder layout | FileTree |
| A release note | Update |
| A key on the keyboard, or a short label such as "New" | Kbd or Badge |
| A picture | An image on a line of its own |
| Values to compare side by side | A table |

Plain text and lists do most of the work. Use a component when it helps the reader, not for decoration.
A page full of boxes is harder to read than a page with a few.

## Steps for tasks

A task is a list of actions in order. Use Steps with one action per step, and give each step a short
title that names the action. When the reader can check the result, end with a Check.

## Alternatives

Use Tabs when the reader picks one option of several. Put the most common option first. Use CodeGroup to
show the same command for several tools, so the reader picks the one they use.

## Warnings, tips and notes

- Warning: a step that can lose data or break a live site.
- Danger: something that cannot be undone, or that exposes a secret.
- Tip: a faster or safer way to do something.
- Note: extra context the reader can skip.
- Check: a result that tells the reader the task worked.

Keep each box to one or two sentences. Put it right after the step or paragraph it belongs to.

## Diagrams

Draw a flow or a sequence with a Mermaid diagram: a code block whose language is mermaid. Keep it to
about eight boxes; split the page when it needs more. Label each arrow in plain words. The text around
the diagram says what it shows, so the page still makes sense without the picture.

## Overview pages

A group's first page, or the docs home, can be an overview: a short paragraph, then Cards with one card
for each page under it. Each card has a title, the address of the page as its link, and one sentence.

## Code

- Give a code block a title when the reader must know which file it belongs to, such as app.ts.
- Mark the lines that matter with a list of line numbers, such as 2 and 4 to 6.
- Show line numbers only when the text refers to lines by number.
- Show code that works when the reader copies it. Put what the reader must change in square brackets,
  and say what it is in the text.
- Put the language right after the three opening backticks (ts, sh, json) so the code is coloured.

## Links and pictures

- Link to another docs page by its address. get_docs_tree lists every address. Check it exists before you save.
- Upload a picture with upload_media, then put the url it returns on a line of its own, as a picture with
  alt text: an exclamation mark, the alt text in square brackets, then the url in round brackets.
- Alt text says what the picture shows, in one sentence.

## Before you save

- The page has a description.
- Headings start at ## and the page has no single # heading.
- Every component tag is on its own line, with a blank line after an opening tag and before a closing tag.
- Every link points to a page that exists.
- Every code block names its language.
- The text has no "simply", "just" or "easy".

## Saving and checking

- read_docs_page gives the page's MDX and its version. Write the whole page with write_docs_page and send
  that version as expectedVersion.
- When the reply names a line, nothing was saved. Fix that line and send the whole page again.
- When the reply says the page changed somewhere else, read the page again and put your change into the new text.
- Blocks that read_docs_page lists under "no MDX form" are dropped when the page is written. Put that
  content into the MDX text first.
- Pages stay drafts. Use publish_page only when the owner asks.
`;
