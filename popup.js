const STORAGE_KEYS = {
  total: "privacyGuardTotalReplacements",
  byType: "privacyGuardReplacementsByType",
  events: "privacyGuardReplacementEvents",
  skipNextPrompt: "privacyGuardSkipNextPrompt",
  allowedPhrases: "privacyGuardAllowedPhrases",
  reviewBeforeSend: "privacyGuardReviewBeforeSend"
};

const LABELS = {
  private_key: "Private keys",
  jwt: "JWTs",
  openai_key: "OpenAI API keys",
  github_token: "GitHub tokens",
  slack_token: "Slack tokens",
  stripe_key: "Stripe keys",
  aws_access_key: "AWS access keys",
  bearer_token: "Bearer tokens",
  connection_url_password: "Connection URL passwords",
  redis_url_password: "Redis URL passwords",
  webhook_or_dsn: "Webhook and DSN values",
  env_secret: "Environment secrets",
  assigned_secret: "Assigned secrets",
  email: "Email addresses",
  phone: "Phone numbers",
  address: "Street addresses"
};

function formatCount(count) {
  return new Intl.NumberFormat().format(count || 0);
}

function formatTime(isoTime) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function describeCounts(counts) {
  return Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${LABELS[type] || type}: ${formatCount(count)}`)
    .join(" · ");
}

function renderTypes(byType) {
  const typeList = document.getElementById("typeList");
  const entries = Object.entries(byType || {}).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    typeList.innerHTML = '<div class="empty">No secrets replaced yet.</div>';
    return;
  }

  typeList.replaceChildren(...entries
    .sort((first, second) => second[1] - first[1])
    .map(([type, count]) => {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = LABELS[type] || type;

      const countNode = document.createElement("span");
      countNode.className = "count";
      countNode.textContent = formatCount(count);

      row.append(label, countNode);
      return row;
    }));
}

function renderEvents(events) {
  const eventList = document.getElementById("eventList");

  if (!events || events.length === 0) {
    eventList.innerHTML = '<div class="empty">Recent redactions will appear here.</div>';
    return;
  }

  eventList.replaceChildren(...events.slice(0, 8).map((event) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const main = document.createElement("div");
    main.className = "event-main";

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = formatTime(event.at);

    const detail = document.createElement("div");
    detail.className = "event-detail";
    detail.textContent = `${formatCount(event.total)} replaced`;

    main.append(time, detail);

    const count = document.createElement("div");
    count.className = "count";
    count.title = describeCounts(event.counts);
    count.textContent = formatCount(event.total);

    row.append(main, count);
    return row;
  }));
}

function normalizeAllowedInput(value) {
  return [...new Set(value
    .split("\n")
    .map((phrase) => phrase.trim())
    .filter(Boolean))];
}

function renderSkipStatus(isArmed) {
  const status = document.getElementById("skipStatus");
  const button = document.getElementById("skipNextButton");

  status.textContent = isArmed ? "Next prompt will be sent unchanged." : "Protection is active.";
  button.textContent = isArmed ? "Cancel skip" : "Skip next prompt";
  button.classList.toggle("is-armed", isArmed);
}

async function toggleSkipNextPrompt() {
  const current = await chrome.storage.local.get(STORAGE_KEYS.skipNextPrompt);
  const nextValue = !Boolean(current[STORAGE_KEYS.skipNextPrompt]);

  await chrome.storage.local.set({ [STORAGE_KEYS.skipNextPrompt]: nextValue });
  renderSkipStatus(nextValue);
}

async function saveAllowedPhrases() {
  const phrases = normalizeAllowedInput(document.getElementById("allowedPhrases").value);
  await chrome.storage.local.set({ [STORAGE_KEYS.allowedPhrases]: phrases });

  const button = document.getElementById("saveAllowedButton");
  button.textContent = "Saved";
  setTimeout(() => {
    button.textContent = "Save allowed text";
  }, 1200);
}

async function saveReviewBeforeSend(event) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.reviewBeforeSend]: event.target.checked
  });
}

async function loadStats() {
  const stats = await chrome.storage.local.get([
    STORAGE_KEYS.total,
    STORAGE_KEYS.byType,
    STORAGE_KEYS.events,
    STORAGE_KEYS.skipNextPrompt,
    STORAGE_KEYS.allowedPhrases,
    STORAGE_KEYS.reviewBeforeSend
  ]);

  document.getElementById("totalCount").textContent = formatCount(stats[STORAGE_KEYS.total]);
  document.getElementById("allowedPhrases").value = (stats[STORAGE_KEYS.allowedPhrases] || []).join("\n");
  document.getElementById("reviewBeforeSend").checked = Boolean(stats[STORAGE_KEYS.reviewBeforeSend]);
  renderSkipStatus(Boolean(stats[STORAGE_KEYS.skipNextPrompt]));
  renderTypes(stats[STORAGE_KEYS.byType]);
  renderEvents(stats[STORAGE_KEYS.events]);
}

document.getElementById("skipNextButton").addEventListener("click", toggleSkipNextPrompt);
document.getElementById("saveAllowedButton").addEventListener("click", saveAllowedPhrases);
document.getElementById("reviewBeforeSend").addEventListener("change", saveReviewBeforeSend);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEYS.skipNextPrompt]) {
    renderSkipStatus(Boolean(changes[STORAGE_KEYS.skipNextPrompt].newValue));
  }
});

loadStats();
