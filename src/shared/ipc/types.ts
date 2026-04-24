/** Error payload returned to the renderer for consistent UI handling (e.g. i18n by code). */
export type IpcErrorShape = {
  code: string
  message: string
  details?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcErrorShape }

export type ProductDto = {
  id: string
  sku: string
  barcode: string | null
  name: string
  priceLbp: number
  stock: number
  createdAt: string
  updatedAt: string
}

export type CreateProductInput = {
  sku: string
  barcode?: string
  name: string
  priceLbp: number
  stock: number
}

export type UpdateProductInput = {
  sku?: string
  barcode?: string | null
  name?: string
  priceLbp?: number
  stock?: number
}

export const IpcInvokes = {
  getAppVersion: 'deken:getAppVersion',
  listProducts: 'deken:products:list',
  createProduct: 'deken:products:create',
  updateProduct: 'deken:products:update',
  deleteProduct: 'deken:products:delete',
  findProductByCode: 'deken:products:findByCode',
} as const

export type IpcChannel = (typeof IpcInvokes)[keyof typeof IpcInvokes]
