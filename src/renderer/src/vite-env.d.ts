/// <reference types="vite/client" />

import type {
  CategoryDto,
  CompleteCashSaleResult,
  CreateCategoryInput,
  CreateProductInput,
  IpcResult,
  PosSaleLineInput,
  ProductDto,
  UpdateCategoryInput,
  UpdateProductInput,
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
  sales: {
    completeCash: (lines: PosSaleLineInput[]) => Promise<IpcResult<CompleteCashSaleResult>>
  }
}

declare global {
  interface Window {
    deken: DekenPreload
  }
}

export {}
