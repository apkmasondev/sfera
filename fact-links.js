const FACT_PARAMETER = 'fact';
const FACT_ID_PATTERN = /^[a-z0-9_-]+$/;
const HISTORY_FACT_ID = 'sphereFactId';
const HISTORY_CAN_GO_BACK = 'sphereFactCanGoBack';

export function getFactIdForImage(imagePath) {
  const filename = decodeURIComponent(imagePath).split('/').pop() || '';
  return normalizeFactId(filename);
}

export function normalizeFactId(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\.webp$/i, '');
  return FACT_ID_PATTERN.test(normalized) ? normalized : '';
}

export function readFactIdFromUrl() {
  return normalizeFactId(new URL(window.location.href).searchParams.get(FACT_PARAMETER));
}

export function hasFactParameterInUrl() {
  return new URL(window.location.href).searchParams.has(FACT_PARAMETER);
}

export function writeFactToUrl(factId, { replace = false, canGoBack = true } = {}) {
  const normalized = normalizeFactId(factId);
  if (!normalized) return false;

  const url = new URL(window.location.href);
  url.searchParams.set(FACT_PARAMETER, normalized);
  const state = {
    ...getHistoryState(),
    [HISTORY_FACT_ID]: normalized,
    [HISTORY_CAN_GO_BACK]: canGoBack
  };
  window.history[replace ? 'replaceState' : 'pushState'](state, '', getRelativeUrl(url));
  return true;
}

export function clearFactFromUrl({ replace = true } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.delete(FACT_PARAMETER);
  const state = { ...getHistoryState() };
  delete state[HISTORY_FACT_ID];
  delete state[HISTORY_CAN_GO_BACK];
  window.history[replace ? 'replaceState' : 'pushState'](state, '', getRelativeUrl(url));
}

export function canCloseFactWithHistoryBack(factId) {
  const normalized = normalizeFactId(factId);
  const state = getHistoryState();
  return Boolean(normalized && state[HISTORY_FACT_ID] === normalized && state[HISTORY_CAN_GO_BACK]);
}

function getHistoryState() {
  return window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
}

function getRelativeUrl(url) {
  return `${url.pathname}${url.search}${url.hash}`;
}
