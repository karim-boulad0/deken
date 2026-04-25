/// <reference types="vite/client" />

import type {
  AppSettingsDto,
  AuthLoginInput,
  AuthSessionDto,
  ActivationStatusDto,
  CashflowLineDto,
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
  RecordDebtPaymentInput,
  RecordDebtPaymentResult,
  SaleLineViewDto,
  PosSaleLineInput,
  ProductDto,
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
  UpdateSupplierInput,
  VerifyActivationInput,
  SalesReportDto,
  SalesReportInput,
  CreateUserInput,
  SetUserPermissionsInput,
  ResetUserCredentialsInput,
  UpdateUserInput,
  UserWithPermissionsDto,
} from '../../shared/ipc/types'

type DekenPreload = {
  getAppVersion: () => Promise<IpcResult<string>>
  auth: {
    getSession: () => Promise<IpcResult<AuthSessionDto | null>>
    login: (input: AuthLoginInput) => Promise<IpcResult<AuthSessionDto>>
    logout: () => Promise<IpcResult<null>>
  }
  users: {
    list: () => Promise<IpcResult<UserWithPermissionsDto[]>>
    create: (input: CreateUserInput) => Promise<IpcResult<UserWithPermissionsDto>>
    update: (id: string, input: UpdateUserInput) => Promise<IpcResult<UserWithPermissionsDto>>
    setPermissions: (
      id: string,
      input: SetUserPermissionsInput,
    ) => Promise<IpcResult<UserWithPermissionsDto>>
    resetCredentials: (
      id: string,
      input: ResetUserCredentialsInput,
    ) => Promise<IpcResult<UserWithPermissionsDto>>
    delete: (id: string) => Promise<IpcResult<null>>
  }
  activation: {
    status: () => Promise<IpcResult<ActivationStatusDto>>
    verify: (input: VerifyActivationInput) => Promise<IpcResult<ActivationStatusDto>>
  }
  products: {
    list: (q: string, filterCategoryId?: string | null) => Promise<IpcResult<ProductDto[]>>
    create: (input: CreateProductInput) => Promise<IpcResult<ProductDto>>
    update: (id: string, input: UpdateProductInput) => Promise<IpcResult<ProductDto>>
    delete: (id: string) => Promise<IpcResult<null>>
    findByCode: (code: string) => Promise<IpcResult<ProductDto | null>>
  }
  categories: {
    list: () => Promise<IpcResult<CategoryDto[]>>
    create: (input: CreateCategoryInput) => Promise<IpcResult<CategoryDto>>
    update: (id: string, input: UpdateCategoryInput) => Promise<IpcResult<CategoryDto>>
    delete: (id: string) => Promise<IpcResult<null>>
  }
  categorySizes: {
    list: () => Promise<IpcResult<CategorySizeDto[]>>
    create: (input: CreateCategorySizeInput) => Promise<IpcResult<CategorySizeDto>>
    update: (id: string, input: UpdateCategorySizeInput) => Promise<IpcResult<CategorySizeDto>>
    delete: (id: string) => Promise<IpcResult<null>>
  }
  categoryFlavors: {
    list: () => Promise<IpcResult<CategoryFlavorDto[]>>
    create: (input: CreateCategoryFlavorInput) => Promise<IpcResult<CategoryFlavorDto>>
    update: (id: string, input: UpdateCategoryFlavorInput) => Promise<IpcResult<CategoryFlavorDto>>
    delete: (id: string) => Promise<IpcResult<null>>
  }
  customers: {
    list: () => Promise<IpcResult<CustomerDto[]>>
    listBalances: () => Promise<IpcResult<CustomerBalanceRow[]>>
    getLedger: (customerId: string) => Promise<IpcResult<CustomerLedgerLineDto[]>>
    create: (input: CreateCustomerInput) => Promise<IpcResult<CustomerDto>>
  }
  debt: {
    recordPayment: (input: RecordDebtPaymentInput) => Promise<IpcResult<RecordDebtPaymentResult>>
  }
  sales: {
    completeCash: (lines: PosSaleLineInput[]) => Promise<IpcResult<CompleteCashSaleResult>>
    completeDebt: (input: CompleteDebtSaleInput) => Promise<IpcResult<CompleteCashSaleResult>>
    getDebtSaleLines: (customerId: string, saleId: string) => Promise<IpcResult<SaleLineViewDto[]>>
    voidCash: (saleId: string) => Promise<IpcResult<{ saleId: string }>>
  }
  reports: {
    getSales: (r: SalesReportInput) => Promise<IpcResult<SalesReportDto>>
  }
  settings: {
    get: () => Promise<IpcResult<AppSettingsDto>>
    set: (input: UpdateAppSettingsInput) => Promise<IpcResult<AppSettingsDto>>
  }
  dashboard: {
    getSnapshot: (input?: DashboardSnapshotInput) => Promise<IpcResult<DashboardSnapshotDto>>
  }
  suppliers: {
    listBalances: () => Promise<IpcResult<SupplierBalanceRow[]>>
    create: (input: CreateSupplierInput) => Promise<IpcResult<SupplierDto>>
    update: (id: string, input: UpdateSupplierInput) => Promise<IpcResult<SupplierDto>>
    delete: (id: string) => Promise<IpcResult<null>>
    listInvoices: (supplierId: string) => Promise<IpcResult<SupplierInvoiceDto[]>>
    listPayments: (supplierId: string) => Promise<IpcResult<SupplierPaymentDto[]>>
    createInvoice: (input: CreateSupplierInvoiceInput) => Promise<IpcResult<SupplierInvoiceDto>>
    createPayment: (input: CreateSupplierPaymentInput) => Promise<IpcResult<SupplierPaymentDto>>
  }
  expenses: {
    listCategories: () => Promise<IpcResult<ExpenseCategoryDto[]>>
    createCategory: (input: CreateExpenseCategoryInput) => Promise<IpcResult<ExpenseCategoryDto>>
    updateCategory: (id: string, input: UpdateExpenseCategoryInput) => Promise<IpcResult<ExpenseCategoryDto>>
    deleteCategory: (id: string) => Promise<IpcResult<null>>
    listInRange: (input: ListExpensesInRangeInput) => Promise<IpcResult<ExpenseDto[]>>
    totalInRange: (input: ListExpensesInRangeInput) => Promise<IpcResult<ExpenseTotalInRangeDto>>
    create: (input: CreateExpenseInput) => Promise<IpcResult<ExpenseDto>>
    update: (id: string, input: UpdateExpenseInput) => Promise<IpcResult<ExpenseDto>>
    delete: (id: string) => Promise<IpcResult<null>>
  }
  cashflow: {
    listRecent: (input: ListRecentCashflowInput) => Promise<IpcResult<CashflowLineDto[]>>
  }
}

declare global {
  interface Window {
    deken: DekenPreload
  }
}

export {}
