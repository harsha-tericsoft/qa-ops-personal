import { prisma } from '@/lib/prisma'
import { CodeRepository, CodeRepositoryCredential, CodeRepositoryConnectionTest, RepositoryType, RepositoryPurpose, ConnectionStatus } from '@prisma/client'

export interface CreateCodeRepositoryInput {
  projectId: string
  repositoryName: string
  repositoryUrl: string
  repositoryType: RepositoryType
  repositoryPurpose?: RepositoryPurpose
  branch?: string
  description?: string
  tags?: string[]
  createdBy?: string
}

export interface UpdateCodeRepositoryInput {
  branch?: string
  description?: string
  repositoryPurpose?: RepositoryPurpose
  tags?: string[]
  isActive?: boolean
}

export interface CodeRepositoryDTO extends CodeRepository {
  credentials?: CodeRepositoryCredential[]
  connectionTests?: CodeRepositoryConnectionTest[]
}

export class CodeRepositoryService {
  async createRepository(input: CreateCodeRepositoryInput): Promise<CodeRepositoryDTO> {
    try {
      const repository = await prisma.codeRepository.create({
        data: {
          projectId: input.projectId,
          repositoryName: input.repositoryName,
          repositoryUrl: input.repositoryUrl,
          repositoryType: input.repositoryType,
          repositoryPurpose: input.repositoryPurpose || RepositoryPurpose.PRIMARY,
          branch: input.branch || 'main',
          description: input.description,
          tags: input.tags || [],
          createdBy: input.createdBy,
        },
        include: {
          credentials: true,
          connectionTests: true,
        },
      })

      return repository as CodeRepositoryDTO
    } catch (error) {
      console.error('[CodeRepositoryService] Error creating repository:', error)
      throw error
    }
  }

  async getRepository(id: string): Promise<CodeRepositoryDTO | null> {
    try {
      const repository = await prisma.codeRepository.findUnique({
        where: { id },
        include: {
          credentials: {
            where: { isActive: true },
          },
          connectionTests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })

      return repository as CodeRepositoryDTO | null
    } catch (error) {
      console.error('[CodeRepositoryService] Error getting repository:', error)
      throw error
    }
  }

  async listRepositories(projectId: string, filters?: { status?: string; type?: string }): Promise<CodeRepositoryDTO[]> {
    try {
      const where: Record<string, unknown> = {
        projectId,
        isActive: true,
      }

      if (filters?.status) {
        where.connectionStatus = filters.status
      }

      if (filters?.type) {
        where.repositoryType = filters.type
      }

      const repositories = await prisma.codeRepository.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          credentials: {
            where: { isActive: true },
            select: {
              id: true,
              credentialType: true,
              isActive: true,
              expiresAt: true,
            },
          },
          connectionTests: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      return repositories as CodeRepositoryDTO[]
    } catch (error) {
      console.error('[CodeRepositoryService] Error listing repositories:', error)
      throw error
    }
  }

  async updateRepository(id: string, input: UpdateCodeRepositoryInput): Promise<CodeRepositoryDTO> {
    try {
      const repository = await prisma.codeRepository.update({
        where: { id },
        data: input,
        include: {
          credentials: true,
          connectionTests: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      })

      return repository as CodeRepositoryDTO
    } catch (error) {
      console.error('[CodeRepositoryService] Error updating repository:', error)
      throw error
    }
  }

  async deleteRepository(id: string): Promise<CodeRepositoryDTO> {
    try {
      const repository = await prisma.codeRepository.update({
        where: { id },
        data: {
          isActive: false,
        },
        include: {
          credentials: true,
          connectionTests: true,
        },
      })

      // Also deactivate credentials
      await prisma.codeRepositoryCredential.updateMany({
        where: { codeRepositoryId: id },
        data: { isActive: false },
      })

      return repository as CodeRepositoryDTO
    } catch (error) {
      console.error('[CodeRepositoryService] Error deleting repository:', error)
      throw error
    }
  }

  async checkDuplicateUrl(projectId: string, repositoryUrl: string, excludeId?: string): Promise<boolean> {
    try {
      const where: Record<string, unknown> = {
        projectId,
        repositoryUrl,
        isActive: true,
      }

      if (excludeId) {
        where.NOT = {
          id: excludeId,
        }
      }

      const existing = await prisma.codeRepository.findFirst({ where })
      return !!existing
    } catch (error) {
      console.error('[CodeRepositoryService] Error checking duplicate URL:', error)
      throw error
    }
  }

  async updateConnectionStatus(
    id: string,
    status: ConnectionStatus | string,
    error?: string
  ): Promise<CodeRepositoryDTO> {
    try {
      const repository = await prisma.codeRepository.update({
        where: { id },
        data: {
          connectionStatus: status as ConnectionStatus,
          lastConnectionTestAt: new Date(),
          lastConnectionTestError: error || null,
        },
        include: {
          credentials: true,
          connectionTests: true,
        },
      })

      return repository as CodeRepositoryDTO
    } catch (error) {
      console.error('[CodeRepositoryService] Error updating connection status:', error)
      throw error
    }
  }
}

export const codeRepositoryService = new CodeRepositoryService()
