import { create } from 'zustand';
import type { AppSettings } from '../types';
import { loadAppSettings, saveAppSettings } from './localSettings';

interface AppSettingsState {
  settings: AppSettings;
  setTheme: (theme: AppSettings['theme']) => void;
  toggleTheme: () => void;
  setAlertSoundEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setFieldLocked: (locked: boolean) => void;
}

function persist(next: AppSettings): AppSettings {
  saveAppSettings(next);
  return next;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: loadAppSettings(),
  setTheme: (theme) => set({ settings: persist({ ...get().settings, theme }) }),
  toggleTheme: () =>
    set({ settings: persist({ ...get().settings, theme: get().settings.theme === 'dark' ? 'light' : 'dark' }) }),
  setAlertSoundEnabled: (enabled) => set({ settings: persist({ ...get().settings, alertSoundEnabled: enabled }) }),
  setReducedMotion: (enabled) => set({ settings: persist({ ...get().settings, reducedMotion: enabled }) }),
  setFieldLocked: (locked) => set({ settings: persist({ ...get().settings, fieldLocked: locked }) }),
}));
