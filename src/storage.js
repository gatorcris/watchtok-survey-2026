const STATE_KEY = "watchtok-survey-v8-state";
const AUTH_KEY = "watchtok-survey-v8-auth";

function safeParse(rawValue) {
  try {
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

export function loadLocalState() {
  return safeParse(localStorage.getItem(STATE_KEY));
}

export function saveLocalState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function clearLocalState() {
  localStorage.removeItem(STATE_KEY);
}

export function loadAuthSession() {
  return safeParse(localStorage.getItem(AUTH_KEY));
}

export function saveAuthSession(session) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_KEY);
}
