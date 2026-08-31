import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReferral, progressPercent, prototypeSections } from "../src/survey.js";

test("referral codes are normalized", () => {
  assert.equal(normalizeReferral(" Andy "), "andy");
  assert.equal(normalizeReferral("Peter.Watch!"), "peterwatch");
});

test("allow-listed referrals reject unknown codes", () => {
  assert.equal(normalizeReferral("andy", ["andy", "jon"]), "andy");
  assert.equal(normalizeReferral("someone-else", ["andy", "jon"]), "unrecognized");
  assert.equal(normalizeReferral(null, ["andy"]), "direct");
});

test("progress is bounded and completes at 100 percent", () => {
  assert.equal(progressPercent("welcome"), 0);
  assert.equal(progressPercent(0), 20);
  assert.equal(progressPercent("complete"), 100);
  assert.equal(progressPercent(99), 100);
});

test("prototype question identifiers are unique", () => {
  const ids = prototypeSections.flatMap((section) => section.questions.map((question) => question.id));
  assert.equal(new Set(ids).size, ids.length);
});

