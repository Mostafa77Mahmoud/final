import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme, Platform } from 'react-native';

// Web fallback using localStorage
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
    return null;
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('localStorage write failed:', error);
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('localStorage delete failed:', error);
    }
  }
};

const storage = Platform.OS === 'web' ? webStorage : SecureStore;

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setSystemTheme: (useSystem: boolean) => void;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>(systemColorScheme || 'light');
  const [isSystemTheme, setIsSystemTheme] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await storage.getItemAsync('shariaa_theme');
        const storedSystemTheme = await storage.getItemAsync('shariaa_use_system_theme');

        if (storedSystemTheme === 'true' && Platform.OS === 'web') {
          // Use system theme
          setIsSystemTheme(true);
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          setThemeState(systemTheme);

          // Listen for system theme changes
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            setThemeState(e.matches ? 'dark' : 'light');
          };
          mediaQuery.addEventListener('change', handleChange);
          return () => mediaQuery.removeEventListener('change', handleChange);
        } else if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
          setIsSystemTheme(false);
          setThemeState(storedTheme as Theme);
        }
      } catch (error) {
        console.warn('Failed to load theme from storage', error);
      }
    };

    loadTheme();
  }, []);

  const toggleTheme = useCallback(async () => {
    try {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setThemeState(newTheme);
      setIsSystemTheme(false);
      await storage.setItemAsync('shariaa_theme', newTheme);
      await storage.setItemAsync('shariaa_use_system_theme', 'false');

      // Force a small UI update delay for smooth transition
      setTimeout(() => {
        console.log(`Theme switched to: ${newTheme}`);
      }, 100);
    } catch (error) {
      console.error('Failed to save theme to storage', error);
    }
  }, [theme]);

  const setSystemTheme = useCallback(async (useSystem: boolean) => {
    try {
      setIsSystemTheme(useSystem);
      await storage.setItemAsync('shariaa_use_system_theme', useSystem.toString());

      if (useSystem && Platform.OS === 'web') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setThemeState(systemTheme);
      }
    } catch (error) {
      console.error('Failed to save system theme preference', error);
    }
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setSystemTheme, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;