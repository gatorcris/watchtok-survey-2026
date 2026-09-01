import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};

const {
  loadAuthSession,
  loadLocalState,
  saveAuthSession,
  saveLocalState,
  storageKeys
} = await import("../src/storage.js");

test("production and test modes use separate progress and authentication keys", () => {
  assert.notEqual(storageKeys(false).state, storageKeys(true).state);
  assert.notEqual(storageKeys(false).auth, storageKeys(true).auth);

  saveLocalState({ currentQuestionId: "Q2" }, false);
  saveLocalState({ currentQuestionId: "Q9" }, true);
  saveAuthSession({ access_token: "production" }, false);
  saveAuthSession({ access_token: "test" }, true);

  assert.equal(loadLocalState(false).currentQuestionId, "Q2");
  assert.equal(loadLocalState(true).currentQuestionId, "Q9");
  assert.equal(loadAuthSession(false).access_token, "production");
  assert.equal(loadAuthSession(true).access_token, "test");
});
