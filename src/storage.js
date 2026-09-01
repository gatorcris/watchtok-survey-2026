const STATE_KEY = "watchtok-survey-v8-state";
const AUTH_KEY = "watchtok-survey-v8-auth";

export function storageKeys(isTest = false) {
  const scope = isTest ? "test" : "production";
  return {
    state: `${STATE_KEY}-${scope}`,
    auth: `${AUTH_KEY}-${scope}`
  };
}

function safeParse(rawValue) {
  try {
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

export function loadLocalState(isTest = false) {
  return safeParse(localStorage.getItem(storageKeys(isTest).state));
}

export function saveLocalState(state, isTest = false) {
  localStorage.setItem(storageKeys(isTest).state, JSON.stringify(state));
}

export function clearLocalState(isTest = false) {
  localStorage.removeItem(storageKeys(isTest).state);
}

export function loadAuthSession(isTest = false) {
  return safeParse(localStorage.getItem(storageKeys(isTest).auth));
}

export function saveAuthSession(session, isTest = false) {
  localStorage.setItem(storageKeys(isTest).auth, JSON.stringify(session));
}

export function clearAuthSession(isTest = false) {
  localStorage.removeItem(storageKeys(isTest).auth);
}
