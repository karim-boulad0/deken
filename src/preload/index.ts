import { contextBridge, ipcRenderer } from 'electron'
import { IpcInvokes } from '../shared/ipc/types'
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
} from '../shared/ipc/types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>
}

contextBridge.exposeInMainWorld('deken', {
  getAppVersion: (): Promise<IpcResult<string>> => {
    return invoke(IpcInvokes.getAppVersion)
  },
  products: {
    list: (q: string, filterCategoryId?: string | null): Promise<IpcResult<ProductDto[]>> => {
      return invoke(IpcInvokes.listProducts, q, filterCategoryId ?? null)
    },
    create: (input: CreateProductInput): Promise<IpcResult<ProductDto>> => {
      return invoke(IpcInvokes.createProduct, input)
    },
    update: (id: string, input: UpdateProductInput): Promise<IpcResult<ProductDto>> => {
      return invoke(IpcInvokes.updateProduct, id, input)
    },
    findByCode: (code: string): Promise<IpcResult<ProductDto | null>> => {
      return invoke(IpcInvokes.findProductByCode, code)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteProduct, id)
    },
  },
  categories: {
    list: (): Promise<IpcResult<CategoryDto[]>> => {
      return invoke(IpcInvokes.listCategories)
    },
    create: (input: CreateCategoryInput): Promise<IpcResult<CategoryDto>> => {
      return invoke(IpcInvokes.createCategory, input)
    },
    update: (id: string, input: UpdateCategoryInput): Promise<IpcResult<CategoryDto>> => {
      return invoke(IpcInvokes.updateCategory, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteCategory, id)
    },
  },
  sales: {
    completeCash: (lines: PosSaleLineInput[]): Promise<IpcResult<CompleteCashSaleResult>> => {
      return invoke(IpcInvokes.completeCashSale, lines)
    },
  },
})
