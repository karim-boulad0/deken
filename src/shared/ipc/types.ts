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
} as const

export type IpcChannel = (typeof IpcInvokes)[keyof typeof IpcInvokes]
