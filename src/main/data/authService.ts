import { createHash } from 'node:crypto'
import { PermissionModules } from '../../shared/ipc/types'
import type {
  AuthLoginInput,
  AuthSessionDto,
  IpcErrorShape,
  IpcResult,
  PermissionModule,
  UserDto,
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

type CredRow = {
  password_hash: string | null
  password_salt: string | null
  pin_hash: string | null
  pin_salt: string | null
}

type PermRow = { module_key: PermissionModule }

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (
      m === 'invalid_credentials' ||
      m === 'username_required' ||
      m === 'password_or_pin_required' ||
      m === 'inactive_user'
    ) {
      return { ok: false, error: makeError('validation', m) }
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

function getPermissions(db: Database, userId: string, isSystemAdmin: boolean): PermissionModule[] {
  if (isSystemAdmin) {
    return [...PermissionModules]
  }
  const rows = db
    .prepare('SELECT module_key FROM user_permissions WHERE user_id = ? ORDER BY module_key')
    .all(userId) as PermRow[]
  return rows.map((r) => r.module_key)
}

function resolveSession(db: Database): AuthSessionDto | null {
  const row = db
    .prepare(
      `SELECT u.*
       FROM app_session s
       JOIN users u ON u.id = s.current_user_id
       WHERE s.id = 1`,
    )
    .get() as UserRow | undefined
  if (!row || row.is_active !== 1) {
    return null
  }
  const user = rowToUserDto(row)
  return { user, permissions: getPermissions(db, user.id, user.isSystemAdmin) }
}

export function getAuthSession(db: Database): IpcResult<AuthSessionDto | null> {
  return asResult(() => resolveSession(db))
}

export function login(db: Database, input: AuthLoginInput): IpcResult<AuthSessionDto> {
  return asResult(() => {
    const username = String(input.username ?? '').trim().toLowerCase()
    if (!username) {
      throw new Error('username_required')
    }
    const password = typeof input.password === 'string' ? input.password.trim() : ''
    const pin = typeof input.pin === 'string' ? input.pin.trim() : ''
    if (!password && !pin) {
      throw new Error('password_or_pin_required')
    }

    const user = db
      .prepare('SELECT * FROM users WHERE lower(username) = ? LIMIT 1')
      .get(username) as UserRow | undefined
    if (!user) {
      throw new Error('invalid_credentials')
    }
    if (user.is_active !== 1) {
      throw new Error('inactive_user')
    }
    const cred = db
      .prepare('SELECT password_hash, password_salt, pin_hash, pin_salt FROM user_credentials WHERE user_id = ?')
      .get(user.id) as CredRow | undefined
    if (!cred) {
      throw new Error('invalid_credentials')
    }

    const passwordMatch =
      password &&
      cred.password_hash &&
      cred.password_salt &&
      hashSecret(cred.password_salt, password) === cred.password_hash
    const pinMatch = pin && cred.pin_hash && cred.pin_salt && hashSecret(cred.pin_salt, pin) === cred.pin_hash
    if (!passwordMatch && !pinMatch) {
      throw new Error('invalid_credentials')
    }

    db.prepare('UPDATE app_session SET current_user_id = ?, updated_at = ? WHERE id = 1').run(
      user.id,
      new Date().toISOString(),
    )
    const session = resolveSession(db)
    if (!session) {
      throw new Error('invalid_credentials')
    }
    return session
  })
}

export function logout(db: Database): IpcResult<null> {
  return asResult(() => {
    db.prepare('UPDATE app_session SET current_user_id = NULL, updated_at = ? WHERE id = 1').run(
      new Date().toISOString(),
    )
    return null
  })
}

export function requireModulePermission(db: Database, moduleKey: PermissionModule): IpcResult<AuthSessionDto> {
  const session = resolveSession(db)
  if (!session) {
    return { ok: false, error: makeError('unauthorized', 'unauthorized') }
  }
  if (!session.permissions.includes(moduleKey)) {
    return { ok: false, error: makeError('forbidden', 'permission_denied') }
  }
  return { ok: true, data: session }
}
