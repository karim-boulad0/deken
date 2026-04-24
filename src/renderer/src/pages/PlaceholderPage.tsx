import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type PlaceholderPageProps = {
  titleKey: string
  hintKey: string
  Icon?: LucideIcon
}

export function PlaceholderPage({ titleKey, hintKey, Icon }: PlaceholderPageProps) {
  const { t } = useTranslation()
  return (
    <section className="page-placeholder">
      {Icon ? (
        <div className="page-placeholder__icon-wrap" aria-hidden>
          <Icon className="page-placeholder__icon" size={26} strokeWidth={1.75} />
        </div>
      ) : null}
      <h1 className="page-placeholder__title">{t(titleKey)}</h1>
      <p className="page-placeholder__hint">{t(hintKey)}</p>
    </section>
  )
}
