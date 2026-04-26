/** Error payload returned to the renderer for consistent UI handling (e.g. i18n by code). */
export type IpcErrorShape = {
  code: string
  message: string
  details?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcErrorShape }

export const PermissionModules = [
  'dashboard',
  'pos',
  'products',
  'debts',
  'suppliers',
  'expenses',
  'cashflow',
  'reports',
  'settings',
  'employees',
] as const

export type PermissionModule = (typeof PermissionModules)[number]
export type UserRole = 'admin' | 'employee'

export type UserDto = {
  id: string
  username: string
  fullName: string
  role: UserRole
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type UserWithPermissionsDto = {
  user: UserDto
  permissions: PermissionModule[]
}

export type ActorRefDto = {
  id: string
  username: string
  fullName: string
}

export type AuthSessionDto = {
  user: UserDto
  permissions: PermissionModule[]
}

export type AuthLoginInput = {
  username: string
  password?: string
  pin?: string
}

export type CreateUserInput = {
  username: string
  fullName: string
  role: UserRole
  password?: string
  pin?: string
  permissions: PermissionModule[]
}

export type UpdateUserInput = {
  username?: string
  fullName?: string
  role?: UserRole
  isActive?: boolean
}

export type ResetUserCredentialsInput = {
  password?: string
  pin?: string
}

export type SetUserPermissionsInput = {
  permissions: PermissionModule[]
}

export type ProductCategoryRef = {
  id: string
  name: string
}

export type CategorySizeDto = {
  id: string
  categoryId: string
  name: string
  createdAt: string
  updatedAt: string
}

export type CategoryFlavorDto = {
  id: string
  categoryId: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ProductDto = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category: ProductCategoryRef | null
  size: ProductCategoryRef | null
  flavor: ProductCategoryRef | null
  basePriceLbp: number
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
  categorySizeId?: string | null
  categoryFlavorId?: string | null
  basePriceLbp: number
  priceLbp: number
  stock: number
}

export type UpdateProductInput = {
  sku?: string
  barcode?: string | null
  name?: string
  /** Set to null to clear category. Omitted = leave unchanged. */
  categoryId?: string | null
  categorySizeId?: string | null
  categoryFlavorId?: string | null
  basePriceLbp?: number
  priceLbp?: number
  stock?: number
}

export type CreateCategorySizeInput = {
  categoryId: string
  name: string
}

export type UpdateCategorySizeInput = {
  categoryId?: string
  name?: string
}

export type CreateCategoryFlavorInput = {
  categoryId: string
  name: string
}

export type UpdateCategoryFlavorInput = {
  categoryId?: string
  name?: string
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
  /** Optional override unit price captured at sale time (LBP). */
  unitPriceLbp?: number
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
  /** Trimmed text from the most recent on-account sale, if any. */
  lastDebtNote: string | null
}

export type RecordDebtPaymentInput = {
  customerId: string
  amountLbp: number
  note?: string
}

export type RecordDebtPaymentResult = {
  paymentId: string
  newBalanceLbp: number
}

/** One line in a customer’s debt ledger (newest first in API). */
export type CustomerLedgerLineDto = {
  kind: 'debt_sale' | 'payment'
  id: string
  /** ISO-8601 timestamp. */
  at: string
  amountLbp: number
  /** Trimmed; null if none. */
  note: string | null
  actor: ActorRefDto | null
}

/** One catalog line on a saved sale (prices and names are snapshots at sale time). */
export type SaleLineViewDto = {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPriceLbp: number
  lineTotalLbp: number
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

export type AppNavLayout = 'sidebar' | 'top'
export type ReceiptPaper = 'a4' | '80'

export type AppSettingsDto = {
  /** Display name in shell / receipts (optional). */
  shopName: string
  /** Lebanese pounds per 1 USD for display approximations. */
  lbpPerUsd: number
  /** When true, show a classic File/Edit/View app menu (mainly for support / DevTools on Windows and Linux). */
  showClassicMenu: boolean
  /** Main navigation: vertical sidebar (default) or horizontal top bar. */
  navLayout: AppNavLayout
  /** Whether to prompt/print receipt after completing a sale. */
  printReceiptAfterSale: boolean
  /** Preferred receipt paper size preset. */
  receiptPaper: ReceiptPaper
}

export type UpdateAppSettingsInput = {
  shopName?: string
  lbpPerUsd?: number
  showClassicMenu?: boolean
  navLayout?: AppNavLayout
  printReceiptAfterSale?: boolean
  receiptPaper?: ReceiptPaper
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

export type DashboardTodayDto = {
  /** Local calendar day covered (YYYY-MM-DD). */
  dateYmd: string
  totalLbp: number
  /** Number of sale rows in range (cash + debt). */
  saleCount: number
  /** Total units from sale line quantities. */
  itemsSold: number
  /** Sales minus estimated cost for sold items (LBP). */
  grossProfitLbp: number
  /** Gross profit / sales * 100; null when sales are zero. */
  grossMarginPct: number | null
}

export type StockAlertRow = {
  id: string
  name: string
  sku: string
  stock: number
}

export type DashboardCashflowTodayDto = {
  cashInLbp: number
  cashOutLbp: number
  netLbp: number
}

export type DashboardDayComparisonDto = {
  todayTotalLbp: number
  yesterdayTotalLbp: number
  deltaLbp: number
  /**
   * Percent change compared to yesterday.
   * Null when yesterday baseline is zero (undefined growth rate).
   */
  deltaPct: number | null
}

export type DashboardSmartAlertDto = {
  id: string
  kind: 'low_stock' | 'customer_debt' | 'supplier_payable' | 'expense_spike'
  severity: 'high' | 'medium'
  label: string
  value: number
  context: string | null
}

export type DashboardRange = 'today' | '7d' | '30d'

export type DashboardSnapshotInput = {
  range: DashboardRange
}

export type DashboardProductSalesDto = {
  productId: string
  name: string
  sku: string
  quantitySold: number
}

export type DashboardTaskKind =
  | 'collect_customer_debt'
  | 'pay_supplier'
  | 'reorder_stock'
  | 'review_expenses'

export type DashboardTaskDto = {
  id: string
  kind: DashboardTaskKind
  severity: 'high' | 'medium'
  label: string
  value: number
  routeTo: '/debts' | '/suppliers' | '/products' | '/expenses'
}

export type DashboardAlertThresholdsDto = {
  lowStockThreshold: number
  highDebtBalanceLbp: number
  highSupplierPayableLbp: number
  expenseSpikeMinLbp: number
  expenseSpikeRatio: number
}

export type DashboardPeriodDto = {
  range: DashboardRange
  startDateYmd: string
  endDateYmd: string
}

export type DashboardSnapshotDto = {
  period: DashboardPeriodDto
  today: DashboardTodayDto
  cashflowToday: DashboardCashflowTodayDto
  dayComparison: DashboardDayComparisonDto
  smartAlerts: DashboardSmartAlertDto[]
  topProducts: DashboardProductSalesDto[]
  slowProducts: DashboardProductSalesDto[]
  todayTasks: DashboardTaskDto[]
  alertThresholds: DashboardAlertThresholdsDto
  lowStock: StockAlertRow[]
  /** Same value as the query threshold (products with stock at or below this are listed). */
  lowStockThreshold: number
}

/** What the shop owes the supplier: invoices minus payments (positive = outstanding). */
export type SupplierBalanceRow = SupplierDto & {
  balanceLbp: number
}

export type SupplierDto = {
  id: string
  name: string
  phone: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export type CreateSupplierInput = {
  name: string
  phone?: string
  note?: string
}

export type UpdateSupplierInput = {
  name?: string
  phone?: string | null
  note?: string | null
}

export type SupplierInvoiceDto = {
  id: string
  supplierId: string
  invoiceDate: string
  amountLbp: number
  reference: string | null
  note: string | null
  imageDataUrl: string | null
  createdAt: string
  actor: ActorRefDto | null
}

export type CreateSupplierInvoiceInput = {
  supplierId: string
  invoiceDate: string
  amountLbp: number
  reference?: string
  note?: string
  imageDataUrl?: string
}

export type SupplierPaymentDto = {
  id: string
  supplierId: string
  amountLbp: number
  createdAt: string
  note: string | null
  actor: ActorRefDto | null
}

export type CreateSupplierPaymentInput = {
  supplierId: string
  amountLbp: number
  note?: string
}

export type ExpenseCategoryDto = {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CreateExpenseCategoryInput = {
  name: string
  sortOrder?: number
}

export type UpdateExpenseCategoryInput = {
  name?: string
  sortOrder?: number
}

export type ExpenseDto = {
  id: string
  categoryId: string
  categoryName: string
  amountLbp: number
  spentAt: string
  note: string | null
  paidFromCash: boolean
  createdAt: string
  actor: ActorRefDto | null
}

export type CreateExpenseInput = {
  categoryId: string
  amountLbp: number
  spentAt: string
  note?: string
  paidFromCash?: boolean
}

export type UpdateExpenseInput = {
  categoryId?: string
  amountLbp?: number
  spentAt?: string
  note?: string | null
  paidFromCash?: boolean
}

export type ListExpensesInRangeInput = {
  fromDate: string
  toDate: string
}

export type ExpenseTotalInRangeDto = {
  fromDate: string
  toDate: string
  totalLbp: number
}

export type CashflowLineKind =
  | 'cash_sale'
  | 'debt_sale'
  | 'debt_payment'
  | 'supplier_payment'
  | 'expense'

export type CashflowLineDto = {
  rowKey: string
  at: string
  kind: CashflowLineKind
  /** Inflow positive (sales, debt payments); outflow negative (supplier payment, expense). */
  amountSignedLbp: number
  primaryLabel: string | null
  secondaryLabel: string | null
  actor: ActorRefDto | null
  saleId: string | null
  canVoid: boolean
}

export type ListRecentCashflowInput = {
  limit: number
  /** Optional inclusive local date range start (`YYYY-MM-DD`). */
  fromDate?: string
  /** Optional inclusive local date range end (`YYYY-MM-DD`). */
  toDate?: string
}

export type ActivationStatusDto = {
  activated: boolean
  machineCode: string
}

export type VerifyActivationInput = {
  code: string
}

export const IpcInvokes = {
  getAppVersion: 'deken:getAppVersion',
  authGetSession: 'deken:auth:getSession',
  authLogin: 'deken:auth:login',
  authLogout: 'deken:auth:logout',
  usersList: 'deken:users:list',
  usersCreate: 'deken:users:create',
  usersUpdate: 'deken:users:update',
  usersSetPermissions: 'deken:users:setPermissions',
  usersResetCredentials: 'deken:users:resetCredentials',
  usersDelete: 'deken:users:delete',
  listProducts: 'deken:products:list',
  createProduct: 'deken:products:create',
  updateProduct: 'deken:products:update',
  deleteProduct: 'deken:products:delete',
  findProductByCode: 'deken:products:findByCode',
  listCategories: 'deken:categories:list',
  createCategory: 'deken:categories:create',
  updateCategory: 'deken:categories:update',
  deleteCategory: 'deken:categories:delete',
  listCategorySizes: 'deken:categorySizes:list',
  createCategorySize: 'deken:categorySizes:create',
  updateCategorySize: 'deken:categorySizes:update',
  deleteCategorySize: 'deken:categorySizes:delete',
  listCategoryFlavors: 'deken:categoryFlavors:list',
  createCategoryFlavor: 'deken:categoryFlavors:create',
  updateCategoryFlavor: 'deken:categoryFlavors:update',
  deleteCategoryFlavor: 'deken:categoryFlavors:delete',
  listCustomers: 'deken:customers:list',
  listCustomerBalances: 'deken:customers:listBalances',
  getCustomerLedger: 'deken:customers:getLedger',
  recordDebtPayment: 'deken:debt:recordPayment',
  createCustomer: 'deken:customers:create',
  completeCashSale: 'deken:sales:completeCash',
  completeDebtSale: 'deken:sales:completeDebt',
  getDebtSaleLines: 'deken:sales:getDebtSaleLines',
  getSalesReport: 'deken:reports:salesInRange',
  getAppSettings: 'deken:settings:get',
  setAppSettings: 'deken:settings:set',
  getDashboardSnapshot: 'deken:dashboard:getSnapshot',
  listSupplierBalances: 'deken:suppliers:listBalances',
  createSupplier: 'deken:suppliers:create',
  updateSupplier: 'deken:suppliers:update',
  deleteSupplier: 'deken:suppliers:delete',
  listSupplierInvoices: 'deken:suppliers:listInvoices',
  listSupplierPayments: 'deken:suppliers:listPayments',
  createSupplierInvoice: 'deken:suppliers:createInvoice',
  createSupplierPayment: 'deken:suppliers:createPayment',
  listExpenseCategories: 'deken:expenses:listCategories',
  createExpenseCategory: 'deken:expenses:createCategory',
  updateExpenseCategory: 'deken:expenses:updateCategory',
  deleteExpenseCategory: 'deken:expenses:deleteCategory',
  listExpensesInRange: 'deken:expenses:listInRange',
  getExpenseTotalInRange: 'deken:expenses:totalInRange',
  createExpense: 'deken:expenses:create',
  updateExpense: 'deken:expenses:update',
  deleteExpense: 'deken:expenses:delete',
  listRecentCashflow: 'deken:cashflow:listRecent',
  voidCashSale: 'deken:sales:voidCash',
  getActivationStatus: 'deken:activation:status',
  verifyActivation: 'deken:activation:verify',
} as const

export type IpcChannel = (typeof IpcInvokes)[keyof typeof IpcInvokes]
