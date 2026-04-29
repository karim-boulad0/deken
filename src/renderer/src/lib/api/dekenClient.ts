import type {
  AppSettingsDto,
  AuthLoginInput,
  AuthSessionDto,
  ActivationStatusDto,
  CashflowLineDto,
  BulkImportCategoryInput,
  BulkImportCustomerInput,
  BulkImportFlavorInput,
  BulkImportProductInput,
  BulkImportSizeInput,
  CategoryDto,
  CategoryFlavorDto,
  CategorySizeDto,
  CompleteCashSaleResult,
  CompleteDebtSaleInput,
  CreateCategoryInput,
  CreateCategoryFlavorInput,
  CreateCategorySizeInput,
  CreateCustomerInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateProductInput,
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  CreateSupplierPaymentInput,
  CreateUserInput,
  CustomerBalanceRow,
  CustomerDto,
  CustomerLedgerLineDto,
  DashboardSnapshotInput,
  DashboardSnapshotDto,
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseTotalInRangeDto,
  IpcResult,
  ListExpensesInRangeInput,
  ListRecentCashflowInput,
  PosSaleLineInput,
  ProductDto,
  RecordDebtPaymentInput,
  RecordDebtPaymentResult,
  SaleLineViewDto,
  SupplierBalanceRow,
  SupplierDto,
  SupplierInvoiceDto,
  SupplierPaymentDto,
  UpdateAppSettingsInput,
  UpdateCategoryInput,
  UpdateCategoryFlavorInput,
  UpdateCategorySizeInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateProductInput,
  SalesReportDto,
  SalesReportInput,
  SetUserPermissionsInput,
  UpdateSupplierInput,
  UpdateUserInput,
  VerifyActivationInput,
  ResetUserCredentialsInput,
  UserWithPermissionsDto,
  WifiCredentialDto,
} from '../../../../shared/ipc/types'

function isDeken() {
  return window.deken != null
}

export function assertDeken(): NonNullable<typeof window.deken> {
  if (!isDeken()) {
    throw new Error('Deken preload bridge is not available. Run inside Electron.')
  }
  return window.deken
}

export async function listProducts(
  search: string,
  filterCategoryId?: string | null,
): Promise<IpcResult<ProductDto[]>> {
  return assertDeken().products.list(search, filterCategoryId ?? null)
}

export async function createProduct(
  input: CreateProductInput,
): Promise<IpcResult<ProductDto>> {
  return assertDeken().products.create(input)
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<IpcResult<ProductDto>> {
  return assertDeken().products.update(id, input)
}

export async function findProductByCode(code: string): Promise<IpcResult<ProductDto | null>> {
  return assertDeken().products.findByCode(code)
}

export async function deleteProduct(id: string): Promise<IpcResult<null>> {
  return assertDeken().products.delete(id)
}

export async function getAppVersion(): Promise<IpcResult<string>> {
  return assertDeken().getAppVersion()
}

export async function getAuthSession(): Promise<IpcResult<AuthSessionDto | null>> {
  return assertDeken().auth.getSession()
}

export async function login(input: AuthLoginInput): Promise<IpcResult<AuthSessionDto>> {
  return assertDeken().auth.login(input)
}

export async function logout(): Promise<IpcResult<null>> {
  return assertDeken().auth.logout()
}

export async function listUsers(): Promise<IpcResult<UserWithPermissionsDto[]>> {
  return assertDeken().users.list()
}

export async function createUser(input: CreateUserInput): Promise<IpcResult<UserWithPermissionsDto>> {
  return assertDeken().users.create(input)
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<IpcResult<UserWithPermissionsDto>> {
  return assertDeken().users.update(id, input)
}

export async function setUserPermissions(
  id: string,
  input: SetUserPermissionsInput,
): Promise<IpcResult<UserWithPermissionsDto>> {
  return assertDeken().users.setPermissions(id, input)
}

export async function resetUserCredentials(
  id: string,
  input: ResetUserCredentialsInput,
): Promise<IpcResult<UserWithPermissionsDto>> {
  return assertDeken().users.resetCredentials(id, input)
}

export async function deleteUser(id: string): Promise<IpcResult<null>> {
  return assertDeken().users.delete(id)
}

export async function getActivationStatus(): Promise<IpcResult<ActivationStatusDto>> {
  if (!isDeken()) {
    return { ok: true, data: { activated: true, machineCode: 'DEV-MODE' } }
  }
  return assertDeken().activation.status()
}

export async function verifyActivation(input: VerifyActivationInput): Promise<IpcResult<ActivationStatusDto>> {
  return assertDeken().activation.verify(input)
}

export async function listCategories(): Promise<IpcResult<CategoryDto[]>> {
  return assertDeken().categories.list()
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<IpcResult<CategoryDto>> {
  return assertDeken().categories.create(input)
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<IpcResult<CategoryDto>> {
  return assertDeken().categories.update(id, input)
}

export async function deleteCategory(id: string): Promise<IpcResult<null>> {
  return assertDeken().categories.delete(id)
}

export async function listCategorySizes(): Promise<IpcResult<CategorySizeDto[]>> {
  return assertDeken().categorySizes.list()
}
export async function createCategorySize(input: CreateCategorySizeInput): Promise<IpcResult<CategorySizeDto>> {
  return assertDeken().categorySizes.create(input)
}
export async function updateCategorySize(
  id: string,
  input: UpdateCategorySizeInput,
): Promise<IpcResult<CategorySizeDto>> {
  return assertDeken().categorySizes.update(id, input)
}
export async function deleteCategorySize(id: string): Promise<IpcResult<null>> {
  return assertDeken().categorySizes.delete(id)
}

export async function listCategoryFlavors(): Promise<IpcResult<CategoryFlavorDto[]>> {
  return assertDeken().categoryFlavors.list()
}
export async function createCategoryFlavor(
  input: CreateCategoryFlavorInput,
): Promise<IpcResult<CategoryFlavorDto>> {
  return assertDeken().categoryFlavors.create(input)
}
export async function updateCategoryFlavor(
  id: string,
  input: UpdateCategoryFlavorInput,
): Promise<IpcResult<CategoryFlavorDto>> {
  return assertDeken().categoryFlavors.update(id, input)
}
export async function deleteCategoryFlavor(id: string): Promise<IpcResult<null>> {
  return assertDeken().categoryFlavors.delete(id)
}

export async function completeCashSale(
  lines: PosSaleLineInput[],
): Promise<IpcResult<CompleteCashSaleResult>> {
  return assertDeken().sales.completeCash(lines)
}

export async function listCustomers(): Promise<IpcResult<CustomerDto[]>> {
  return assertDeken().customers.list()
}

export async function listCustomerBalances(): Promise<IpcResult<CustomerBalanceRow[]>> {
  return assertDeken().customers.listBalances()
}

export async function getCustomerLedger(
  customerId: string,
): Promise<IpcResult<CustomerLedgerLineDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().customers.getLedger(customerId)
}

export async function recordDebtPayment(
  input: RecordDebtPaymentInput,
): Promise<IpcResult<RecordDebtPaymentResult>> {
  return assertDeken().debt.recordPayment(input)
}

export async function getDebtSaleLines(
  customerId: string,
  saleId: string,
): Promise<IpcResult<SaleLineViewDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().sales.getDebtSaleLines(customerId, saleId)
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<IpcResult<CustomerDto>> {
  return assertDeken().customers.create(input)
}

export async function completeDebtSale(
  input: CompleteDebtSaleInput,
): Promise<IpcResult<CompleteCashSaleResult>> {
  return assertDeken().sales.completeDebt(input)
}

export async function getSalesReport(
  r: SalesReportInput,
): Promise<IpcResult<SalesReportDto>> {
  return assertDeken().reports.getSales(r)
}

export async function getAppSettings(): Promise<IpcResult<AppSettingsDto>> {
  return assertDeken().settings.get()
}

export async function setAppSettings(
  input: UpdateAppSettingsInput,
): Promise<IpcResult<AppSettingsDto>> {
  return assertDeken().settings.set(input)
}

export async function getCurrentWifiCredential(): Promise<IpcResult<WifiCredentialDto>> {
  return assertDeken().wifi.getCurrentCredential()
}

function localDateYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyDashboardSnapshot(): DashboardSnapshotDto {
  return {
    period: {
      range: 'today',
      startDateYmd: localDateYmd(),
      endDateYmd: localDateYmd(),
    },
    today: {
      dateYmd: localDateYmd(),
      totalLbp: 0,
      saleCount: 0,
      itemsSold: 0,
      grossProfitLbp: 0,
      grossMarginPct: null,
    },
    cashflowToday: { cashInLbp: 0, cashOutLbp: 0, netLbp: 0 },
    dayComparison: {
      todayTotalLbp: 0,
      yesterdayTotalLbp: 0,
      deltaLbp: 0,
      deltaPct: null,
    },
    smartAlerts: [],
    topProducts: [],
    slowProducts: [],
    todayTasks: [],
    alertThresholds: {
      lowStockThreshold: 10,
      highDebtBalanceLbp: 10_000_000,
      highSupplierPayableLbp: 12_000_000,
      expenseSpikeMinLbp: 1_500_000,
      expenseSpikeRatio: 1.5,
    },
    lowStock: [],
    lowStockThreshold: 10,
  }
}

export async function getDashboardSnapshot(
  input: DashboardSnapshotInput = { range: 'today' },
): Promise<IpcResult<DashboardSnapshotDto>> {
  if (!isDeken()) {
    return { ok: true, data: emptyDashboardSnapshot() }
  }
  return assertDeken().dashboard.getSnapshot(input)
}

export async function listSupplierBalances(): Promise<IpcResult<SupplierBalanceRow[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().suppliers.listBalances()
}

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<IpcResult<SupplierDto>> {
  return assertDeken().suppliers.create(input)
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
): Promise<IpcResult<SupplierDto>> {
  return assertDeken().suppliers.update(id, input)
}

export async function deleteSupplier(id: string): Promise<IpcResult<null>> {
  return assertDeken().suppliers.delete(id)
}

export async function listSupplierInvoices(
  supplierId: string,
): Promise<IpcResult<SupplierInvoiceDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().suppliers.listInvoices(supplierId)
}

export async function listSupplierPayments(
  supplierId: string,
): Promise<IpcResult<SupplierPaymentDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().suppliers.listPayments(supplierId)
}

export async function createSupplierInvoice(
  input: CreateSupplierInvoiceInput,
): Promise<IpcResult<SupplierInvoiceDto>> {
  return assertDeken().suppliers.createInvoice(input)
}

export async function createSupplierPayment(
  input: CreateSupplierPaymentInput,
): Promise<IpcResult<SupplierPaymentDto>> {
  return assertDeken().suppliers.createPayment(input)
}

export async function listExpenseCategories(): Promise<IpcResult<ExpenseCategoryDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().expenses.listCategories()
}

export async function createExpenseCategory(
  input: CreateExpenseCategoryInput,
): Promise<IpcResult<ExpenseCategoryDto>> {
  return assertDeken().expenses.createCategory(input)
}

export async function updateExpenseCategory(
  id: string,
  input: UpdateExpenseCategoryInput,
): Promise<IpcResult<ExpenseCategoryDto>> {
  return assertDeken().expenses.updateCategory(id, input)
}

export async function deleteExpenseCategory(id: string): Promise<IpcResult<null>> {
  return assertDeken().expenses.deleteCategory(id)
}

export async function listExpensesInRange(
  input: ListExpensesInRangeInput,
): Promise<IpcResult<ExpenseDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().expenses.listInRange(input)
}

export async function getExpenseTotalInRange(
  input: ListExpensesInRangeInput,
): Promise<IpcResult<ExpenseTotalInRangeDto>> {
  if (!isDeken()) {
    const from = input.fromDate
    const to = input.toDate
    return { ok: true, data: { fromDate: from, toDate: to, totalLbp: 0 } }
  }
  return assertDeken().expenses.totalInRange(input)
}

export async function createExpense(input: CreateExpenseInput): Promise<IpcResult<ExpenseDto>> {
  return assertDeken().expenses.create(input)
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<IpcResult<ExpenseDto>> {
  return assertDeken().expenses.update(id, input)
}

export async function deleteExpense(id: string): Promise<IpcResult<null>> {
  return assertDeken().expenses.delete(id)
}

export async function listRecentCashflow(
  input: ListRecentCashflowInput,
): Promise<IpcResult<CashflowLineDto[]>> {
  if (!isDeken()) {
    return { ok: true, data: [] }
  }
  return assertDeken().cashflow.listRecent(input)
}

export async function voidCashSale(saleId: string): Promise<IpcResult<{ saleId: string }>> {
  return assertDeken().sales.voidCash(saleId)
}

export async function bulkImportProducts(
  inputs: BulkImportProductInput[],
): Promise<IpcResult<{ imported: number }>> {
  return assertDeken().products.bulkImport(inputs)
}

export async function bulkImportCustomers(
  inputs: BulkImportCustomerInput[],
): Promise<IpcResult<{ imported: number }>> {
  return assertDeken().customers.bulkImport(inputs)
}

export async function bulkImportCategories(
  inputs: BulkImportCategoryInput[],
): Promise<IpcResult<{ imported: number }>> {
  return assertDeken().categories.bulkImport(inputs)
}

export async function bulkImportSizes(
  inputs: BulkImportSizeInput[],
): Promise<IpcResult<{ imported: number }>> {
  return assertDeken().categorySizes.bulkImport(inputs)
}

export async function bulkImportFlavors(
  inputs: BulkImportFlavorInput[],
): Promise<IpcResult<{ imported: number }>> {
  return assertDeken().categoryFlavors.bulkImport(inputs)
}
