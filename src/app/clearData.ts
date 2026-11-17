// Removes everything this app stores in the browser (models, baseline, learning progress, preferences).
const PREFIX = 'markov-simulator:';

let clearing = false;
/** True once a full clear has started, so pending autosaves do not write data back before the reload. */
export const isClearingData = () => clearing;

/** Keys this app has stored in this browser (for showing what will be removed). */
export function storedKeys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k && k.startsWith(PREFIX));
  } catch {
    return [];
  }
}

/** Delete all app data, then reload so every in-memory state starts fresh. */
export function clearAllAppData(): void {
  clearing = true;
  for (const store of [localStorage, sessionStorage]) {
    try {
      const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => !!k && k.startsWith(PREFIX));
      keys.forEach((k) => store.removeItem(k));
    } catch { /* storage unavailable */ }
  }
  location.reload();
}
