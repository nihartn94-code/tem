import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../i18n/en.json';
import hi from '../i18n/hi.json';

const LANG_KEY = '@pharmaos_language';

i18n.use(initReactI18next).init({
 resources: {
 en: { translation: en },
 hi: { translation: hi },
 },
 lng: 'en',
 fallbackLng: 'en',
 interpolation: {
 escapeValue: false,
 },
});

export const changeLanguage = async (lang: string) => {
 await AsyncStorage.setItem(LANG_KEY, lang);
 i18n.changeLanguage(lang);
};

export const loadSavedLanguage = async () => {
 const saved = await AsyncStorage.getItem(LANG_KEY);
 if (saved) {
 i18n.changeLanguage(saved);
 }
};

// Keep the ErrorBoundary locale snapshot in sync (it can't use hooks)
i18n.on('languageChanged', () => {
 import('./i18nBoundary').then((m) => m.resetBoundaryText());
});

export default i18n;
