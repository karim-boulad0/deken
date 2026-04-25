/// <reference types="vite/client" />

import type {
  AppSettingsDto,
  CategoryDto,
  CompleteCashSaleResult,
  CompleteDebtSaleInput,
  CreateCategoryInput,
  CreateCustomerInput,
  CreateProductInput,
  CustomerBalanceRow,
  CustomerDto,
  CustomerLedgerLineDto,
  DashboardSnapshotDto,
  IpcResult,
  RecordDebtPaymentInput,
  RecordDebtPaymentResult,
  PosSaleLineInput,
  ProductDto,
  UpdateAppSettingsInput,
  UpdateCategoryInput,
  UpdateProductInput,
  SalesReportDto,
  SalesReportInput,
} from '../../shared/ipc/types'

type DekenPreload = {
  getAppVersion: () => Promise<IpcResult<string>>
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
  }
  reports: {
    getSales: (r: SalesReportInput) => Promise<IpcResult<SalesReportDto>>
  }
  settings: {
    get: () => Promise<IpcResult<AppSettingsDto>>
    set: (input: UpdateAppSettingsInput) => Promise<IpcResult<AppSettingsDto>>
  }
  dashboard: {
    getSnapshot: () => Promise<IpcResult<DashboardSnapshotDto>>
  }
}

declare global {
  interface Window {
    deken: DekenPreload
  }
}

export {}
