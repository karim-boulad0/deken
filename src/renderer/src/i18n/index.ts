import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'

export type SupportedLng = 'ar' | 'en'

const STORAGE_KEY = 'deken.locale'

function getInitialLng(): SupportedLng {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'ar' || s === 'en') return s
  } catch {
    /* private mode or blocked storage */
  }
  return 'ar'
}

export function syncDocumentLanguage(lng: SupportedLng): void {
  document.documentElement.lang = lng
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
}

const initialLng = getInitialLng()
syncDocumentLanguage(initialLng)

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    lng: initialLng,
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
  })
}

export function setAppLanguage(lng: SupportedLng): void {
  syncDocumentLanguage(lng)
  void i18n.changeLanguage(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
}

export default i18n
