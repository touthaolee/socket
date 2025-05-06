// Simple state manager to replace window.appState
const state = {};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
}

export function getAllState() {
  return { ...state };
}
