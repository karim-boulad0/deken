import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useToast } from '../../components/toast'
import { setAppSettings } from '../../lib/api/dekenClient'
import './SettingsPage.css'

const MAX_SHOP = 200

function mapSettingsErrorKey(message: string): string {
  const m = message.trim()
  if (m === 'lbp_per_usd_invalid' || m === 'shop_name_too_long') {
    return m
  }
  return 'save_failed'
}

export function SettingsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { settings, loaded, refresh } = useAppSettings()
  const [shopName, setShopName] = useState('')
  const [lbpStr, setLbpStr] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [classicBusy, setClassicBusy] = useState(false)

  useEffect(() => {
    if (!loaded) {
      return
    }
    if (!dirty) {
      setShopName(settings.shopName)
      setLbpStr(String(settings.lbpPerUsd))
    }
  }, [loaded, settings, dirty])

  const onSave = useCallback(async () => {
    if (!loaded || window.deken == null) {
      return
    }
    const nameTrim = shopName.trim()
    if (nameTrim.length > MAX_SHOP) {
      toast.error(t('settings.errors.shop_name_too_long'))
      return
    }
    const n = Math.floor(Number(lbpStr))
    if (!Number.isInteger(n) || n < 1) {
      toast.error(t('settings.errors.lbp_invalid_client'))
      return
    }
    if (n > 100_000_000) {
      toast.error(t('settings.errors.lbp_per_usd_invalid'))
      return
    }
    if (nameTrim === settings.shopName && n === settings.lbpPerUsd) {
      return
    }
    setSaving(true)
    const r = await setAppSettings({
      shopName: nameTrim,
      lbpPerUsd: n,
    })
    setSaving(false)
    if (r.ok) {
      setDirty(false)
      await refresh()
      toast.success(t('settings.toast.saved'))
    } else {
      const k = mapSettingsErrorKey(r.error.message)
      toast.error(
        k === 'save_failed' ? t('settings.errors.save_failed', { message: r.error.message }) : t(`settings.errors.${k}`),
      )
    }
  }, [loaded, lbpStr, shopName, settings.lbpPerUsd, settings.shopName, refresh, t, toast])

  const onToggleClassicMenu = useCallback(async () => {
    if (!loaded || window.deken == null) {
      return
    }
    const next = !settings.showClassicMenu
    setClassicBusy(true)
    const r = await setAppSettings({ showClassicMenu: next })
    setClassicBusy(false)
    if (r.ok) {
      await refresh()
      toast.success(t('settings.toast.menuUpdated'))
    } else {
      const k = mapSettingsErrorKey(r.error.message)
      toast.error(
        k === 'save_failed' ? t('settings.errors.save_failed', { message: r.error.message }) : t(`settings.errors.${k}`),
      )
    }
  }, [loaded, settings.showClassicMenu, refresh, t, toast])

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
                value={shopName}
                onChange={(e) => {
                  setDirty(true)
                  setShopName(e.target.value)
                }}
                placeholder={t('settings.general.shopNamePlaceholder')}
                maxLength={MAX_SHOP}
                disabled={!loaded || saving || window.deken == null}
                aria-invalid={shopName.length > MAX_SHOP}
                autoComplete="organization"
              />
            </label>
            <label className="set-field">
              <span className="set-field__label">{t('settings.general.lbpPerUsd')}</span>
              <input
                className="set-field__input"
                type="text"
                inputMode="numeric"
                value={lbpStr}
                onChange={(e) => {
                  setDirty(true)
                  setLbpStr(e.target.value)
                }}
                placeholder={t('settings.general.lbpPerUsdPlaceholder')}
                disabled={!loaded || saving || window.deken == null}
                autoComplete="off"
              />
              <span className="set-field__hint">{t('settings.general.lbpPerUsdHint')}</span>
            </label>
            <label className="set-field">
              <span className="set-field__label">{t('settings.general.currency')}</span>
              <p className="set-field__static">{t('settings.general.currencyValue')}</p>
            </label>
            <div className="set__actions">
              <button
                type="button"
                className="set-btn set-btn--primary"
                onClick={() => void onSave()}
                disabled={!loaded || saving || window.deken == null}
              >
                {saving ? t('settings.saving') : t('settings.save')}
              </button>
            </div>
          </div>
        </section>

        <section className="set-group" aria-labelledby="set-interface-title">
          <h2 className="set-group__title" id="set-interface-title">
            {t('settings.groups.interface')}
          </h2>
          <div className="set-group__body">
            <p className="set-group__interface-intro">{t('settings.interface.classicMenuIntro')}</p>
            <div className="set-toggle">
              <span className="set-toggle__label" id="set-classic-menu-label">
                {t('settings.interface.classicMenuLabel')}
              </span>
              <button
                type="button"
                className={
                  settings.showClassicMenu
                    ? 'set-switch set-switch--on'
                    : 'set-switch'
                }
                role="switch"
                aria-checked={settings.showClassicMenu}
                aria-labelledby="set-classic-menu-label"
                disabled={!loaded || classicBusy || window.deken == null}
                title={t('settings.interface.classicMenuTitle')}
                onClick={() => void onToggleClassicMenu()}
              >
                <span className="set-switch__thumb" />
              </button>
            </div>
            <p className="set-field__hint">{t('settings.interface.classicMenuHint')}</p>
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
