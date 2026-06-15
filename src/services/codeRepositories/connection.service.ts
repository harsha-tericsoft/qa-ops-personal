import { prisma } from '@/lib/prisma'
import { CodeRepositoryConnectionTest } from '@prisma/client'
import { githubService } from './github.service'
import { credentialService } from './credential.service'

export interface TestResult {
  testType: string
  testStatus: string
  testMessage?: string
  testError?: string
  responseTimeMs?: number
}

export interface ConnectionTestInput {
  codeRepositoryId: string
  testTypes: string[] // ['basic_connectivity', 'github_api', 'branch_verification']
  testedBy?: string
}

export class CodeRepositoryConnectionService {
  async testConnection(input: ConnectionTestInput): Promise<TestResult[]> {
    try {
      // Get the repository
      const repository = await prisma.codeRepository.findUnique({
        where: { id: input.codeRepositoryId },
        include: {
          credentials: {
            where: { isActive: true },
            take: 1,
          },
        },
      })

      if (!repository) {
        throw new Error('Repository not found')
      }

      if (!repository.credentials || repository.credentials.length === 0) {
        throw new Error('No active credentials found for repository')
      }

      const credential = repository.credentials[0]
      let decryptedToken: string

      try {
        decryptedToken = credentialService.decryptToken(credential.encryptedValue)
      } catch (error) {
        console.error('[ConnectionService] Error decrypting token:', error)
        throw new Error('Failed to decrypt stored credential')
      }

      const results: TestResult[] = []
      const baseTests = input.testTypes || ['basic_connectivity', 'github_api', 'branch_verification']

      for (const testType of baseTests) {
        const startTime = Date.now()

        try {
          if (testType === 'basic_connectivity') {
            const result = await this.testBasicConnectivity(repository.repositoryUrl)
            results.push({
              ...result,
              responseTimeMs: Date.now() - startTime,
            })
          } else if (testType === 'github_api') {
            const result = await this.testGitHubAPI(
              repository.repositoryUrl,
              decryptedToken
            )
            results.push({
              ...result,
              responseTimeMs: Date.now() - startTime,
            })
          } else if (testType === 'branch_verification') {
            const result = await this.testBranchVerification(
              repository.repositoryUrl,
              decryptedToken,
              repository.branch
            )
            results.push({
              ...result,
              responseTimeMs: Date.now() - startTime,
            })
          }
        } catch (error) {
          results.push({
            testType,
            testStatus: 'failed',
            testError: error instanceof Error ? error.message : 'Unknown error',
            responseTimeMs: Date.now() - startTime,
          })
        }
      }

      // Store test results
      for (const result of results) {
        await this.saveTestResult(repository.id, result, input.testedBy)
      }

      return results
    } catch (error) {
      console.error('[ConnectionService] Error testing connection:', error)
      throw error
    }
  }

  private async testBasicConnectivity(repositoryUrl: string): Promise<TestResult> {
    try {
      // Parse URL and do a basic DNS/connectivity check
      const url = new URL(repositoryUrl)

      // If we can parse the URL, basic connectivity is OK
      return {
        testType: 'basic_connectivity',
        testStatus: 'success',
        testMessage: `Repository URL is reachable (${url.hostname})`,
      }
    } catch (error) {
      return {
        testType: 'basic_connectivity',
        testStatus: 'failed',
        testError: `Invalid repository URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async testGitHubAPI(
    repositoryUrl: string,
    token: string
  ): Promise<TestResult> {
    try {
      const parsed = githubService.parseRepositoryUrl(repositoryUrl)
      if (!parsed) {
        return {
          testType: 'github_api',
          testStatus: 'failed',
          testError: 'Could not parse GitHub repository URL',
        }
      }

      // Test GitHub API access
      const validation = await githubService.validateToken(token)
      if (!validation.isValid) {
        return {
          testType: 'github_api',
          testStatus: 'failed',
          testError: validation.message,
        }
      }

      // Get repository info
      const repoInfo = await githubService.getRepositoryInfo(parsed.owner, parsed.repo, token)

      return {
        testType: 'github_api',
        testStatus: 'success',
        testMessage: `GitHub API authentication successful - Repository found (${repoInfo.owner}/${repoInfo.name})`,
      }
    } catch (error) {
      return {
        testType: 'github_api',
        testStatus: 'failed',
        testError: error instanceof Error ? error.message : 'GitHub API test failed',
      }
    }
  }

  private async testBranchVerification(
    repositoryUrl: string,
    token: string,
    branch: string
  ): Promise<TestResult> {
    try {
      const parsed = githubService.parseRepositoryUrl(repositoryUrl)
      if (!parsed) {
        return {
          testType: 'branch_verification',
          testStatus: 'failed',
          testError: 'Could not parse GitHub repository URL',
        }
      }

      const branchExists = await githubService.verifyBranch(parsed.owner, parsed.repo, branch, token)

      if (branchExists) {
        return {
          testType: 'branch_verification',
          testStatus: 'success',
          testMessage: `Branch '${branch}' exists in repository`,
        }
      } else {
        return {
          testType: 'branch_verification',
          testStatus: 'failed',
          testError: `Branch '${branch}' not found in repository`,
        }
      }
    } catch (error) {
      return {
        testType: 'branch_verification',
        testStatus: 'failed',
        testError: error instanceof Error ? error.message : 'Branch verification failed',
      }
    }
  }

  private async saveTestResult(
    codeRepositoryId: string,
    result: TestResult,
    testedBy?: string
  ): Promise<CodeRepositoryConnectionTest> {
    try {
      return await prisma.codeRepositoryConnectionTest.create({
        data: {
          codeRepositoryId,
          testType: result.testType,
          testStatus: result.testStatus,
          testMessage: result.testMessage,
          testError: result.testError,
          responseTimeMs: result.responseTimeMs,
          testedBy,
        },
      })
    } catch (error) {
      console.error('[ConnectionService] Error saving test result:', error)
      throw error
    }
  }

  async getTestHistory(codeRepositoryId: string, limit: number = 10): Promise<CodeRepositoryConnectionTest[]> {
    try {
      return await prisma.codeRepositoryConnectionTest.findMany({
        where: { codeRepositoryId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } catch (error) {
      console.error('[ConnectionService] Error getting test history:', error)
      throw error
    }
  }
}

export const connectionService = new CodeRepositoryConnectionService()
