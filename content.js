const SECRET_PLACEHOLDER = "******";

const STORAGE_KEYS = {
  total: "privacyGuardTotalReplacements",
  byType: "privacyGuardReplacementsByType",
  events: "privacyGuardReplacementEvents",
  skipNextPrompt: "privacyGuardSkipNextPrompt",
  allowedPhrases: "privacyGuardAllowedPhrases",
  reviewBeforeSend: "privacyGuardReviewBeforeSend"
};

const MAX_EVENTS = 25;

function isValidCreditCardNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isReasonableCardExpiry(value) {
  const compact = String(value || "").replace(/\s/g, "");
  const parts = compact.includes("/") ? compact.split("/") : [
    compact.slice(0, 2),
    compact.slice(2)
  ];
  const month = Number(parts[0]);
  let year = Number(parts[1]);

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return false;
  }

  if (year < 100) {
    year += 2000;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const maxYear = currentYear + 20;

  if (year < currentYear || year > maxYear) {
    return false;
  }

  return year !== currentYear || month >= currentMonth;
}

const PATTERNS = [
  {
    type: "private_key",
    label: "Private keys",
    replacement: SECRET_PLACEHOLDER,
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
  },
  {
    type: "jwt",
    label: "JWTs",
    replacement: SECRET_PLACEHOLDER,
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
  },
  {
    type: "openai_key",
    label: "OpenAI API keys",
    replacement: SECRET_PLACEHOLDER,
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g
  },
  {
    type: "github_token",
    label: "GitHub tokens",
    replacement: SECRET_PLACEHOLDER,
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b/g
  },
  {
    type: "slack_token",
    label: "Slack tokens",
    replacement: SECRET_PLACEHOLDER,
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g
  },
  {
    type: "stripe_key",
    label: "Stripe keys",
    replacement: SECRET_PLACEHOLDER,
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g
  },
  {
    type: "aws_access_key",
    label: "AWS access keys",
    replacement: SECRET_PLACEHOLDER,
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g
  },
  {
    type: "bearer_token",
    label: "Bearer tokens",
    replacement: "Bearer ******",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi
  },
  {
    type: "connection_url_password",
    label: "Connection URL passwords",
    replacement: "$1******$3",
    regex: /\b([A-Z0-9_]*(?:URL|URI|DSN)\s*=\s*["']?[a-z][a-z0-9+.-]*:\/\/[^:\s"'@]+:)([^@\s"']+)(@)/gi
  },
  {
    type: "redis_url_password",
    label: "Redis URL passwords",
    replacement: "$1******$3",
    regex: /\b([A-Z0-9_]*(?:REDIS|CACHE)[A-Z0-9_]*(?:URL|URI)?\s*=\s*["']?rediss?:\/\/:)([^@\s"']+)(@)/gi
  },
  {
    type: "webhook_or_dsn",
    label: "Webhook and DSN values",
    replacement: "$1$2******$2",
    regex: /\b([A-Z0-9_]*(?:WEBHOOK|SENTRY_DSN|ROLLBAR_TOKEN|HONEYBADGER_API_KEY)[A-Z0-9_]*\s*[:=]\s*)(["']?)(?!\*{6}\2)[^\r\n"']{10,}\2/gi
  },
  {
    type: "env_secret",
    label: "Environment secrets",
    replacement: "$1$2******$2",
    regex: /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|PASS|PWD|API[_-]?KEY|SECRET|TOKEN|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|AUTH[_-]?HEADER|CREDENTIALS?|CERTIFICATE|ENCRYPTION[_-]?KEY|SIGNING[_-]?KEY|MASTER[_-]?KEY|SERVICE[_-]?ROLE[_-]?KEY|DEPLOY[_-]?KEY|SSH[_-]?KEY)[A-Z0-9_]*\s*[:=]\s*)(["']?)(?!\*{6}\2)[^\r\n"']{4,}\2/gi
  },
  {
    type: "assigned_secret",
    label: "Assigned secrets",
    replacement: "$1$2******$2",
    regex: /\b([A-Za-z0-9_-]*(?:password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|client[_-]?secret)[A-Za-z0-9_-]*\s*[:=]\s*)(["']?)(?!\*{6}\2)[^\s"'`,;]{4,}\2/gi
  },
  {
    type: "personal_info",
    label: "Personal names",
    replacement: "$1$2******$2",
    regex: /(\b["']?(?:first[_-]?name|last[_-]?name|full[_-]?name)["']?\s*:\s*)(["'])(?!\*{6}\2)[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'. -]{1,80}\2/gi
  },
  {
    type: "personal_info",
    label: "Dates of birth",
    replacement: "$1$2******$2",
    regex: /(\b["']?(?:date[_-]?of[_-]?birth|dob)["']?\s*:\s*)(["'])(?!\*{6}\2)(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\2/gi
  },
  {
    type: "personal_info",
    label: "Government identifiers",
    replacement: "$1$2******$2",
    regex: /(\b["']?(?:national[_-]?id|passport(?:[_-]?number)?)["']?\s*:\s*)(["'])(?!\*{6}\2)[A-Za-z0-9][A-Za-z0-9 -]{5,40}\2/gi
  },
  {
    type: "personal_info",
    label: "Address fields",
    replacement: "$1$2******$2",
    regex: /(\b["']?(?:street|city|postal[_-]?code|zip(?:[_-]?code)?|country)["']?\s*:\s*)(["'])(?!\*{6}\2)[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ'. -]{2,100}\2/gi
  },
  {
    type: "credit_card_number",
    label: "Credit card numbers",
    replacement: (match) => isValidCreditCardNumber(match) ? match.replace(/\d/g, "*") : match,
    regex: /\b(?:4\d{3}(?:[\s-]?\d{4}){3}|(?:5[1-5]\d{2}|2(?:2[2-9]\d|[3-6]\d{2}|7[01]\d|720)|6(?:011|5\d{2}))(?:[\s-]?\d{4}){3}|3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5})\b/g
  },
  {
    type: "credit_card_expiry",
    label: "Credit card expiry dates",
    replacement: (match, prefix, quote, expiry) => {
      return isReasonableCardExpiry(expiry) ? `${prefix}${quote}******${quote}` : match;
    },
    regex: /(\b["']?(?:exp(?:iry|iration)?|card[_-]?exp(?:iry|iration)?|cc[_-]?exp(?:iry|iration)?)["']?\s*:\s*)(["'])(?!\*{6}\2)((?:0[1-9]|1[0-2])(?:\s*\/\s*)?(?:\d{2}|\d{4}))\2/gi
  },
  {
    type: "credit_card_cvv",
    label: "Credit card security codes",
    replacement: "$1$2******$2",
    regex: /(\b["']?(?:cvv|cvc|cid|card[_-]?security[_-]?code|card[_-]?verification[_-]?code)["']?\s*:\s*)(["'])(?!\*{6}\2)\d{3,4}\2/gi
  },
  {
    type: "email",
    label: "Email addresses",
    replacement: "user@example.com",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },
  {
    type: "phone",
    label: "Phone numbers",
    replacement: "555-0100",
    regex: /(?<!\w)(?:\+\d{1,3}(?:[\s.-]?\d{1,4}){4,6}|(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})(?!\w)/g
  },
  {
    type: "address",
    label: "Street addresses",
    replacement: "123 Example Street",
    regex: /\b\d{1,6}\s+(?:(?:(?:Rue|Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Place|Pl\.?|Terrace|Ter\.?|Calle|Via|Strasse|Straße)\s+)?(?:[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ0-9'.-]*\s+){1,6}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Place|Pl\.?|Terrace|Ter\.?|Rue|Calle|Via|Strasse|Straße)?)(?:\s*(?:,|#|Apt\.?|Suite|Ste\.?)\s*[A-Za-z0-9 -]+)?\b/gi
  }
];

const settings = {
  skipNextPrompt: false,
  allowedPhrases: [],
  reviewBeforeSend: false
};

let resubmitting = false;
let extensionContextAvailable = true;

function hasStorage() {
  return extensionContextAvailable && typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function disableExtensionContext(error) {
  extensionContextAvailable = false;
  console.warn("AI Privacy Guard storage is unavailable until this tab is refreshed.", error);
}

async function storageGet(keys) {
  if (!hasStorage()) {
    return {};
  }

  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    disableExtensionContext(error);
    return {};
  }
}

async function storageSet(values) {
  if (!hasStorage()) {
    return;
  }

  try {
    await chrome.storage.local.set(values);
  } catch (error) {
    disableExtensionContext(error);
  }
}

function addStorageChangeListener(listener) {
  if (!hasStorage()) {
    return;
  }

  try {
    chrome.storage.onChanged.addListener(listener);
  } catch (error) {
    disableExtensionContext(error);
  }
}

function normalizeAllowedPhrases(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((phrase) => phrase.trim()).filter(Boolean))];
}

function applyStoredSettings(values) {
  settings.skipNextPrompt = Boolean(values[STORAGE_KEYS.skipNextPrompt]);
  settings.allowedPhrases = normalizeAllowedPhrases(values[STORAGE_KEYS.allowedPhrases]);
  settings.reviewBeforeSend = Boolean(values[STORAGE_KEYS.reviewBeforeSend]);
}

function loadStoredSettings() {
  if (!hasStorage()) {
    return;
  }

  storageGet([
    STORAGE_KEYS.skipNextPrompt,
    STORAGE_KEYS.allowedPhrases,
    STORAGE_KEYS.reviewBeforeSend
  ]).then(applyStoredSettings);

  addStorageChangeListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.skipNextPrompt]) {
      settings.skipNextPrompt = Boolean(changes[STORAGE_KEYS.skipNextPrompt].newValue);
    }

    if (changes[STORAGE_KEYS.allowedPhrases]) {
      settings.allowedPhrases = normalizeAllowedPhrases(changes[STORAGE_KEYS.allowedPhrases].newValue);
    }

    if (changes[STORAGE_KEYS.reviewBeforeSend]) {
      settings.reviewBeforeSend = Boolean(changes[STORAGE_KEYS.reviewBeforeSend].newValue);
    }
  });
}

function consumeSkipNextPrompt() {
  settings.skipNextPrompt = false;
  return storageSet({ [STORAGE_KEYS.skipNextPrompt]: false });
}

async function getCurrentSettings() {
  if (!hasStorage()) {
    return settings;
  }

  const values = await storageGet([
    STORAGE_KEYS.skipNextPrompt,
    STORAGE_KEYS.allowedPhrases,
    STORAGE_KEYS.reviewBeforeSend
  ]);

  applyStoredSettings(values);
  return settings;
}

function protectAllowedText(text, allowedPhrases) {
  const replacements = [];
  let protectedText = String(text || "");

  protectedText = protectedText.replace(/\[\[keep\]\]([\s\S]*?)\[\[\/keep\]\]/gi, (_match, keptText) => {
    const token = `__PRIVACY_GUARD_INLINE_ALLOWED_${replacements.length}__`;
    replacements.push({ token, phrase: keptText });
    return token;
  });

  normalizeAllowedPhrases(allowedPhrases)
    .sort((first, second) => second.length - first.length)
    .forEach((phrase, index) => {
      if (!protectedText.includes(phrase)) {
        return;
      }

      const token = `__PRIVACY_GUARD_ALLOWED_${index}_${replacements.length}__`;
      protectedText = protectedText.split(phrase).join(token);
      replacements.push({ token, phrase });
    });

  return {
    text: protectedText,
    restore(value) {
      return replacements.reduce((restored, replacement) => {
        return restored.split(replacement.token).join(replacement.phrase);
      }, value);
    }
  };
}

function buildReplacement(pattern, args) {
  let replacement = pattern.replacement;

  if (typeof replacement === "function") {
    replacement = replacement(...args);
  }

  if (typeof replacement !== "string") {
    return args[0];
  }

  return replacement.replace(/\$(\d+)/g, (_token, index) => args[Number(index)] || "");
}

function restoreTokenizedText(text, replacements) {
  return replacements.reduce((restored, replacement) => {
    return restored.split(replacement.token).join(replacement.value);
  }, text);
}

function runSanitizer(text, allowedPhrases = [], shouldRedact = () => true) {
  const counts = {};
  const redactions = [];
  const skipped = [];
  const allowed = protectAllowedText(String(text || ""), allowedPhrases);
  let sanitized = allowed.text;

  for (const pattern of PATTERNS) {
    try {
      pattern.regex.lastIndex = 0;
      sanitized = sanitized.replace(pattern.regex, (...args) => {
        const match = String(args[0] || "");
        const replacement = buildReplacement(pattern, args);

        if (replacement === match) {
          return match;
        }

        const redaction = {
          id: `redaction-${redactions.length}`,
          type: pattern.type,
          label: pattern.label,
          original: match,
          replacement
        };
        redactions.push(redaction);

        if (!shouldRedact(redaction)) {
          const token = `******__PRIVACY_GUARD_SKIPPED_${skipped.length}__`;
          skipped.push({ token, value: match });
          return token;
        }

        counts[pattern.type] = (counts[pattern.type] || 0) + 1;
        return replacement;
      });
    } catch (error) {
      console.warn("AI Privacy Guard skipped a redaction pattern", pattern.type, error);
    }
  }

  sanitized = restoreTokenizedText(sanitized, skipped);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { sanitized: allowed.restore(sanitized), counts, total, redactions };
}

function sanitizeText(text, allowedPhrases = [], selectedRedactionIds = null) {
  const selected = selectedRedactionIds ? new Set(selectedRedactionIds) : null;
  return runSanitizer(text, allowedPhrases, (redaction) => {
    return !selected || selected.has(redaction.id);
  });
}

function collectRedactions(text, allowedPhrases = []) {
  return runSanitizer(text, allowedPhrases).redactions;
}

function getComposer() {
  const selectors = [
    "#prompt-textarea",
    "textarea[data-id='root']",
    "textarea[aria-label*='prompt' i]",
    "textarea[aria-label*='message' i]",
    "textarea[placeholder]",
    "div[contenteditable='true'][data-id='root']",
    "div[contenteditable='true'][aria-label*='prompt' i]",
    "div[contenteditable='true'][aria-label*='message' i]",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']"
  ];

  return selectors.map((selector) => document.querySelector(selector)).find(Boolean);
}

function readComposerText(composer) {
  if (!composer) {
    return "";
  }

  if ("value" in composer) {
    return composer.value;
  }

  return composer.innerText || composer.textContent || "";
}

function setComposerText(composer, text) {
  if ("value" in composer) {
    composer.value = text;
  } else {
    composer.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
  }

  composer.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertReplacementText",
    data: text
  }));
}

async function logReplacements(counts, total) {
  if (!hasStorage() || total <= 0) {
    return;
  }

  const current = await storageGet([
    STORAGE_KEYS.total,
    STORAGE_KEYS.byType,
    STORAGE_KEYS.events
  ]);

  const byType = { ...(current[STORAGE_KEYS.byType] || {}) };
  for (const [type, count] of Object.entries(counts)) {
    byType[type] = (byType[type] || 0) + count;
  }

  const events = current[STORAGE_KEYS.events] || [];
  events.unshift({
    at: new Date().toISOString(),
    total,
    counts
  });

  await storageSet({
    [STORAGE_KEYS.total]: (current[STORAGE_KEYS.total] || 0) + total,
    [STORAGE_KEYS.byType]: byType,
    [STORAGE_KEYS.events]: events.slice(0, MAX_EVENTS)
  });
}

function clickSendButton(composer) {
  const selectors = [
    "button[data-testid='send-button']",
    "button[data-testid='composer-send-button']",
    "button[aria-label='Send prompt']",
    "button[aria-label='Send message']",
    "button[aria-label*='send' i]",
    "button[type='submit']"
  ];

  const searchRoots = [composer.closest("form"), composer.parentElement, document].filter(Boolean);
  const button = searchRoots.flatMap((root) => {
    return selectors.map((selector) => root.querySelector(selector));
  }).find((candidate) => {
    return candidate && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true";
  });

  if (button) {
    button.click();
    return true;
  }

  return false;
}

function redispatchEnter(target) {
  resubmitting = true;
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  }));
  resubmitting = false;
}

function submitPrompt(composer) {
  requestAnimationFrame(() => {
    if (!clickSendButton(composer)) {
      redispatchEnter(composer);
    }
  });
}

function isPlainEnter(event) {
  return event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.isComposing;
}

function ensureReviewStyles() {
  if (document.getElementById("privacy-guard-review-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "privacy-guard-review-styles";
  style.textContent = `
    .privacy-guard-review-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(18, 24, 27, 0.48);
      color: #171717;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .privacy-guard-review-dialog {
      width: min(720px, 100%);
      max-height: min(680px, calc(100vh - 40px));
      display: grid;
      grid-template-rows: auto 1fr auto;
      border: 1px solid #d8d8d2;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.26);
      overflow: hidden;
    }

    .privacy-guard-review-header,
    .privacy-guard-review-actions {
      padding: 14px 16px;
      border-bottom: 1px solid #e6e6e2;
    }

    .privacy-guard-review-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid #e6e6e2;
      border-bottom: 0;
    }

    .privacy-guard-review-title {
      margin: 0;
      font-size: 16px;
      line-height: 1.25;
      font-weight: 700;
    }

    .privacy-guard-review-subtitle {
      margin: 4px 0 0;
      color: #5f625d;
      font-size: 12px;
    }

    .privacy-guard-review-list {
      display: grid;
      gap: 8px;
      overflow: auto;
      padding: 12px 16px;
      background: #f7f7f5;
    }

    .privacy-guard-review-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      padding: 10px;
      border: 1px solid #ddddda;
      border-radius: 8px;
      background: #ffffff;
    }

    .privacy-guard-review-item input {
      width: 16px;
      height: 16px;
      margin-top: 2px;
      accent-color: #126e5d;
    }

    .privacy-guard-review-label {
      font-size: 13px;
      font-weight: 700;
    }

    .privacy-guard-review-values {
      display: grid;
      gap: 3px;
      min-width: 0;
      margin-top: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.35;
    }

    .privacy-guard-review-values span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .privacy-guard-review-button {
      min-height: 34px;
      border: 1px solid #cdd1cb;
      border-radius: 8px;
      padding: 7px 12px;
      cursor: pointer;
      color: #171717;
      background: #ffffff;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
    }

    .privacy-guard-review-button.primary {
      color: #ffffff;
      border-color: #126e5d;
      background: #126e5d;
    }
  `;
  document.documentElement.append(style);
}

function shortenReviewValue(value) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function showRedactionReview(redactions) {
  ensureReviewStyles();

  document.getElementById("privacy-guard-review-overlay")?.remove();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "privacy-guard-review-overlay";
    overlay.className = "privacy-guard-review-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "privacy-guard-review-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "privacy-guard-review-title");

    const header = document.createElement("header");
    header.className = "privacy-guard-review-header";

    const title = document.createElement("h2");
    title.id = "privacy-guard-review-title";
    title.className = "privacy-guard-review-title";
    title.textContent = "Review redactions";

    const subtitle = document.createElement("p");
    subtitle.className = "privacy-guard-review-subtitle";
    subtitle.textContent = "Checked items will be redacted before the prompt is sent.";

    header.append(title, subtitle);

    const list = document.createElement("div");
    list.className = "privacy-guard-review-list";

    for (const redaction of redactions) {
      const row = document.createElement("label");
      row.className = "privacy-guard-review-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = redaction.id;
      checkbox.checked = true;

      const body = document.createElement("span");

      const label = document.createElement("span");
      label.className = "privacy-guard-review-label";
      label.textContent = redaction.label;

      const values = document.createElement("span");
      values.className = "privacy-guard-review-values";

      const original = document.createElement("span");
      original.textContent = shortenReviewValue(redaction.original);

      const replacement = document.createElement("span");
      replacement.textContent = `-> ${shortenReviewValue(redaction.replacement)}`;

      values.append(original, replacement);
      body.append(label, values);
      row.append(checkbox, body);
      list.append(row);
    }

    const actions = document.createElement("footer");
    actions.className = "privacy-guard-review-actions";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "privacy-guard-review-button";
    clearButton.textContent = "Clear all";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "privacy-guard-review-button";
    allButton.textContent = "Select all";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "privacy-guard-review-button";
    cancelButton.textContent = "Cancel";

    const sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.className = "privacy-guard-review-button primary";
    sendButton.textContent = "Send";

    actions.append(clearButton, allButton, cancelButton, sendButton);
    dialog.append(header, list, actions);
    overlay.append(dialog);
    document.documentElement.append(overlay);

    const cleanup = (value) => {
      document.removeEventListener("keydown", handleEscape, true);
      overlay.remove();
      resolve(value);
    };

    const setAll = (checked) => {
      list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = checked;
      });
    };

    function handleEscape(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup(null);
      }
    }

    clearButton.addEventListener("click", () => setAll(false));
    allButton.addEventListener("click", () => setAll(true));
    cancelButton.addEventListener("click", () => cleanup(null));
    sendButton.addEventListener("click", () => {
      const selected = [...list.querySelectorAll("input[type='checkbox']:checked")]
        .map((checkbox) => checkbox.value);
      cleanup(selected);
    });

    document.addEventListener("keydown", handleEscape, true);
    sendButton.focus();
  });
}

document.addEventListener("keydown", async (event) => {
  if (resubmitting || !isPlainEnter(event)) {
    return;
  }

  const composer = getComposer();
  if (!composer || !composer.contains(event.target)) {
    return;
  }

  const original = readComposerText(composer);
  event.preventDefault();
  event.stopImmediatePropagation();

  const currentSettings = await getCurrentSettings();

  if (currentSettings.skipNextPrompt) {
    await consumeSkipNextPrompt();
    submitPrompt(composer);
    return;
  }

  let selectedRedactionIds = null;
  if (currentSettings.reviewBeforeSend) {
    const redactions = collectRedactions(original, currentSettings.allowedPhrases);
    if (redactions.length > 0) {
      selectedRedactionIds = await showRedactionReview(redactions);
      if (!selectedRedactionIds) {
        return;
      }
    }
  }

  const result = sanitizeText(original, currentSettings.allowedPhrases, selectedRedactionIds);

  if (result.sanitized !== original) {
    setComposerText(composer, result.sanitized);
  }

  if (result.total > 0) {
    await logReplacements(result.counts, result.total);
  }

  submitPrompt(composer);
}, true);

loadStoredSettings();
