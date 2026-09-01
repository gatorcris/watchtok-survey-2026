import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPLETED_STATUS,
  SKIPPED,
  nextQuestionId,
  normalizeReferral,
  progressPercent,
  serializedAnswers,
  surveyQuestions,
  updateMultiAnswer,
  visibleQuestions
} from "../src/survey.js";

test("the database completion status uses the V8 schema value", () => {
  assert.equal(COMPLETED_STATUS, "completed");
});

test("the frozen V7 instrument contains 43 questions in display order", () => {
  assert.equal(surveyQuestions.length, 43);
  assert.deepEqual(surveyQuestions.map((question) => question.display), Array.from({ length: 43 }, (_, index) => index + 1));
  assert.equal(surveyQuestions[0].id, "Q1");
  assert.equal(surveyQuestions.at(-1).id, "Q20");
});

test("referrals are normalized and optionally allow-listed", () => {
  assert.equal(normalizeReferral(null), "direct");
  assert.equal(normalizeReferral(" Andy.Watches "), "andywatches");
  assert.equal(normalizeReferral("Andy", ["andy"]), "andy");
  assert.equal(normalizeReferral("unknown", ["andy"]), "unrecognized");
});

test("zero purchases skips annual spend and derives zero", () => {
  const answers = { Q1: "1" };
  assert.equal(visibleQuestions(answers).some((question) => question.id === "Q2"), false);
  assert.equal(nextQuestionId("Q1", answers), "Q3");
  assert.equal(serializedAnswers(answers).Q2, SKIPPED);
  assert.equal(serializedAnswers(answers).Q2_DERIVED_SPEND, "$0");
});

test("no expected next purchase skips the complete next-purchase detail block", () => {
  const routed = visibleQuestions({ Q37: "7" }).map((question) => question.id);
  for (const id of ["Q38", "Q39", "Q40", "Q41", "Q42", "Q43"]) assert.equal(routed.includes(id), false);
  assert.equal(nextQuestionId("Q37", { Q37: "7" }), "Q12");
});

test("never consuming TikTok skips dependent pathway and creator-output questions", () => {
  const routed = visibleQuestions({ Q12: "1", Q13: ["6"] }).map((question) => question.id);
  for (const id of ["Q22", "Q23", "Q24", "Q25", "Q14", "Q15", "Q16"]) assert.equal(routed.includes(id), false);
});

test("creator-output questions appear only after recent original posting", () => {
  assert.equal(visibleQuestions({ Q13: ["1", "2"] }).some((question) => question.id === "Q14"), false);
  assert.equal(visibleQuestions({ Q13: ["1", "6"] }).some((question) => question.id === "Q14"), true);
});

test("no recent purchase consideration skips evaluation follow-ups", () => {
  const routed = visibleQuestions({ Q26: "14" }).map((question) => question.id);
  assert.equal(routed.includes("Q27"), false);
  assert.equal(routed.includes("Q28"), false);
});

test("exclusive multi-select options clear substantive choices", () => {
  const question = surveyQuestions.find((item) => item.id === "Q22");
  assert.deepEqual(updateMultiAnswer(question, ["1", "3"], "9", true), ["9"]);
  assert.deepEqual(updateMultiAnswer(question, ["9"], "2", true), ["2"]);
});

test("three-choice maximum is enforced without changing the saved answer", () => {
  const question = surveyQuestions.find((item) => item.id === "Q23");
  const result = updateMultiAnswer(question, ["1", "2", "3"], "4", true);
  assert.match(result.error, /no more than 3/);
  assert.deepEqual(result.values, ["1", "2", "3"]);
});

test("progress reflects the routed path and completes at 100 percent", () => {
  const answers = { Q1: "1", Q37: "7", Q12: "1", Q26: "14", Q13: ["1"] };
  const routed = visibleQuestions(answers);
  const middle = routed[Math.floor(routed.length / 2)].id;
  assert.ok(progressPercent(middle, answers) >= 45);
  assert.ok(progressPercent(middle, answers) <= 55);
  assert.equal(progressPercent(routed.at(-1).id, answers, true), 100);
});
