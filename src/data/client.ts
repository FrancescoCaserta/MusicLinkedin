import type { DataApi } from './api';
import { MockApi, type Store } from './mock/mockApi';

/**
 * The one place that decides which backend the app talks to.
 * Replace `createMock()` with an HTTP implementation of DataApi and the UI
 * does not change.
 */

const DB_KEY = 'leggio:db';
export const FAIL_KEY = 'leggio:simulate-failure';

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const browserStore: Store = {
  read: () => read(DB_KEY),
  write: (json) => window.localStorage.setItem(DB_KEY, json),
};

function createMock(): DataApi {
  const mock = new MockApi({
    store: browserStore,
    latency: [90, 260],
    failing: () => read(FAIL_KEY) === '1',
  });
  // Another tab changed the data (e.g. a second persona in a second window).
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY || e.key === null) mock.reload();
  });
  return mock;
}

export const api: DataApi = createMock();

export function isSimulatingFailure(): boolean {
  return read(FAIL_KEY) === '1';
}

export function setSimulatingFailure(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FAIL_KEY, '1');
    else window.localStorage.removeItem(FAIL_KEY);
  } catch {
    // ignore
  }
}
