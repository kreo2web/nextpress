---
title: Forgot your password?
description: Set a new password for an account that can't sign in, from your server's command line.
slug: forgot-password
kind: page
order: 4
---

NextPress has no reset-by-email, and there is no web page for this. Someone with access to the server's command line sets a new password instead. That is the same person who can already reach the server's files and database.

<Tabs>

<Tab title="On your server">

Run this, with the email or username of the account:

```bash title="Set a new password"
nextpress reset-password you@example.com
```

It asks for the new password twice. What you type does not show on the screen. When both match, it saves the password and signs them out on every device. Your sites stay online the whole time, and nothing else changes.

A password needs at least 8 characters, and at most 128.

When it works, it prints:

```text title="Success message"
Password changed for you@example.com. They were signed out everywhere; sign in with the new password.
```

If NextPress is installed outside `/opt/nextpress`, add `--install-dir <path>` before the command, the same way as other commands. See [The nextpress command](/docs/self-hosting/nextpress-command).

</Tab>

<Tab title="On a local copy">

Stop `pnpm dev` first. The local database can only be open in one program at a time, and the command refuses to start while the dev server has it open.

From the project folder, run:

```bash title="Set a new password on a local copy"
pnpm reset-password you@example.com
```

It asks for the new password twice, the same way as on a server.

</Tab>

</Tabs>

## Use it in a script

Use `--password-stdin` to pass the password in from a pipe instead of typing it. The password never goes in the command itself, so it stays out of your shell history.

```bash title="Set a new password from a script"
printf '%s\n' "$NEW_PASSWORD" | nextpress reset-password you@example.com --password-stdin
```

## If something goes wrong

| Message | What to do |
|---|---|
| "No account uses "…". Check the email or username and try again." | Check the spelling. Usernames and emails ignore capital letters. |
| "The two passwords don't match. Nothing was changed." | Run the command again and type the same password twice. |
| "Use at least 8 characters. Nothing was changed." | Pick a longer password. |
| "This NextPress version can't reset passwords yet. Run: nextpress upgrade" | Upgrade first. See [Upgrade](/docs/getting-started/upgrade). |
| "NextPress is not running. Start it first: nextpress restart" | Start NextPress, then run the command again. |
| "Refusing to ask for a password without an interactive terminal." | Run the command from a terminal, or pipe the password in with `--password-stdin`. |
