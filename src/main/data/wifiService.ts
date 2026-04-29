import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { IpcResult, WifiCredentialDto } from '../../shared/ipc/types'

const execFileAsync = promisify(execFile)

function extractSsid(text: string): string | null {
  const m = text.match(/^\s*SSID\s*:\s*(.+)$/im)
  if (!m) return null
  return m[1].trim() || null
}

function extractPassword(text: string): string | null {
  const m = text.match(/^\s*Key Content\s*:\s*(.*)$/im)
  if (!m) return null
  const value = m[1].trim()
  return value.length > 0 ? value : null
}

export async function getCurrentWifiCredential(): Promise<IpcResult<WifiCredentialDto>> {
  if (process.platform !== 'win32') {
    return { ok: false, error: { code: 'unsupported_platform', message: 'unsupported_platform' } }
  }

  try {
    const { stdout: interfacesStdout } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'])
    const ssid = extractSsid(interfacesStdout)
    if (!ssid) {
      return { ok: false, error: { code: 'wifi_not_connected', message: 'wifi_not_connected' } }
    }

    const { stdout: profileStdout } = await execFileAsync('netsh', [
      'wlan',
      'show',
      'profile',
      `name=${ssid}`,
      'key=clear',
    ])

    return {
      ok: true,
      data: {
        ssid,
        password: extractPassword(profileStdout),
      },
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    return { ok: false, error: { code: 'internal_error', message: 'wifi_lookup_failed', details } }
  }
}
