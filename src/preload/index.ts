import { contextBridge, ipcRenderer } from 'electron'
import { IpcInvokes } from '../shared/ipc/types'
import type {
  CreateProductInput,
  IpcResult,
  ProductDto,
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
    list: (q: string): Promise<IpcResult<ProductDto[]>> => {
      return invoke(IpcInvokes.listProducts, q)
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
})
