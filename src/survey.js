import { surveyQuestions } from "./survey-data.js";

export const SURVEY_VERSION = "V8";
export const SKIPPED = "SKIPPED";
export const COMPLETED_STATUS = "completed";

export const sections = [
  { number: 1, title: "Collecting and purchasing", transition: "You’ve completed the collecting and purchasing questions. Next, let’s focus on the particular next watch you currently expect." },
  { number: 2, title: "Your next watch purchase", transition: "You’ve completed the collecting and next-purchase questions. Now let’s look at how watches move from first discovery to a buying decision." },
  { number: 3, title: "TikTok and the path to purchase", transition: "You’re past the halfway point—and still running accurately. Next, we’re looking at your openness to smaller brands and unfamiliar watches." },
  { number: 4, title: "Small brands and collector mindset", transition: "Final stretch. These questions help us understand the people behind WatchTok—not just who posts, but who watches, comments, advises, connects, and participates." },
  { number: 5, title: "Your WatchTok role and community", transition: "" }
];

export function getQuestion(id) {
  return surveyQuestions.find((question) => question.id === id);
}

export function normalizeReferral(rawValue, allowList = []) {
  if (!rawValue) return "direct";
  const normalized = rawValue.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  if (!normalized) return "direct";
  if (allowList.length && !allowList.includes(normalized)) return "unrecognized";
  return normalized;
}

export function isQuestionVisible(question, answers = {}) {
  if (question.id === "Q2" && answers.Q1 === "1") return false;
  if (["Q38", "Q39", "Q40", "Q41", "Q42", "Q43"].includes(question.id) && answers.Q37 === "7") return false;
  if (["Q22", "Q23", "Q24", "Q25"].includes(question.id) && answers.Q12 === "1") return false;
  if (["Q14", "Q15", "Q16"].includes(question.id)) {
    const recentActivity = Array.isArray(answers.Q13) ? answers.Q13 : [];
    if (answers.Q12 === "1" || !recentActivity.includes("6")) return false;
  }
  if (["Q27", "Q28"].includes(question.id) && answers.Q26 === "14") return false;
  return true;
}

export function visibleQuestions(answers = {}) {
  return surveyQuestions.filter((question) => isQuestionVisible(question, answers));
}

export function serializedAnswers(answers = {}) {
  const result = {};
  for (const question of surveyQuestions) {
    result[question.id] = isQuestionVisible(question, answers)
      ? (answers[question.id] ?? null)
      : SKIPPED;
  }
  if (answers.Q1 === "1") result.Q2_DERIVED_SPEND = "$0";
  return result;
}

export function progressPercent(currentQuestionId, answers = {}, complete = false) {
  if (complete) return 100;
  const routed = visibleQuestions(answers);
  const index = Math.max(0, routed.findIndex((question) => question.id === currentQuestionId));
  return Math.round((index / routed.length) * 100);
}

export function isExclusiveOption(question, code) {
  const label = question.options.find((option) => option.code === code)?.label.toLowerCase() || "";
  return /^(none|none of|i am not sure|prefer not|tiktok played no|creator qualities do not|i did little or no)/i.test(label);
}

export function updateMultiAnswer(question, currentValue, changedCode, checked) {
  let values = Array.isArray(currentValue) ? [...currentValue] : [];
  if (!checked) return values.filter((code) => code !== changedCode);
  if (isExclusiveOption(question, changedCode)) return [changedCode];
  values = values.filter((code) => !isExclusiveOption(question, code));
  if (!values.includes(changedCode)) values.push(changedCode);
  if (question.maxSelections && values.length > question.maxSelections) {
    return { error: `Please choose no more than ${question.maxSelections} options.`, values: currentValue || [] };
  }
  return values.sort((a, b) => Number(a) - Number(b));
}

export function nextQuestionId(currentQuestionId, answers = {}) {
  const routed = visibleQuestions(answers);
  const index = routed.findIndex((question) => question.id === currentQuestionId);
  return routed[index + 1]?.id || null;
}

export function previousQuestionId(currentQuestionId, answers = {}) {
  const routed = visibleQuestions(answers);
  const index = routed.findIndex((question) => question.id === currentQuestionId);
  return routed[index - 1]?.id || null;
}

export { surveyQuestions };
