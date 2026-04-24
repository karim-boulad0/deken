import { useTranslation } from 'react-i18next'
import './SettingsPage.css'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="set">
      <header className="set__header">
        <h1 className="set__title" id="set-page-title">
          {t('settings.pageTitle')}
        </h1>
        <p className="set__intro">{t('settings.intro')}</p>
      </header>

      <div className="set__groups">
        <section className="set-group" aria-labelledby="set-general-title">
          <h2 className="set-group__title" id="set-general-title">
            {t('settings.groups.general')}
          </h2>
          <div className="set-group__body">
            <label className="set-field">
              <span className="set-field__label">{t('settings.general.shopName')}</span>
              <input
                className="set-field__input"
                type="text"
                defaultValue=""
                placeholder={t('settings.general.shopNamePlaceholder')}
                disabled
                title={t('settings.general.shopNameDisabledTitle')}
              />
            </label>
            <label className="set-field">
              <span className="set-field__label">{t('settings.general.currency')}</span>
              <p className="set-field__static">{t('settings.general.currencyValue')}</p>
            </label>
          </div>
        </section>

        <section className="set-group" aria-labelledby="set-lang-title">
          <h2 className="set-group__title" id="set-lang-title">
            {t('settings.groups.language')}
          </h2>
          <p className="set-group__note">{t('settings.language.note')}</p>
        </section>

        <section className="set-group" aria-labelledby="set-print-title">
          <h2 className="set-group__title" id="set-print-title">
            {t('settings.groups.printing')}
          </h2>
          <div className="set-group__body">
            <div className="set-toggle">
              <span className="set-toggle__label" id="set-print-receipt-label">
                {t('settings.printing.receiptToggle')}
              </span>
              <button
                type="button"
                className="set-switch"
                role="switch"
                aria-checked={false}
                aria-labelledby="set-print-receipt-label"
                disabled
                title={t('settings.printing.receiptDisabledTitle')}
              >
                <span className="set-switch__thumb" />
              </button>
            </div>
            <label className="set-field">
              <span className="set-field__label">{t('settings.printing.paperLabel')}</span>
              <select
                className="set-field__select"
                disabled
                title={t('settings.printing.paperDisabledTitle')}
                defaultValue="a4"
              >
                <option value="a4">{t('settings.printing.paperA4')}</option>
                <option value="80">{t('settings.printing.paper80')}</option>
              </select>
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}
