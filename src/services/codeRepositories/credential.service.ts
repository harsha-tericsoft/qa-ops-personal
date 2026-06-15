import { prisma } from '@/lib/prisma'
import { CodeRepositoryCredential } from '@prisma/client'
import crypto from 'crypto'

export interface CreateCredentialInput {
  codeRepositoryId: string
  credentialType: string
  encryptedValue: string
  encryptionKeyId?: string
}

export class CodeRepositoryCredentialService {
  private encryptionAlgorithm = 'aes-256-gcm'
  private encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || ''

  async createCredential(input: CreateCredentialInput): Promise<CodeRepositoryCredential> {
    try {
      // Deactivate any existing credential of this type
      await prisma.codeRepositoryCredential.updateMany({
        where: {
          codeRepositoryId: input.codeRepositoryId,
          credentialType: input.credentialType,
        },
        data: {
          isActive: false,
        },
      })

      // Create new credential
      const credential = await prisma.codeRepositoryCredential.create({
        data: {
          codeRepositoryId: input.codeRepositoryId,
          credentialType: input.credentialType,
          encryptedValue: input.encryptedValue,
          encryptionAlgorithm: this.encryptionAlgorithm,
          encryptionKeyId: input.encryptionKeyId,
          isActive: true,
        },
      })

      return credential
    } catch (error) {
      console.error('[CredentialService] Error creating credential:', error)
      throw error
    }
  }

  async getActiveCredential(
    codeRepositoryId: string,
    credentialType: string
  ): Promise<CodeRepositoryCredential | null> {
    try {
      const credential = await prisma.codeRepositoryCredential.findFirst({
        where: {
          codeRepositoryId,
          credentialType,
          isActive: true,
        },
      })

      return credential
    } catch (error) {
      console.error('[CredentialService] Error getting credential:', error)
      throw error
    }
  }

  async listCredentials(codeRepositoryId: string): Promise<CodeRepositoryCredential[]> {
    try {
      const credentials = await prisma.codeRepositoryCredential.findMany({
        where: {
          codeRepositoryId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return credentials
    } catch (error) {
      console.error('[CredentialService] Error listing credentials:', error)
      throw error
    }
  }

  async revokeCredential(credentialId: string): Promise<CodeRepositoryCredential> {
    try {
      const credential = await prisma.codeRepositoryCredential.update({
        where: { id: credentialId },
        data: {
          isActive: false,
        },
      })

      return credential
    } catch (error) {
      console.error('[CredentialService] Error revoking credential:', error)
      throw error
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    try {
      await prisma.codeRepositoryCredential.delete({
        where: { id: credentialId },
      })
    } catch (error) {
      console.error('[CredentialService] Error deleting credential:', error)
      throw error
    }
  }

  // Simple encryption helper (in production, use proper key management)
  encryptToken(token: string): string {
    try {
      const iv = crypto.randomBytes(16)
      const key = Buffer.from(this.encryptionKey, 'base64')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv) as any

      let encrypted = cipher.update(token, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      const authTag = cipher.getAuthTag()

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
    } catch (error) {
      console.error('[CredentialService] Error encrypting token:', error)
      throw new Error('Failed to encrypt token')
    }
  }

  // Simple decryption helper (in production, use proper key management)
  decryptToken(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':')
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format')
      }

      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const key = Buffer.from(this.encryptionKey, 'base64')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv) as any

      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      console.error('[CredentialService] Error decrypting token:', error)
      throw new Error('Failed to decrypt token')
    }
  }
}

export const credentialService = new CodeRepositoryCredentialService()
