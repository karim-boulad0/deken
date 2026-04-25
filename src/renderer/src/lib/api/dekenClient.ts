import type {
  CategoryDto,
  CompleteCashSaleResult,
  CompleteDebtSaleInput,
  CreateCategoryInput,
  CreateCustomerInput,
  CreateProductInput,
  CustomerBalanceRow,
  CustomerDto,
  IpcResult,
  PosSaleLineInput,
  ProductDto,
  UpdateCategoryInput,
  UpdateProductInput,
  SalesReportDto,
  SalesReportInput,
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
