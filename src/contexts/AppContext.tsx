import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { JournalEntry, AppSettings } from '../types';
import * as storageService from '../services/storageService';

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  googleAccessToken: '',
  googleRefreshToken: '',
  googleTokenExpiry: 0,
  googleUserName: '',
  googleUserEmail: '',
  autoUploadToDrive: false,
  liveTranscription: false,
  audioFormat: 'compact',
};

interface AppContextValue {
  entries: JournalEntry[];
  settings: AppSettings;
  isLoading: boolean;
  addEntry: (entry: JournalEntry) => Promise<void>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  refreshEntries: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      const [savedEntries, savedSettings] = await Promise.all([
        storageService.loadEntries(),
        storageService.loadSettings(),
      ]);
      if (!mounted.current) return;
      setEntries(savedEntries);
      setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      setIsLoading(false);
    })();
  }, []);

  const refreshEntries = useCallback(async () => {
    const saved = await storageService.loadEntries();
    if (mounted.current) setEntries(saved);
  }, []);

  const addEntry = useCallback(async (entry: JournalEntry) => {
    const updated = [entry, ...entries];
    setEntries(updated);
    await storageService.saveEntries(updated);
  }, [entries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<JournalEntry>) => {
    const updated = entries.map(e => e.id === id ? { ...e, ...updates } : e);
    setEntries(updated);
    await storageService.saveEntries(updated);
  }, [entries]);

  const deleteEntry = useCallback(async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    await storageService.saveEntries(updated);
    await storageService.deleteAudioFile(entries.find(e => e.id === id)?.audioUri ?? '');
  }, [entries]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await storageService.saveSettings(updated);
  }, [settings]);

  return (
    <AppContext.Provider value={{
      entries, settings, isLoading,
      addEntry, updateEntry, deleteEntry, updateSettings, refreshEntries,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
