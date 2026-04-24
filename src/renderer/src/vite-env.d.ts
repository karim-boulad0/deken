/// <reference types="vite/client" />

import type {
  CreateProductInput,
  IpcResult,
  ProductDto,
  UpdateProductInput,
} from '../../shared/ipc/types'

type DekenPreload = {
  getAppVersion: () => Promise<IpcResult<string>>
  products: {
    list: (q: string) => Promise<IpcResult<ProductDto[]>>
    create: (input: CreateProductInput) => Promise<IpcResult<ProductDto>>
    update: (id: string, input: UpdateProductInput) => Promise<IpcResult<ProductDto>>
    delete: (id: string) => Promise<IpcResult<null>>
    findByCode: (code: string) => Promise<IpcResult<ProductDto | null>>
  }
}

declare global {
  interface Window {
    deken: DekenPreload
  }
}

export {}
