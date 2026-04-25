import { createHash, randomUUID } from 'node:crypto'
import { PermissionModules } from '../../shared/ipc/types'
import type {
  CreateUserInput,
  IpcErrorShape,
  IpcResult,
  PermissionModule,
  ResetUserCredentialsInput,
  SetUserPermissionsInput,
  UpdateUserInput,
  UserDto,
  UserWithPermissionsDto,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

type UserRow = {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'employee'
  is_system_admin: number
  is_active: number
  created_at: string
  updated_at: string
}

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (
      m === 'username_required' ||
      m === 'full_name_required' ||
      m === 'role_invalid' ||
      m === 'password_or_pin_required' ||
      m === 'credentials_required' ||
      m === 'system_admin_immutable' ||
      m === 'not_found'
    ) {
      return { ok: false, error: makeError('validation', m) }
    }
    if (m.toLowerCase().includes('unique')) {
      return { ok: false, error: makeError('unique_violation', 'username_taken') }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

function hashSecret(salt: string, secret: string): string {
  return createHash('sha256')
    .update(`${salt}:${secret}`)
    .digest('hex')
}

function rowToUserDto(r: UserRow): UserDto {
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    isSystemAdmin: r.is_system_admin === 1,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function normalizeModuleList(modules: PermissionModule[]): PermissionModule[] {
  const allowed = new Set(PermissionModules)
  const uniq = new Set<PermissionModule>()
  for (const m of modules) {
    if (allowed.has(m)) {
      uniq.add(m)
    }
  }
  return [...uniq].sort()
}

function setUserPermissionsInternal(db: Database, userId: string, permissions: PermissionModule[]): void {
  const now = new Date().toISOString()
  const del = db.prepare('DELETE FROM user_permissions WHERE user_id = ?')
  const ins = db.prepare(
    'INSERT INTO user_permissions (user_id, module_key, created_at) VALUES (@userId, @moduleKey, @createdAt)',
  )
  const tx = db.transaction(() => {
    del.run(userId)
    for (const moduleKey of normalizeModuleList(permissions)) {
      ins.run({ userId, moduleKey, createdAt: now })
    }
  })
  tx()
}

function getUserWithPermissions(db: Database, userId: string): UserWithPermissionsDto {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  if (!row) {
    throw new Error('not_found')
  }
  const user = rowToUserDto(row)
  const permissions = user.isSystemAdmin
    ? [...PermissionModules]
    : (db
        .prepare('SELECT module_key FROM user_permissions WHERE user_id = ? ORDER BY module_key')
        .all(user.id) as { module_key: PermissionModule }[]).map((r) => r.module_key)
  return { user, permissions }
}

function ensureMutableUser(row: UserRow | undefined): UserRow {
  if (!row) {
    throw new Error('not_found')
  }
  if (row.is_system_admin === 1) {
    throw new Error('system_admin_immutable')
  }
  return row
}

export function listUsers(db: Database): IpcResult<UserWithPermissionsDto[]> {
  return asResult(() => {
    const rows = db
      .prepare('SELECT * FROM users ORDER BY is_system_admin DESC, username ASC')
      .all() as UserRow[]
    return rows.map((row) => getUserWithPermissions(db, row.id))
  })
}

export function createUser(db: Database, input: CreateUserInput): IpcResult<UserWithPermissionsDto> {
  return asResult(() => {
    const username = String(input.username ?? '').trim().toLowerCase()
    const fullName = String(input.fullName ?? '').trim()
    const role = input.role
    if (!username) {
      throw new Error('username_required')
    }
    if (!fullName) {
      throw new Error('full_name_required')
    }
    if (role !== 'admin' && role !== 'employee') {
      throw new Error('role_invalid')
    }
    const password = typeof input.password === 'string' ? input.password.trim() : ''
    const pin = typeof input.pin === 'string' ? input.pin.trim() : ''
    if (!password && !pin) {
      throw new Error('password_or_pin_required')
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, username, full_name, role, is_system_admin, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
      ).run(id, username, fullName, role, now, now)

      const passSalt = password ? randomUUID() : null
      const pinSalt = pin ? randomUUID() : null
      db.prepare(
        `INSERT INTO user_credentials (user_id, password_hash, password_salt, pin_hash, pin_salt, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        password ? hashSecret(String(passSalt), password) : null,
        passSalt,
        pin ? hashSecret(String(pinSalt), pin) : null,
        pinSalt,
        now,
      )
      setUserPermissionsInternal(db, id, input.permissions ?? [])
    })
    tx()
    return getUserWithPermissions(db, id)
  })
}

export function updateUser(db: Database, id: string, input: UpdateUserInput): IpcResult<UserWithPermissionsDto> {
  return asResult(() => {
    const existing = ensureMutableUser(
      db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined,
    )
    const username =
      input.username !== undefined ? String(input.username).trim().toLowerCase() : existing.username
    const fullName = input.fullName !== undefined ? String(input.fullName).trim() : existing.full_name
    const role = input.role !== undefined ? input.role : existing.role
    const isActive =
      input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active
    if (!username) {
      throw new Error('username_required')
    }
    if (!fullName) {
      throw new Error('full_name_required')
    }
    if (role !== 'admin' && role !== 'employee') {
      throw new Error('role_invalid')
    }
    db.prepare(
      `UPDATE users
       SET username = ?, full_name = ?, role = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
    ).run(username, fullName, role, isActive, new Date().toISOString(), id)
    return getUserWithPermissions(db, id)
  })
}

export function setUserPermissions(
  db: Database,
  id: string,
  input: SetUserPermissionsInput,
): IpcResult<UserWithPermissionsDto> {
  return asResult(() => {
    ensureMutableUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined)
    setUserPermissionsInternal(db, id, input.permissions ?? [])
    return getUserWithPermissions(db, id)
  })
}

export function resetUserCredentials(
  db: Database,
  id: string,
  input: ResetUserCredentialsInput,
): IpcResult<UserWithPermissionsDto> {
  return asResult(() => {
    ensureMutableUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined)
    const password = typeof input.password === 'string' ? input.password.trim() : ''
    const pin = typeof input.pin === 'string' ? input.pin.trim() : ''
    if (!password && !pin) {
      throw new Error('credentials_required')
    }
    const now = new Date().toISOString()
    const passSalt = password ? randomUUID() : null
    const pinSalt = pin ? randomUUID() : null
    db.prepare(
      `UPDATE user_credentials
       SET password_hash = ?, password_salt = ?, pin_hash = ?, pin_salt = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      password ? hashSecret(String(passSalt), password) : null,
      passSalt,
      pin ? hashSecret(String(pinSalt), pin) : null,
      pinSalt,
      now,
      id,
    )
    return getUserWithPermissions(db, id)
  })
}

export function deleteUser(db: Database, id: string): IpcResult<null> {
  return asResult(() => {
    ensureMutableUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined)
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    db.prepare('UPDATE app_session SET current_user_id = NULL, updated_at = ? WHERE current_user_id = ?').run(
      new Date().toISOString(),
      id,
    )
    return null
  })
}
