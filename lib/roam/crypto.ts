import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ROAM_ENCRYPTION_KEY = process.env.ROAM_ENCRYPTION_KEY
if (!ROAM_ENCRYPTION_KEY) {
  throw new Error('ROAM_ENCRYPTION_KEY must be set in environment')
}

const ALGORITHM = 'aes-256-gcm'
const SALT = 'roam-qa-ops-salt' // Fixed salt for deterministic key derivation

// Derive a 32-byte key from the environment variable
function getKey() {
  return scryptSync(ROAM_ENCRYPTION_KEY!, SALT, 32)
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptApiKey(ciphertext: string): string {
  console.log('[crypto.decryptApiKey] Starting decryption')
  console.log('[crypto.decryptApiKey] Ciphertext length:', ciphertext?.length || 0)
  console.log('[crypto.decryptApiKey] Ciphertext type:', typeof ciphertext)
  console.log('[crypto.decryptApiKey] Ciphertext is undefined:', ciphertext === undefined)
  console.log('[crypto.decryptApiKey] Ciphertext is null:', ciphertext === null)

  const key = getKey()
  console.log('[crypto.decryptApiKey] Key derived, length:', key.length)

  try {
    const parts = ciphertext.split(':')
    console.log('[crypto.decryptApiKey] Split parts count:', parts.length)
    console.log('[crypto.decryptApiKey] Part 0 (iv) length:', parts[0]?.length || 0)
    console.log('[crypto.decryptApiKey] Part 1 (authTag) length:', parts[1]?.length || 0)
    console.log('[crypto.decryptApiKey] Part 2 (encrypted) length:', parts[2]?.length || 0)

    const [ivHex, authTagHex, encrypted] = parts

    if (!ivHex || !authTagHex || !encrypted) {
      console.error('[crypto.decryptApiKey] Invalid cipher format - missing parts')
      throw new Error('Invalid cipher format')
    }

    console.log('[crypto.decryptApiKey] Converting hex to buffers...')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    console.log('[crypto.decryptApiKey] IV buffer length:', iv.length)
    console.log('[crypto.decryptApiKey] AuthTag buffer length:', authTag.length)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    console.log('[crypto.decryptApiKey] Decipher created, calling decipher.update...')
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    console.log('[crypto.decryptApiKey] Decryption successful, result length:', decrypted.length)

    return decrypted
  } catch (error) {
    console.error('[crypto.decryptApiKey] ERROR during decryption:')
    console.error('[crypto.decryptApiKey] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[crypto.decryptApiKey] Stack:', error instanceof Error ? error.stack : '')
    throw error
  }
}

// Mask API key for display (show last 4 chars)
export function maskApiKey(key: string): string {
  if (key.length <= 4) return '••••'
  return '••••••••' + key.slice(-4)
}
