import type { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from '../types';
import { mergeAppSettingsWithDefaults } from '../lib/validation';

const STORAGE_KEY = 'teamtrack:app-settings';

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    return mergeAppSettingsWithDefaults(JSON.parse(raw));
  } catch (err) {
    console.warn('Failed to read app settings from localStorage, using defaults.', err);
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist app settings to localStorage.', err);
  }
}
