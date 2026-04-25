import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SupportedLng } from '../i18n'
import { setAppLanguage } from '../i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const lng: SupportedLng = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const nextLng: SupportedLng = lng === 'ar' ? 'en' : 'ar'

  return (
    <button
      type="button"
      className="lang-switcher"
      role="switch"
      aria-checked={lng === 'en'}
      aria-label={t('lang.toggleAria')}
      title={t('lang.toggleAria')}
      onClick={() => setAppLanguage(nextLng)}
    >
      <span className="lang-switcher__glyph" aria-hidden>
        <Languages size={16} strokeWidth={2} />
      </span>
    </button>
  )
}
