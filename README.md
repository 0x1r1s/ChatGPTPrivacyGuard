# ChatGPT Privacy Guard

A lightweight Chrome extension that stops ChatGPT from silently transmitting what you type **before you press Enter**.

---

## The Problem

When you type into the ChatGPT input box on [chatgpt.com](https://chatgpt.com), the site does **not** wait for you to submit your message. As you type, the page continuously fires background POST requests containing your in-progress draft to OpenAI's servers, used for things like:

- **Autocompletion suggestions** (predicting what you'll type next)
- **Pre-emptive conversation preparation** (warming up the backend with your partial input)

This means **every keystroke — including text you delete, rephrase, or never send — can leave your browser**. Drafts you intentionally never submitted may already be on the server.

The specific endpoints responsible are:

| Endpoint | Method |
|---|---|
| `https://chatgpt.com/backend-anon/f/conversation/prepare` | POST |
| `https://chatgpt.com/backend-api/f/conversation/prepare` | POST |
| `https://chatgpt.com/backend-api/conversation/experimental/generate_autocompletions` | POST |

---

## The Solution

**ChatGPT Privacy Guard** blocks these three endpoints at the network layer using Chrome's [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) API.

Once installed:

- ✅ Your draft text **stays in your browser** until you actually press Enter (or click Send).
- ✅ The normal "send message" request is **untouched** — ChatGPT continues to work normally when you submit.
- ✅ No request bodies are ever read, logged, or modified by this extension. It only blocks.

### How it works

The extension ships with a static `rules.json` containing three block rules — one per endpoint — scoped to `https://chatgpt.com/*`. Chrome enforces these rules natively; the extension itself runs no JavaScript at runtime.


## Why I built this

I built this extension after a small but unsettling realization. One day I pasted some sensitive information into the ChatGPT prompt box, intending to edit and redact it before pressing Enter. I carefully cleaned it up, hit send — and only later noticed, while inspecting the network tab, that the original unedited text had already been transmitted to the server the moment I pasted it, via background "prepare" and autocompletion requests. The edits I made never mattered: the raw paste was gone the instant it touched the input. That moment made me realize how much of what we type but never send is leaving our browsers anyway, and I wrote ChatGPT Privacy Guard so that nothing leaves until I explicitly choose to send it.
