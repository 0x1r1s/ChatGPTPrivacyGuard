# AI Privacy Guard

A lightweight Chrome extension that redacts sensitive information from AI prompts before they are sent, while still blocking known ChatGPT draft-telemetry endpoints.

---

## The Problem

AI chat prompts often contain secrets by accident: `.env` files, API keys, passwords, tokens, database URLs, private keys, emails, phone numbers, or addresses. Once a prompt is sent, those values may be stored or processed outside your browser.

ChatGPT also has a separate privacy concern: when you type into the input box on [chatgpt.com](https://chatgpt.com), the site may fire background POST requests containing in-progress draft text before you press Enter, used for things like:

- **Autocompletion suggestions** (predicting what you'll type next)
- **Pre-emptive conversation preparation** (warming up the backend with your partial input)

This means draft text, including text you delete, rephrase, or never intentionally submit, may already have left your browser.

The specific endpoints responsible are:

| Endpoint | Method |
|---|---|
| `https://chatgpt.com/backend-anon/f/conversation/prepare` | POST |
| `https://chatgpt.com/backend-api/f/conversation/prepare` | POST |
| `https://chatgpt.com/backend-api/conversation/experimental/generate_autocompletions` | POST |

---

## The Solution

**AI Privacy Guard** protects prompts in two ways:

- It automatically scans submitted prompts and replaces detected sensitive values with `******` or safe dummy values.
- It blocks known ChatGPT draft-telemetry endpoints at the network layer using Chrome's [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) API.

Once installed:

- Prompt secrets are redacted before submission.
- Replacement counts are logged locally in extension storage and shown in the popup.
- ChatGPT draft telemetry is blocked before send.
- The normal AI chat send flow continues to work after sanitization.

## Supported Sites

- ChatGPT: `https://chatgpt.com/*`
- Claude: `https://claude.ai/*`
- DeepSeek: `https://chat.deepseek.com/*`
- Gemini: `https://gemini.google.com/*`
- Mistral: `https://chat.mistral.ai/*`
- Le Chat Mistral: `https://lechat.mistral.ai/*`

The prompt redaction content script runs on all supported sites. The network blocking rules are currently ChatGPT-specific because they target ChatGPT-only endpoints.

## Redaction Features

The sanitizer detects common sensitive values, including:

- Passwords and assigned secrets such as `PASSWORD=...`, `API_KEY=...`, `TOKEN=...`, and `CLIENT_SECRET=...`
- `.env` secrets with prefixes, such as `ADMIN_PASSWORD`, `RAILS_MASTER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEPLOY_KEY`, and `SSH_KEY`
- API keys and tokens for OpenAI, GitHub, AWS, Stripe, Slack, bearer auth, and JWTs
- Private keys
- Database, Redis, cache, DSN, and webhook-style URLs containing embedded credentials
- Email addresses, phone numbers, and street addresses

## User Controls

The extension popup provides three controls:

- **Skip next prompt**: sends the next prompt unchanged once, then automatically re-enables protection.
- **Review before sending**: pauses submission and shows detected redactions with checkboxes, so specific items can be left unredacted.
- **Allowed text**: preserves exact values entered one per line.

For one-off prompt exceptions, wrap text with inline keep markers:

```text
[[keep]]value to preserve[[/keep]]
```

The markers are removed before sending, and the wrapped value is preserved.

### How it works

The extension uses:

- `content.js` to intercept Enter on supported AI chat pages, sanitize prompt text, optionally show the review dialog, and submit the sanitized prompt.
- `popup.html`, `popup.css`, and `popup.js` for local controls and replacement logs.
- `rules.json` for static ChatGPT network blocking rules.

All replacement stats are stored locally with `chrome.storage.local`.

## Installation

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository folder.
5. Refresh any already-open AI chat tabs after reloading the extension.

## Development Notes

Chrome can generate `_metadata/` and `_metadata/generated_indexed_rulesets/` when loading or packaging the extension. Those files are generated browser artifacts and should not be committed.

This repository ignores `_metadata/` via `.gitignore`. If metadata was already tracked, remove it from git with:

```bash
git rm --cached -r _metadata
```


## Why I built this

I built this extension after a small but unsettling realization. One day I pasted some sensitive information into the ChatGPT prompt box, intending to edit and redact it before pressing Enter. I carefully cleaned it up, hit send, and only later noticed while inspecting the network tab that the original unedited text had already been transmitted to the server the moment I pasted it, via background "prepare" and autocompletion requests. The edits I made never mattered: the raw paste was gone the instant it touched the input. That moment made me realize how much of what we type but never send can leave our browsers anyway, and I wrote this project so sensitive prompt data is handled more deliberately.
