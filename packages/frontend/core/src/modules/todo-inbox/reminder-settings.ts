import { useSyncExternalStore } from 'react';

import { DEFAULT_DAY_START_HOUR } from './utils/reminders';

/**
 * Settings of the task reminders, kept in this browser's localStorage.
 * Reminders are off until the person turns them on (which also asks the
 * browser for permission to show notifications).
 */
export type ReminderSettings = {
  enabled: boolean;
  /** hour of the day when a task without a time counts as due */
  dayStartHour: number;
};

const STORAGE_KEY = 'affine-todo-reminders-v1';

export function createDefaultReminderSettings(): ReminderSettings {
  return { enabled: false, dayStartHour: DEFAULT_DAY_START_HOUR };
}

function load(): ReminderSettings {
  const fallback = createDefaultReminderSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    const hour = parsed.dayStartHour;
    return {
      enabled: parsed.enabled === true,
      dayStartHour:
        typeof hour === 'number' &&
        Number.isInteger(hour) &&
        hour >= 0 &&
        hour < 24
          ? hour
          : fallback.dayStartHour,
    };
  } catch {
    return fallback;
  }
}

let current: ReminderSettings | null = null;
const listeners = new Set<() => void>();

export function getReminderSettings(): ReminderSettings {
  return (current ??= load());
}

export function updateReminderSettings(patch: Partial<ReminderSettings>) {
  current = { ...getReminderSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage may be unavailable; keep the in-memory copy
  }
  listeners.forEach(listener => listener());
}

export function subscribeReminderSettings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReminderSettings(): ReminderSettings {
  return useSyncExternalStore(
    subscribeReminderSettings,
    getReminderSettings,
    getReminderSettings
  );
}
