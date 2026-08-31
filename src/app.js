import { normalizeReferral, progressPercent, prototypeSections } from "./survey.js";
import { clearPrototypeState, loadPrototypeState, savePrototypeState } from "./storage.js";

const app = document.querySelector("#app");
const rawReferral = new URLSearchParams(window.location.search).get("ref");
const referral = normalizeReferral(rawReferral);
let restored = loadPrototypeState();

let state = {
  screen: restored?.screen ?? "welcome",
  answers: restored?.answers ?? {},
  referral: restored?.referral ?? referral,
  error: ""
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function progressMarkup() {
  if (state.screen === "welcome") return "";
  const percent = progressPercent(state.screen);
  const label = state.screen === "complete" ? "Complete" : `Section ${Number(state.screen) + 1} of ${prototypeSections.length}`;
  return `
    <div class="progress-shell" aria-label="Survey progress">
      <div class="progress-meta"><span>${label}</span><span>${percent}%</span></div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>
    </div>`;
}

function renderWelcome() {
  const returnNote = restored && restored.screen !== "welcome" && restored.screen !== "complete"
    ? `<div class="notice"><strong>Welcome back.</strong> Your prototype progress is still on this device. Continue to return to section ${Number(restored.screen) + 1}.</div>`
    : "";

  app.innerHTML = `
    <article class="survey-card">
      <section class="panel">
        <p class="eyebrow">Creator-led research · Pre-production</p>
        <h1>The community behind the views.</h1>
        <p class="lede">This is a working experience prototype for The 2026 WatchTok Enthusiast Survey. The final study will help show watch brands who WatchTok reaches, how collectors buy, and where creators provide real value.</p>
        ${returnNote}
        <div class="notice"><strong>Nothing is being submitted.</strong> This prototype uses representative—not canonical—questions. Any selections stay only in this browser.</div>
        <div class="facts" aria-label="Survey expectations">
          <div class="fact"><strong>10–15 min</strong><span>Expected final completion time; allow up to 20 for thoughtful answers.</span></div>
          <div class="fact"><strong>700</strong><span>Shared completed-response goal for the Founding Creator Partner coalition.</span></div>
          <div class="fact"><strong>Independent</strong><span>No brand sponsors, commissions, reviews or approves the research.</span></div>
        </div>
        <div class="actions">
          <span class="referral">Prototype referral: <strong>${escapeHtml(state.referral)}</strong></span>
          <button class="button button-primary" type="button" data-action="start">${returnNote ? "Continue prototype" : "Explore the prototype"}</button>
        </div>
      </section>
    </article>`;
}

function renderSection(index) {
  const section = prototypeSections[index];
  const questions = section.questions.map((question) => {
    const options = question.options.map((option, optionIndex) => {
      const value = String(optionIndex + 1);
      const checked = state.answers[question.id] === value ? "checked" : "";
      return `<label class="option"><input type="radio" name="${question.id}" value="${value}" ${checked} /><span>${escapeHtml(option)}</span></label>`;
    }).join("");
    return `<fieldset class="question"><legend>${escapeHtml(question.label)} <span class="required" aria-label="required">*</span></legend>${question.hint ? `<p class="question-hint">${escapeHtml(question.hint)}</p>` : ""}<div class="options">${options}</div></fieldset>`;
  }).join("");

  app.innerHTML = `
    <article class="survey-card">
      ${progressMarkup()}
      <form class="panel" data-section-form novalidate>
        <p class="eyebrow">${section.eyebrow}</p>
        <h2>${section.title}</h2>
        <p class="lede">${section.intro}</p>
        ${questions}
        ${section.milestone ? `<div class="milestone"><strong>Keep it ticking.</strong>${section.milestone}</div>` : ""}
        <p class="error" role="alert">${state.error}</p>
        <div class="actions">
          <button class="button button-secondary" type="button" data-action="back">Back</button>
          <span class="saved" aria-live="polite">Saved on this device</span>
          <button class="button button-primary" type="submit">${index === prototypeSections.length - 1 ? "Complete prototype" : "Continue"}</button>
        </div>
      </form>
    </article>`;
}

function renderComplete() {
  app.innerHTML = `
    <article class="survey-card">
      ${progressMarkup()}
      <section class="panel">
        <div class="complete-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">Prototype complete</p>
        <h1>You finished the whole thing.</h1>
        <p class="lede">Seriously—thank you. In production, a complete response will be far more valuable than a click, view or partial answer. It will help WatchTok build evidence the watch industry currently doesn’t have.</p>
        <div class="notice"><strong>No response was transmitted.</strong> This preview stored selections only on this device. The production completion screen will separately offer optional follow-up consent.</div>
        <div class="actions">
          <button class="button button-secondary" type="button" data-action="restart">Reset prototype</button>
        </div>
      </section>
    </article>`;
}

function render() {
  state.error = "";
  if (state.screen === "welcome") renderWelcome();
  else if (state.screen === "complete") renderComplete();
  else renderSection(Number(state.screen));
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function persist() {
  savePrototypeState({ screen: state.screen, answers: state.answers, referral: state.referral });
}

app.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='radio']");
  if (!input) return;
  state.answers[input.name] = input.value;
  persist();
});

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "start") {
    state.screen = restored && restored.screen !== "welcome" && restored.screen !== "complete" ? restored.screen : 0;
  } else if (action === "back") {
    state.screen = Number(state.screen) === 0 ? "welcome" : Number(state.screen) - 1;
  } else if (action === "restart") {
    clearPrototypeState();
    restored = null;
    state = { screen: "welcome", answers: {}, referral, error: "" };
  }
  persist();
  render();
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const index = Number(state.screen);
  const missing = prototypeSections[index].questions.find((question) => !state.answers[question.id]);
  if (missing) {
    state.error = "Please answer each prototype question before continuing.";
    const field = event.target.querySelector(`[name="${missing.id}"]`);
    field?.focus();
    event.target.querySelector(".error").textContent = state.error;
    return;
  }
  state.screen = index === prototypeSections.length - 1 ? "complete" : index + 1;
  restored = { screen: state.screen };
  persist();
  render();
});

render();
