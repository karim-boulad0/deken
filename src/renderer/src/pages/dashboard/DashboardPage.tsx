import { BarChart3, Package, ScanBarcode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './DashboardPage.css'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="dash">
      <header className="dash__header">
        <h1 className="dash__title" id="dash-page-title">
          {t('dashboard.pageTitle')}
        </h1>
        <p className="dash__intro">{t('dashboard.intro')}</p>
      </header>

      <div className="dash__grid">
        <section className="dash-card" aria-labelledby="dash-summary-title">
          <h2 className="dash-card__title" id="dash-summary-title">
            {t('dashboard.sections.summary')}
          </h2>
          <ul className="dash-statlist">
            <li className="dash-statlist__row">
              <span className="dash-statlist__label">{t('dashboard.summary.salesLabel')}</span>
              <span
                className="dash-statlist__value"
                aria-label={t('dashboard.summary.mockAriaSales')}
              >
                {t('dashboard.summary.salesMock')}
              </span>
            </li>
            <li className="dash-statlist__row">
              <span className="dash-statlist__label">{t('dashboard.summary.invoicesLabel')}</span>
              <span className="dash-statlist__value">{t('dashboard.summary.invoicesMock')}</span>
            </li>
            <li className="dash-statlist__row">
              <span className="dash-statlist__label">{t('dashboard.summary.itemsLabel')}</span>
              <span className="dash-statlist__value">{t('dashboard.summary.itemsMock')}</span>
            </li>
          </ul>
          <p className="dash-card__footnote">{t('dashboard.summary.footnote')}</p>
        </section>

        <section className="dash-card" aria-labelledby="dash-shortcuts-title">
          <h2 className="dash-card__title" id="dash-shortcuts-title">
            {t('dashboard.sections.shortcuts')}
          </h2>
          <ul className="dash-shortcuts">
            <li>
              <Link className="dash-shortcuts__link" to="/pos">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <ScanBarcode size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.newSale')}</span>
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.newSaleDesc')}
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link className="dash-shortcuts__link" to="/products">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <Package size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.products')}</span>
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.productsDesc')}
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link className="dash-shortcuts__link" to="/reports">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <BarChart3 size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.reports')}</span>
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.reportsDesc')}
                  </span>
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section className="dash-card dash-card--wide" aria-labelledby="dash-alerts-title">
          <h2 className="dash-card__title" id="dash-alerts-title">
            {t('dashboard.sections.alerts')}
          </h2>
          <div className="dash-empty" role="status">
            <p className="dash-empty__title">{t('dashboard.alerts.emptyTitle')}</p>
            <p className="dash-empty__text">{t('dashboard.alerts.emptyBody')}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
