const STORAGE_KEY = "watchtok-survey-prototype-v1";

export function loadPrototypeState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

export function savePrototypeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
}

export function clearPrototypeState() {
  localStorage.removeItem(STORAGE_KEY);
}

