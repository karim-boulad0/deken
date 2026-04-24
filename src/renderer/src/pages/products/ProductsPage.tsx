import { Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLbp } from '../pos/formatPos'
import './ProductsPage.css'

type MockProduct = {
  id: string
  sku: string
  nameKey: string
  categoryKey: string
  stock: number
  priceLbp: number
}

const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 'p1',
    sku: '123',
    nameKey: 'products.mock.nameWater',
    categoryKey: 'products.mock.catBeverages',
    stock: 120,
    priceLbp: 500,
  },
  {
    id: 'p2',
    sku: '999',
    nameKey: 'products.mock.nameBread',
    categoryKey: 'products.mock.catBakery',
    stock: 36,
    priceLbp: 3500,
  },
  {
    id: 'p3',
    sku: 'SKU-RICE-1',
    nameKey: 'products.mock.nameRice',
    categoryKey: 'products.mock.catDry',
    stock: 0,
    priceLbp: 185_000,
  },
  {
    id: 'p4',
    sku: 'SKU-OIL-1L',
    nameKey: 'products.mock.nameOil',
    categoryKey: 'products.mock.catDry',
    stock: 14,
    priceLbp: 72_000,
  },
  {
    id: 'p5',
    sku: 'SKU-SUGAR',
    nameKey: 'products.mock.nameSugar',
    categoryKey: 'products.mock.catDry',
    stock: 88,
    priceLbp: 45_000,
  },
]

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_PRODUCTS
    return MOCK_PRODUCTS.filter((row) => {
      const name = t(row.nameKey).toLowerCase()
      const cat = t(row.categoryKey).toLowerCase()
      const sku = row.sku.toLowerCase()
      return name.includes(q) || cat.includes(q) || sku.includes(q)
    })
  }, [query, t])

  const showEmpty = query.trim().length > 0 && filtered.length === 0

  return (
    <div className="prod">
      <header className="prod__header">
        <div>
          <h1 className="prod__title" id="prod-page-title">
            {t('products.pageTitle')}
          </h1>
          <p className="prod__intro">{t('products.intro')}</p>
        </div>
      </header>

      <div className="prod__toolbar" role="search">
        <div className="prod__search">
          <span className="prod__search-icon" aria-hidden>
            <Search size={20} strokeWidth={2} />
          </span>
          <input
            className="prod__search-input"
            type="search"
            autoComplete="off"
            placeholder={t('products.toolbar.searchPlaceholder')}
            aria-label={t('products.toolbar.searchAria')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="prod__toolbar-end">
          <label className="prod__filter">
            <span className="prod__filter-label">{t('products.toolbar.filterLabel')}</span>
            <select
              className="prod__filter-select"
              disabled
              title={t('products.toolbar.filterDisabledTitle')}
              aria-label={t('products.toolbar.filterLabel')}
              defaultValue="all"
            >
              <option value="all">{t('products.toolbar.allCategories')}</option>
            </select>
          </label>
          <button
            type="button"
            className="prod-btn prod-btn--primary"
            disabled
            title={t('products.actions.addDisabledTitle')}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            {t('products.actions.add')}
          </button>
        </div>
      </div>

      <section className="prod-panel" aria-labelledby="prod-table-title">
        <div className="prod-panel__head">
          <h2 className="prod-panel__title" id="prod-table-title">
            {t('products.table.sectionTitle')}
          </h2>
        </div>

        {showEmpty ? (
          <div className="prod-empty" role="status">
            <p className="prod-empty__title">{t('products.empty.noResultsTitle')}</p>
            <p className="prod-empty__body">{t('products.empty.noResultsBody')}</p>
            <button type="button" className="prod-btn prod-btn--ghost" onClick={() => setQuery('')}>
              {t('products.empty.clearSearch')}
            </button>
          </div>
        ) : (
          <div className="prod-table-wrap">
            <table className="prod-table">
              <colgroup>
                <col className="prod-table__col-sku" />
                <col className="prod-table__col-name" />
                <col className="prod-table__col-cat" />
                <col className="prod-table__col-stock" />
                <col className="prod-table__col-price" />
                <col className="prod-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{t('products.table.sku')}</th>
                  <th scope="col">{t('products.table.name')}</th>
                  <th scope="col">{t('products.table.category')}</th>
                  <th scope="col" className="prod-table__num">
                    {t('products.table.stock')}
                  </th>
                  <th scope="col" className="prod-table__num">
                    {t('products.table.price')}
                  </th>
                  <th scope="col">
                    <span className="prod-visually-hidden">{t('products.table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code className="prod-code">{row.sku}</code>
                    </td>
                    <td className="prod-table__cell-truncate">
                      <span className="prod-table__ellipsis" title={t(row.nameKey)}>
                        {t(row.nameKey)}
                      </span>
                    </td>
                    <td className="prod-table__cell-muted prod-table__cell-truncate">
                      <span className="prod-table__ellipsis" title={t(row.categoryKey)}>
                        {t(row.categoryKey)}
                      </span>
                    </td>
                    <td className="prod-table__num">
                      <span className={row.stock === 0 ? 'prod-stock prod-stock--out' : 'prod-stock'}>
                        {row.stock.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US')}
                      </span>
                    </td>
                    <td className="prod-table__num prod-table__strong">
                      {formatLbp(row.priceLbp, lng)}
                    </td>
                    <td className="prod-table__actions">
                      <button
                        type="button"
                        className="prod-iconbtn"
                        disabled
                        title={t('products.actions.editDisabledTitle')}
                        aria-label={t('products.actions.edit')}
                      >
                        <Pencil size={17} strokeWidth={2} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
