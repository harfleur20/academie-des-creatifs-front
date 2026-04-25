type NotificationStorageState = {
  readIds: string[];
  dismissedIds: string[];
};

const STORAGE_PREFIX = "academy_notifications";
const CHANGE_EVENT = "academy:notifications-state-change";

function defaultState(): NotificationStorageState {
  return { readIds: [], dismissedIds: [] };
}

function getStorageKey(scope: string) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function normalizeIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function readState(scope: string): NotificationStorageState {
  if (typeof window === "undefined") {
    return defaultState();
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(scope));
    if (!raw) {
      return defaultState();
    }
    const parsed = JSON.parse(raw) as Partial<NotificationStorageState>;
    return {
      readIds: Array.isArray(parsed.readIds) ? normalizeIds(parsed.readIds) : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? normalizeIds(parsed.dismissedIds)
        : [],
    };
  } catch {
    return defaultState();
  }
}

function emitChange(scope: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope } }));
}

function writeState(scope: string, state: NotificationStorageState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(scope),
    JSON.stringify({
      readIds: normalizeIds(state.readIds),
      dismissedIds: normalizeIds(state.dismissedIds),
    }),
  );
  emitChange(scope);
}

export function getNotificationStateScope(user: { id: number; role: string } | null | undefined) {
  if (!user) {
    return "guest";
  }
  return `${user.role}:${user.id}`;
}

export function getNotificationReadIds(scope: string): Set<string> {
  return new Set(readState(scope).readIds);
}

export function getNotificationDismissedIds(scope: string): Set<string> {
  return new Set(readState(scope).dismissedIds);
}

export function markNotificationsRead(scope: string, ids: Iterable<string>) {
  const state = readState(scope);
  writeState(scope, {
    ...state,
    readIds: normalizeIds([...state.readIds, ...ids]),
  });
}

export function dismissNotifications(scope: string, ids: Iterable<string>) {
  const state = readState(scope);
  const nextIds = normalizeIds(ids);
  writeState(scope, {
    readIds: normalizeIds([...state.readIds, ...nextIds]),
    dismissedIds: normalizeIds([...state.dismissedIds, ...nextIds]),
  });
}

export function subscribeToNotificationState(
  scope: string,
  callback: () => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ scope?: string }>).detail;
    if (!detail?.scope || detail.scope === scope) {
      callback();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === getStorageKey(scope)) {
      callback();
    }
  };

  window.addEventListener(CHANGE_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
}
