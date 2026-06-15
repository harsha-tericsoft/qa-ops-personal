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
  const key = getKey()
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid cipher format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// Mask API key for display (show last 4 chars)
export function maskApiKey(key: string): string {
  if (key.length <= 4) return '••••'
  return '••••••••' + key.slice(-4)
}
