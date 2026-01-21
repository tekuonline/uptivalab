import { useState, useEffect } from "react";
import { t as translate, onLanguageChange, getLanguage, initI18n, type TranslationKey } from "../lib/i18n.js";

/**
 * Hook to get translations that automatically updates when language changes
 * For public pages, fetches server language if no local language is set
 */
export function useTranslation() {
  const [, setUpdateCounter] = useState(0);
  const [languageLoading, setLanguageLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      setUpdateCounter(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  // For public pages, fetch server language if no local language is set
  useEffect(() => {
    const initializePublicLanguage = async () => {
      const token = localStorage.getItem("uptivalab.token");
      const storedLang = localStorage.getItem("uptivalab.language");

      // If user is not authenticated, always fetch server language for public pages
      if (!token) {
        setLanguageLoading(true);
        try {
          const response = await fetch('/api/settings/language');
          if (response.ok) {
            const serverLang = await response.text(); // API returns plain text, not JSON
            // Always set server language for public pages
            if (serverLang) {
              initI18n(serverLang);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch server language:', error);
        } finally {
          setLanguageLoading(false);
        }
      }
    };

    initializePublicLanguage();
  }, []);

  const t = (key: TranslationKey): string => {
    return translate(key);
  };

  return { t, languageLoading };
}
