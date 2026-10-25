---
title: Set up AI
description: Choose an AI service, add its address and model, and save your key so the assistant can work on your site.
slug: set-up-ai
kind: page
order: 1
---

The assistant works through an AI service that you connect. You choose the service, give its model name, and add your key. Only admins of a site can change these settings.

## Choose a service

NextPress supports these services:

| Service | Address needed | Model name |
|---|---|---|
| Anthropic (Claude) | No | The form suggests Claude model names |
| OpenAI | No | Type the name your provider lists |
| Google (Gemini) | No | Type the name your provider lists |
| Any OpenAI-compatible service | Yes | Type the name your provider lists |

## Set it up

<Steps>

<Step title="Open the AI settings">

Open **Settings** and choose the **AI** tab.

</Step>

<Step title="Choose the AI service">

Pick the service from the **AI service** choices.

</Step>

<Step title="Add the address">

Only **Any OpenAI-compatible service** asks for an **Address**. Three starting points are ready to pick:

- **OpenRouter** uses `https://openrouter.ai/api/v1`.
- **Ollama on this server** uses `http://localhost:11434/v1`.
- **LM Studio on this server** uses `http://localhost:1234/v1`.

</Step>

<Step title="Enter the model name">

Type the **Model name** exactly as your provider lists it today. A name the provider no longer offers will fail.

</Step>

<Step title="Add your key">

Under **Key**, press **Add a key** and paste your key. To change a saved key, press **Replace**. Then press **Save**.

</Step>

</Steps>

<Callout type="success" title="Ready to use">

Open a page in the page builder. The **Assistant** tab is ready to use. See [Use the assistant](/docs/ai-assistant/use-assistant).

</Callout>

<Accordion title="I pasted the full endpoint from my provider">

Paste the address as the provider shows it, even if it ends in `/chat/completions`. NextPress removes that ending and any trailing slashes when it saves the address. Calling the address with the ending twice would fail with a "not found" answer.

</Accordion>
