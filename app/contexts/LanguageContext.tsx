
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";
import en from "../locales/en.json";
import ar from "../locales/ar.json";

const translations = { en, ar };

// Web fallback using localStorage
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(key);
    }
  },
};

const storage = Platform.OS === "web" ? webStorage : SecureStore;

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const getNestedTranslation = (obj: any, key: string): string | undefined => {
  return key.split(".").reduce((o, i) => (o ? o[i] : undefined), obj);
};

// Apply RTL styles to web document
const applyWebRTL = (isRTL: boolean) => {
  if (typeof document !== "undefined") {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = isRTL ? "ar" : "en";
    
    // Apply CSS for proper Arabic text rendering
    const style = document.getElementById("rtl-styles") || document.createElement("style");
    style.id = "rtl-styles";
    style.textContent = `
      html, body {
        direction: ${isRTL ? "rtl" : "ltr"} !important;
      }
      
      * {
        direction: inherit !important;
      }
      
      input, textarea, select {
        text-align: ${isRTL ? "right" : "left"} !important;
        direction: ${isRTL ? "rtl" : "ltr"} !important;
      }
      
      .rtl-text {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: embed;
      }
      
      .ltr-text {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: embed;
      }
      
      [lang="ar"], [dir="rtl"] {
        direction: rtl !important;
        text-align: right !important;
        font-family: 'Arial', 'Tahoma', 'Segoe UI', sans-serif;
      }
      
      [lang="en"], [dir="ltr"] {
        direction: ltr !important;
        text-align: left !important;
      }
      
      /* Fix for flex containers in RTL */
      .flex-row-reverse {
        flex-direction: ${isRTL ? "row" : "row-reverse"} !important;
      }
      
      /* Arabic text specific fixes */
      p, span, div, h1, h2, h3, h4, h5, h6 {
        ${isRTL ? `
          text-align: right !important;
          direction: rtl !important;
          unicode-bidi: embed;
        ` : `
          text-align: left !important;
          direction: ltr !important;
        `}
      }
    `;
    
    if (!document.head.contains(style)) {
      document.head.appendChild(style);
    }
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const storedLanguage = await storage.getItemAsync("shariaa_language");
        if (storedLanguage && ["en", "ar"].includes(storedLanguage)) {
          const lang = storedLanguage as Language;
          setLanguageState(lang);

          const isRTL = lang === "ar";
          
          // Apply RTL for native platforms
          if (Platform.OS !== "web") {
            try {
              I18nManager.forceRTL(isRTL);
              I18nManager.allowRTL(isRTL);
            } catch (error) {
              console.warn("I18nManager not available:", error);
            }
          } else {
            // Apply RTL for web
            applyWebRTL(isRTL);
          }
        }
      } catch (error) {
        console.warn("Failed to load language from storage", error);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLanguageState(lang);
      await storage.setItemAsync("shariaa_language", lang);

      const isRTL = lang === "ar";
      
      console.log("Language changed to:", lang, "(reload skipped in development/web)");
      
      if (Platform.OS !== "web") {
        try {
          I18nManager.forceRTL(isRTL);
          I18nManager.allowRTL(isRTL);
          
          // Only reload in production native builds
          if (!__DEV__) {
            await Updates.reloadAsync();
          }
        } catch (error) {
          console.warn("I18nManager not available:", error);
        }
      } else {
        // Apply RTL for web immediately
        applyWebRTL(isRTL);
      }
    } catch (error) {
      console.error("Failed to set language:", error);
    }
  }, []);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const langTranslations = translations[language];
    const fallbackTranslations = translations.en;
    let translation =
      getNestedTranslation(langTranslations, key) ||
      getNestedTranslation(fallbackTranslations, key) ||
      key;

    if (params) {
      Object.keys(params).forEach((paramKey) => {
        translation = translation.replace(
          `{{${paramKey}}}`,
          String(params[paramKey]),
        );
      });
    }
    return translation;
  };

  const isRTL = language === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export default LanguageProvider;
export { LanguageContext, translations, Language };
