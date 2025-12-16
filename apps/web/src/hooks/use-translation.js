import { useState, useEffect } from "react";
import { t as translate, onLanguageChange } from "../lib/i18n.js";
/**
 * Hook to get translations that automatically updates when language changes
 */
export function useTranslation() {
    const [, setUpdateCounter] = useState(0);
    useEffect(() => {
        const unsubscribe = onLanguageChange(() => {
            setUpdateCounter(prev => prev + 1);
        });
        return unsubscribe;
    }, []);
    const t = (key) => {
        return translate(key);
    };
    return { t };
}
