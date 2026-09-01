import { ALLOWED_REFERRAL_CODES, SUPPORT_EMAIL } from "./config.js";
import {
  COMPLETED_STATUS,
  SURVEY_VERSION,
  getQuestion,
  nextQuestionId,
  normalizeReferral,
  previousQuestionId,
  progressPercent,
  questionHint,
  questionInstruction,
  sections,
  serializedAnswers,
  surveyQuestions,
  updateMultiAnswer,
  visibleQuestions
} from "./survey.js";
import { loadLocalState, saveLocalState } from "./storage.js";
import { ensureAnonymousSession, loadRemoteResponse, saveRemoteResponse, submitContactOptIn } from "./supabase.js";

const app = document.querySelector("#app");
const query = new URLSearchParams(window.location.search);
const isTest = ["1", "true", "yes"].includes((query.get("test") || "").toLowerCase());
const referralFromUrl = normalizeReferral(query.get("ref"), ALLOWED_REFERRAL_CODES);
const local = loadLocalState(isTest);
const wordmark = document.querySelector(".wordmark");
if (isTest && wordmark) wordmark.href = "?test=1";

let authSession = null;
let saveTimer = null;
let state = {
  view: local?.view || "welcome",
  currentQuestionId: local?.currentQuestionId || "Q1",
  pendingQuestionId: local?.pendingQuestionId || null,
  answers: local?.answers || {},
  referral: local?.referral || referralFromUrl,
  startedAt: local?.startedAt || null,
  updatedAt: local?.updatedAt || null,
  status: local?.status || "partial",
  sync: "connecting",
  error: "",
  contactStatus: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistLocal() {
  state.updatedAt = new Date().toISOString();
  saveLocalState({
    view: state.view,
    currentQuestionId: state.currentQuestionId,
    pendingQuestionId: state.pendingQuestionId,
    answers: state.answers,
    referral: state.referral,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    status: state.status
  }, isTest);
}

function responsePayload(status = state.status) {
  const question = getQuestion(state.currentQuestionId);
  return {
    owner_id: authSession.user.id,
    survey_version: SURVEY_VERSION,
    is_test: isTest,
    status,
    answers: serializedAnswers(state.answers),
    referral_code: state.referral,
    last_question_id: state.currentQuestionId,
    last_display_question: question?.display || 1,
    started_at: state.startedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: status === COMPLETED_STATUS ? new Date().toISOString() : null
  };
}

async function syncNow(status = state.status) {
  if (!authSession) return false;
  state.sync = "saving";
  renderSyncStatus();
  try {
    await saveRemoteResponse(authSession, responsePayload(status));
    state.sync = "saved";
    renderSyncStatus();
    return true;
  } catch (error) {
    state.sync = "offline";
    state.error = status === COMPLETED_STATUS
      ? "We could not submit your response yet. Your answers are safe on this device; please check your connection and try again."
      : "";
    renderSyncStatus();
    return false;
  }
}

function scheduleSync() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => syncNow(), 500);
}

function renderSyncStatus() {
  const element = app.querySelector("[data-sync-status]");
  if (!element) return;
  const labels = {
    connecting: "Connecting…",
    saving: "Saving…",
    saved: "Saved",
    offline: "Saved on this device"
  };
  element.textContent = labels[state.sync] || "";
  element.dataset.state = state.sync;
}

function progressMarkup() {
  const complete = state.view === "complete";
  const percent = progressPercent(state.currentQuestionId, state.answers, complete);
  const question = getQuestion(state.currentQuestionId);
  const label = complete ? "Complete" : `Question ${question?.display || 1} of 43`;
  return `
    <div class="progress-shell" aria-label="Survey progress">
      <div class="progress-meta"><span>${label}</span><span>${percent}%</span></div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>
    </div>`;
}

function testBanner() {
  return isTest ? '<div class="test-banner" role="status">TEST MODE · This response is stored separately from production responses.</div>' : "";
}

function renderWelcome() {
  const returning = state.startedAt && state.status !== COMPLETED_STATUS;
  app.innerHTML = `
    ${testBanner()}
    <article class="survey-card">
      <section class="panel welcome-panel">
        <p class="eyebrow">Independent, creator-led research · 2026</p>
        <h1>The 2026 WatchTok Enthusiast Survey</h1>
        <p class="lede">This is a real enthusiast survey—not a three-question engagement poll.</p>
        <p>Most participants should finish in about <strong>10–15 minutes</strong>. Please allow up to <strong>20 minutes</strong> if you enjoy thinking about your answers.</p>
        <p>Your complete response will help us understand how WatchTok enthusiasts and collectors discover, evaluate, purchase, and enjoy watches.</p>
        <div class="notice"><strong>Independent research.</strong> No watch brand has sponsored, commissioned, reviewed, or approved this survey. Watch-industry employees may participate as individual enthusiasts.</div>
        <div class="facts" aria-label="Survey expectations">
          <div class="fact"><strong>No name required</strong><span>The research questionnaire does not ask for your name, TikTok handle, or email address.</span></div>
          <div class="fact"><strong>Aggregate analysis</strong><span>Responses are analyzed together, not published as individual records.</span></div>
          <div class="fact"><strong>Optional follow-up</strong><span>After completion, you may separately provide an email to be involved in future surveys.</span></div>
        </div>
        <p class="privacy-copy">By starting, you consent to the use of your answers for this independent WatchTok research. You may stop and return on this device. To request deletion, contact ${escapeHtml(SUPPORT_EMAIL)}.</p>
        <div class="actions">
          <span class="saved" data-sync-status aria-live="polite"></span>
          <button class="button button-primary" type="button" data-action="start">${returning ? "Continue survey" : "Start survey"}</button>
        </div>
      </section>
    </article>`;
  renderSyncStatus();
}

function renderQuestion() {
  const question = getQuestion(state.currentQuestionId);
  if (!question) {
    state.currentQuestionId = visibleQuestions(state.answers)[0].id;
    return renderQuestion();
  }
  const isMulti = question.type === "multi";
  const hint = questionHint(question);
  const instruction = questionInstruction(question);
  const selected = Array.isArray(state.answers[question.id]) ? state.answers[question.id] : [];
  const options = question.options.map((option) => {
    const checked = isMulti ? selected.includes(option.code) : state.answers[question.id] === option.code;
    return `<label class="option">
      <input type="${isMulti ? "checkbox" : "radio"}" name="${question.id}" value="${option.code}" ${checked ? "checked" : ""}>
      <span>${escapeHtml(option.label)}</span>
    </label>`;
  }).join("");
  const routed = visibleQuestions(state.answers);
  const routedPosition = routed.findIndex((item) => item.id === question.id) + 1;
  const section = sections.find((item) => item.number === question.section);

  app.innerHTML = `
    ${testBanner()}
    <article class="survey-card">
      ${progressMarkup()}
      <form class="panel question-panel" data-question-form novalidate>
        <p class="eyebrow">Section ${question.section} of 5 · ${escapeHtml(section.title)}</p>
        <p class="question-count">Routed question ${routedPosition} of ${routed.length}</p>
        <fieldset class="question">
          <legend><span class="display-number">${question.display}.</span> ${escapeHtml(question.label)} <span class="required" aria-label="required">*</span></legend>
          ${question.statement ? `<blockquote>${escapeHtml(question.statement)}</blockquote>` : ""}
          ${hint ? `<p class="question-hint">${escapeHtml(hint)}</p>` : ""}
          <p class="instruction">${escapeHtml(instruction)}</p>
          <div class="options">${options}</div>
        </fieldset>
        <p class="error" role="alert">${escapeHtml(state.error)}</p>
        <div class="actions">
          <button class="button button-secondary" type="button" data-action="back">Back</button>
          <span class="saved" data-sync-status aria-live="polite"></span>
          <button class="button button-primary" type="submit">${nextQuestionId(question.id, state.answers) ? "Continue" : "Submit response"}</button>
        </div>
      </form>
    </article>`;
  renderSyncStatus();
}

function renderTransition() {
  const nextQuestion = getQuestion(state.pendingQuestionId);
  const priorSection = sections.find((item) => item.number === nextQuestion.section - 1);
  app.innerHTML = `
    ${testBanner()}
    <article class="survey-card">
      ${progressMarkup()}
      <section class="panel transition-panel">
        <div class="complete-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">Section complete</p>
        <h2>Keep it ticking.</h2>
        <p class="lede">${escapeHtml(priorSection?.transition || "You’re making excellent progress.")}</p>
        <div class="actions actions-end">
          <span class="saved" data-sync-status aria-live="polite"></span>
          <button class="button button-primary" type="button" data-action="continue-section">Continue</button>
        </div>
      </section>
    </article>`;
  renderSyncStatus();
}

function renderComplete() {
  const contactMarkup = isTest
    ? `<div class="test-contact-notice" role="status">
        <strong>Test Mode:</strong> Optional email collection is disabled. No contact information can be saved from this test response.
      </div>`
    : `<form class="contact-form" data-contact-form novalidate>
        <h2>Optional follow-up</h2>
        <p>If you would like to be invited to future WatchTok surveys, you may provide an email address. Your email will not be shared with brands or participating creators.</p>
        <label class="email-label">Email address
          <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com">
        </label>
        <label class="consent-option"><input type="checkbox" name="future_research" value="true"> <span>Invite me to future WatchTok surveys.</span></label>
        <p class="error" role="alert">${escapeHtml(state.error)}</p>
        <p class="contact-status" role="status">${escapeHtml(state.contactStatus)}</p>
        <div class="actions">
          <span></span>
          <button class="button button-primary" type="submit">Save my preference</button>
        </div>
      </form>`;
  app.innerHTML = `
    ${testBanner()}
    <article class="survey-card">
      ${progressMarkup()}
      <section class="panel">
        <div class="complete-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">Survey complete</p>
        <h1>You finished the whole thing. Seriously—thank you.</h1>
        <p class="lede">A complete response is far more valuable than a click, view, or partial answer. You have helped build a clearer picture of how WatchTok enthusiasts discover, evaluate, purchase, and enjoy watches.</p>
        <div class="notice"><strong>Your research response is complete.</strong> Any optional contact information is stored separately from your survey answers.</div>
        ${contactMarkup}
      </section>
    </article>`;
}

function render() {
  if (state.view === "welcome") renderWelcome();
  else if (state.view === "question") renderQuestion();
  else if (state.view === "transition") renderTransition();
  else renderComplete();
  app.setAttribute("tabindex", "-1");
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function advanceFromQuestion() {
  const nextId = nextQuestionId(state.currentQuestionId, state.answers);
  if (!nextId) return null;
  const current = getQuestion(state.currentQuestionId);
  const next = getQuestion(nextId);
  if (next.section !== current.section) {
    state.pendingQuestionId = nextId;
    state.view = "transition";
  } else {
    state.currentQuestionId = nextId;
    state.view = "question";
  }
  return nextId;
}

app.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='radio'], input[type='checkbox']");
  if (!input || !getQuestion(input.name)) return;
  const question = getQuestion(input.name);
  state.error = "";
  if (question.type === "multi") {
    const result = updateMultiAnswer(question, state.answers[question.id], input.value, input.checked);
    if (result?.error) {
      state.error = result.error;
      input.checked = false;
      renderQuestion();
      app.querySelector(`[name="${question.id}"][value="${input.value}"]`)?.focus();
      return;
    }
    state.answers[question.id] = result;
  } else {
    state.answers[question.id] = input.value;
  }
  persistLocal();
  scheduleSync();
  renderSyncStatus();
});

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "start") {
    state.startedAt ||= new Date().toISOString();
    state.view = "question";
    if (!getQuestion(state.currentQuestionId) || !visibleQuestions(state.answers).some((q) => q.id === state.currentQuestionId)) {
      state.currentQuestionId = visibleQuestions(state.answers)[0].id;
    }
  }
  if (action === "back") {
    const previousId = previousQuestionId(state.currentQuestionId, state.answers);
    if (previousId) state.currentQuestionId = previousId;
    else state.view = "welcome";
  }
  if (action === "continue-section") {
    state.currentQuestionId = state.pendingQuestionId;
    state.pendingQuestionId = null;
    state.view = "question";
  }
  persistLocal();
  scheduleSync();
  render();
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.target.matches("[data-contact-form]")) {
    if (isTest) {
      state.error = "Test Mode does not save contact information.";
      return renderComplete();
    }
    const form = new FormData(event.target);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const futureResearch = form.get("future_research") === "true";
    state.error = "";
    if (!/^\S+@\S+\.\S+$/.test(email)) state.error = "Please enter a valid email address.";
    else if (!futureResearch) state.error = "Please confirm that you would like to be invited to future surveys.";
    if (state.error) return renderComplete();
    try {
      await submitContactOptIn(authSession, {
        email,
        receive_report: false,
        future_research: true,
        consented_at: new Date().toISOString()
      });
      state.contactStatus = "Your preferences have been saved. Thank you.";
      state.error = "";
    } catch (error) {
      state.error = error.status === 409
        ? "That email is already registered for follow-up."
        : "We could not save your email preferences. Please try again.";
    }
    return renderComplete();
  }

  if (!event.target.matches("[data-question-form]")) return;
  const question = getQuestion(state.currentQuestionId);
  const answer = state.answers[question.id];
  if (!answer || (Array.isArray(answer) && !answer.length)) {
    state.error = "Please answer this question before continuing.";
    renderQuestion();
    app.querySelector(`[name="${question.id}"]`)?.focus();
    return;
  }
  state.error = "";
  const nextId = nextQuestionId(question.id, state.answers);
  if (!nextId) {
    const submitted = await syncNow(COMPLETED_STATUS);
    if (!submitted) return renderQuestion();
    state.status = COMPLETED_STATUS;
    state.view = "complete";
    persistLocal();
    return render();
  }
  advanceFromQuestion();
  persistLocal();
  scheduleSync();
  render();
});

async function initialize() {
  render();
  try {
    authSession = await ensureAnonymousSession(isTest);
    const remote = await loadRemoteResponse(authSession, SURVEY_VERSION, isTest);
    if (remote) {
      const remoteIsNewer = !state.updatedAt || new Date(remote.updated_at) >= new Date(state.updatedAt);
      if (remoteIsNewer || remote.status === COMPLETED_STATUS) {
        state.answers = Object.fromEntries(Object.entries(remote.answers || {}).filter(([, value]) => value !== "SKIPPED" && value !== null));
        state.startedAt = remote.started_at;
        state.updatedAt = remote.updated_at;
        state.currentQuestionId = remote.last_question_id || state.currentQuestionId;
        state.referral = remote.referral_code || state.referral;
        state.status = remote.status;
        state.view = remote.status === COMPLETED_STATUS ? "complete" : state.view;
      }
    }
    state.sync = "saved";
    persistLocal();
  } catch {
    state.sync = "offline";
  }
  render();
}

initialize();
