/** Error payload returned to the renderer for consistent UI handling (e.g. i18n by code). */
export type IpcErrorShape = {
  code: string
  message: string
  details?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcErrorShape }

export type ProductCategoryRef = {
  id: string
  name: string
}

export type ProductDto = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category: ProductCategoryRef | null
  priceLbp: number
  stock: number
  createdAt: string
  updatedAt: string
}

export type CreateProductInput = {
  sku: string
  barcode?: string
  name: string
  /** If omitted or null, the product is uncategorized. */
  categoryId?: string | null
  priceLbp: number
  stock: number
}

export type UpdateProductInput = {
  sku?: string
  barcode?: string | null
  name?: string
  /** Set to null to clear category. Omitted = leave unchanged. */
  categoryId?: string | null
  priceLbp?: number
  stock?: number
}

export type CategoryDto = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type CreateCategoryInput = {
  name: string
}

export type UpdateCategoryInput = {
  name: string
}

/** One line for completing a sale; same product can appear once (merge on client) or multiple times (server merges by productId). */
export type PosSaleLineInput = {
  productId: string
  quantity: number
}

export type CustomerDto = {
  id: string
  name: string
  phone: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerBalanceRow = CustomerDto & {
  balanceLbp: number
  lastDebtSaleAt: string | null
}

export type CreateCustomerInput = {
  name: string
  phone?: string
}

export type CompleteCashSaleResult = {
  saleId: string
  totalLbp: number
  createdAt: string
}

/**
 * On-account (debt) sale: same line rules as cash; new customer is created in the same transaction.
 */
export type CompleteDebtSaleInput = {
  lines: PosSaleLineInput[]
  /** Trimmed; stored on the sale row. */
  note: string
} & (
  | { mode: 'existing'; customerId: string }
  | { mode: 'new'; customerName: string; customerPhone: string }
)

export type SalesReportInput = {
  /** Inclusive `YYYY-MM-DD` (local calendar, compared to SQLite `date(created_at)` / UTC). */
  fromDate: string
  /** Inclusive `YYYY-MM-DD`. */
  toDate: string
}

export type SalesReportDay = {
  day: string
  totalLbp: number
  count: number
}

export type SalesReportDto = {
  fromDate: string
  toDate: string
  totalLbp: number
  totalCashLbp: number
  totalDebtLbp: number
  saleCount: number
  byDay: SalesReportDay[]
}

export const IpcInvokes = {
  getAppVersion: 'deken:getAppVersion',
  listProducts: 'deken:products:list',
  createProduct: 'deken:products:create',
  updateProduct: 'deken:products:update',
  deleteProduct: 'deken:products:delete',
  findProductByCode: 'deken:products:findByCode',
  listCategories: 'deken:categories:list',
  createCategory: 'deken:categories:create',
  updateCategory: 'deken:categories:update',
  deleteCategory: 'deken:categories:delete',
  listCustomers: 'deken:customers:list',
  listCustomerBalances: 'deken:customers:listBalances',
  createCustomer: 'deken:customers:create',
  completeCashSale: 'deken:sales:completeCash',
  completeDebtSale: 'deken:sales:completeDebt',
  getSalesReport: 'deken:reports:salesInRange',
} as const

export type IpcChannel = (typeof IpcInvokes)[keyof typeof IpcInvokes]
