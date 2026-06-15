import axios, { AxiosError } from 'axios'

export interface GitHubRepoInfo {
  name: string
  owner: string
  url: string
  defaultBranch: string
  description?: string
  topics?: string[]
}

export interface ValidationResult {
  isValid: boolean
  message: string
  details?: Record<string, unknown>
}

export class GitHubIntegrationService {
  private readonly apiBaseUrl = 'https://api.github.com'

  async validateToken(token: string): Promise<ValidationResult> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/user`, {
        headers: {
          Authorization: `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      })

      return {
        isValid: true,
        message: 'GitHub token is valid',
        details: {
          login: response.data.login,
          id: response.data.id,
          scopes: response.headers['x-oauth-scopes']?.split(', ') || [],
        },
      }
    } catch (error) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 401) {
        return {
          isValid: false,
          message: 'Invalid or expired GitHub token',
          details: { status: 401 },
        }
      }

      return {
        isValid: false,
        message: 'Failed to validate GitHub token',
        details: {
          error: axiosError.message,
          status: axiosError.response?.status,
        },
      }
    }
  }

  async getRepositoryInfo(owner: string, repo: string, token: string): Promise<GitHubRepoInfo> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      })

      return {
        name: response.data.name,
        owner: response.data.owner.login,
        url: response.data.html_url,
        defaultBranch: response.data.default_branch,
        description: response.data.description,
        topics: response.data.topics || [],
      }
    } catch (error) {
      const axiosError = error as AxiosError
      console.error('[GitHubService] Error fetching repository:', axiosError.message)
      throw new Error(
        axiosError.response?.status === 404
          ? `Repository not found: ${owner}/${repo}`
          : `Failed to fetch repository info: ${axiosError.message}`
      )
    }
  }

  async verifyBranch(owner: string, repo: string, branch: string, token: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
        {
          headers: {
            Authorization: `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        }
      )

      return response.status === 200
    } catch (error) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 404) {
        return false
      }

      throw new Error(`Failed to verify branch: ${axiosError.message}`)
    }
  }

  parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
    try {
      // Support formats: https://github.com/owner/repo, git@github.com:owner/repo.git, etc.
      const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/)
      if (httpsMatch) {
        return {
          owner: httpsMatch[1],
          repo: httpsMatch[2],
        }
      }

      const sshMatch = url.match(/github\.com[:/]([^\/]+)\/([^\/]+?)(\.git)?$/)
      if (sshMatch) {
        return {
          owner: sshMatch[1],
          repo: sshMatch[2],
        }
      }

      return null
    } catch (error) {
      console.error('[GitHubService] Error parsing URL:', error)
      return null
    }
  }
}

export const githubService = new GitHubIntegrationService()
