import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './ReportsPage.css'

type PeriodPreset = 'week' | 'month' | 'quarter'

export function ReportsPage() {
  const { t } = useTranslation()
  const periodLabelId = useId()
  const [preset, setPreset] = useState<PeriodPreset>('week')

  return (
    <div className="rep">
      <header className="rep__header">
        <h1 className="rep__title" id="rep-page-title">
          {t('reports.pageTitle')}
        </h1>
        <p className="rep__intro">{t('reports.intro')}</p>
      </header>

      <section className="rep-toolbar" aria-labelledby={periodLabelId}>
        <div className="rep-toolbar__row">
          <label className="rep-field">
            <span className="rep-field__label" id={periodLabelId}>
              {t('reports.filters.periodLabel')}
            </span>
            <select
              className="rep-field__select"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PeriodPreset)}
              aria-label={t('reports.filters.periodLabel')}
            >
              <option value="week">{t('reports.filters.presetWeek')}</option>
              <option value="month">{t('reports.filters.presetMonth')}</option>
              <option value="quarter">{t('reports.filters.presetQuarter')}</option>
            </select>
          </label>
          <div className="rep-toolbar__dates">
            <label className="rep-field rep-field--inline">
              <span className="rep-field__label">{t('reports.filters.fromLabel')}</span>
              <input
                className="rep-field__input"
                type="date"
                disabled
                title={t('reports.filters.rangeDisabledTitle')}
                aria-label={t('reports.filters.fromLabel')}
              />
            </label>
            <label className="rep-field rep-field--inline">
              <span className="rep-field__label">{t('reports.filters.toLabel')}</span>
              <input
                className="rep-field__input"
                type="date"
                disabled
                title={t('reports.filters.rangeDisabledTitle')}
                aria-label={t('reports.filters.toLabel')}
              />
            </label>
          </div>
          <button
            type="button"
            className="rep-btn rep-btn--primary"
            disabled
            title={t('reports.filters.applyDisabledTitle')}
          >
            {t('reports.filters.apply')}
          </button>
        </div>
      </section>

      <div className="rep__grid">
        <section className="rep-empty" aria-labelledby="rep-empty-title">
          <h2 className="rep-empty__title" id="rep-empty-title">
            {t('reports.empty.title')}
          </h2>
          <p className="rep-empty__body">{t('reports.empty.body')}</p>
        </section>

        <section className="rep-preview" aria-labelledby="rep-preview-title">
          <h2 className="rep-preview__title" id="rep-preview-title">
            {t('reports.preview.title')}
          </h2>
          <p className="rep-preview__hint">{t('reports.preview.hint')}</p>
          <div className="rep-chart" role="img" aria-label={t('reports.preview.chartAria')}>
            <div className="rep-chart__bars">
              <div className="rep-chart__bar" style={{ height: '42%' }} />
              <div className="rep-chart__bar" style={{ height: '68%' }} />
              <div className="rep-chart__bar" style={{ height: '35%' }} />
              <div className="rep-chart__bar" style={{ height: '88%' }} />
              <div className="rep-chart__bar" style={{ height: '55%' }} />
              <div className="rep-chart__bar" style={{ height: '72%' }} />
              <div className="rep-chart__bar" style={{ height: '48%' }} />
            </div>
          </div>
          <div className="rep-table-mock">
            <table className="rep-table">
              <thead>
                <tr>
                  <th scope="col">{t('reports.table.colDay')}</th>
                  <th scope="col" className="rep-table__num">
                    {t('reports.table.colSales')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('reports.table.sampleRowLabel')}</td>
                  <td className="rep-table__num">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
