'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { showToast } from '@/lib/toast'

interface Project {
  id: string
  name: string
}

interface TestSuite {
  id: string
  name: string
  testCases: any[]
}

interface TestRun {
  id: string
  testCaseId: string
  testCase: { id: string; title: string }
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_EXECUTED'
  executedAt?: string
  executedBy?: string
  durationMs?: number
  comments?: RunComment[]
  jiraLinks?: JiraLink[]
}

interface RunComment {
  id: string
  content: string
  author?: string
  createdAt: string
}

interface JiraLink {
  id: string
  issueKey: string
  issueUrl?: string
  issueType?: string
  summary?: string
  createdAt: string
}

interface ExecutionVersion {
  id: string
  cycleId: string
  versionNumber: number
  buildVersion: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
  releaseNotes?: string
  createdAt: string
  completedAt?: string
  testRuns: TestRun[]
}

interface ExecutionCycle {
  id: string
  name: string
  description?: string
  status: string
  executionNotes?: string
  sourceSuiteId?: string
  sourceSuite?: TestSuite
  testRuns: TestRun[]
  versions?: ExecutionVersion[]
  metrics?: {
    total: number
    pass: number
    fail: number
    blocked: number
    notExecuted: number
  }
}

function ExecutionCyclesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [cycles, setCycles] = useState<ExecutionCycle[]>([])
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [newCycleName, setNewCycleName] = useState('')
  const [newCycleDesc, setNewCycleDesc] = useState('')
  const [selectedSuiteId, setSelectedSuiteId] = useState('')
  const [buildVersion, setBuildVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [versions, setVersions] = useState<ExecutionVersion[]>([])
  const [newComment, setNewComment] = useState('')
  const [newJiraKey, setNewJiraKey] = useState('')
  const [executionNotes, setExecutionNotes] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [expandedTestRunIds, setExpandedTestRunIds] = useState<Set<string>>(new Set())
  const [loadingTestRunIds, setLoadingTestRunIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
          if (data.length > 0) {
            setCurrentProjectId(data[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId && currentProjectId !== 'default-project') {
      fetchCycles()
      fetchSuites()
    }
  }, [currentProjectId])

  useEffect(() => {
    if (selectedCycleId) {
      fetchVersions(selectedCycleId)
    }
  }, [selectedCycleId])

  const fetchCycles = async (useOptimized = false) => {
    setLoading(true)
    try {
      // IMPORTANT: For cycles page, we need FULL data with testRuns!
      // Only use skipTestRuns=true for dashboard dropdown optimization
      // The cycles page needs testRuns to display test cases
      const optimizedParam = useOptimized ? '&skipTestRuns=true' : ''
      console.log('[fetchCycles] Fetching with skipTestRuns:', useOptimized)
      const response = await fetch(`/api/execution-cycles?projectId=${currentProjectId}${optimizedParam}`)
      if (response.ok) {
        const data = await response.json()
        console.log('[fetchCycles] Received', Array.isArray(data) ? data.length : 0, 'cycles')
        if (Array.isArray(data) && data.length > 0) {
          console.log('[fetchCycles] First cycle testRuns count:', data[0].testRuns?.length || 0)
        }
        setCycles(Array.isArray(data) ? data : [])
      } else {
        console.error('[fetchCycles] API error:', response.status)
      }
    } catch (error) {
      console.error('[fetchCycles] Error fetching cycles:', error)
      setCycles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchVersions = async (cycleId: string) => {
    try {
      console.log('[fetchVersions] Loading versions for cycle:', cycleId)
      // Don't use minimal=true here - we need full testRuns data for the detail view
      const response = await fetch(`/api/execution-cycles/${cycleId}/versions`)
      if (response.ok) {
        const data = await response.json()
        console.log('[fetchVersions] Received versions:', data.length)

        if (!Array.isArray(data)) {
          console.error('[fetchVersions] Data is not an array:', data)
          setVersions([])
          return
        }

        // Log first version to verify testRuns are included
        if (data.length > 0) {
          console.log('[fetchVersions] First version testRuns count:', data[0].testRuns?.length || 0)
        }

        setVersions(data)
        if (data.length > 0 && !selectedVersionId) {
          console.log('[fetchVersions] Auto-selecting first version:', data[0].id)
          setSelectedVersionId(data[0].id)
        }
      } else {
        console.error('[fetchVersions] API error:', response.status)
        const errorData = await response.json()
        console.error('[fetchVersions] Error details:', errorData)
      }
    } catch (error) {
      console.error('[fetchVersions] Error:', error)
    }
  }

  const fetchSuites = async () => {
    try {
      const response = await fetch(`/api/test-suites?projectId=${currentProjectId}`)
      if (response.ok) {
        const data = await response.json()
        setSuites(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching suites:', error)
      setSuites([])
    }
  }

  const handleCreateCycle = async () => {
    if (!newCycleName.trim() || !selectedSuiteId) return

    const selectedSuite = suites.find((s) => s.id === selectedSuiteId)
    if (!selectedSuite) return

    try {
      const response = await fetch(`/api/execution-cycles?projectId=${currentProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCycleName,
          description: newCycleDesc,
          testCaseIds: selectedSuite.testCases.map((tc) => tc.testCaseId || tc.id),
        }),
      })

      if (response.ok) {
        const newCycle = await response.json()
        setNewCycleName('')
        setNewCycleDesc('')
        setSelectedSuiteId('')
        setShowCreateModal(false)
        await fetchCycles()
        setSelectedCycleId(newCycle.id)
        setBuildVersion('')
        setReleaseNotes('')
      }
    } catch (error) {
      console.error('Error creating cycle:', error)
    }
  }

  const handleCreateVersion = async () => {
    if (!selectedCycleId || !buildVersion.trim()) {
      showToast('Build version is required', 'error')
      return
    }

    setIsSavingVersion(true)
    try {
      const response = await fetch(`/api/execution-cycles/${selectedCycleId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildVersion: buildVersion.trim(),
          releaseNotes: releaseNotes.trim() || undefined,
        }),
      })

      if (response.ok) {
        const newVersion = await response.json()
        setBuildVersion('')
        setReleaseNotes('')
        // Fetch versions first to ensure new version is in the list
        const versionsResponse = await fetch(`/api/execution-cycles/${selectedCycleId}/versions`)
        if (versionsResponse.ok) {
          const allVersions = await versionsResponse.json()
          setVersions(Array.isArray(allVersions) ? allVersions : [])
          // NOW set the selected version so it's found in the updated list
          setSelectedVersionId(newVersion.id)
        } else {
          // Fallback to old fetch method if direct fetch fails
          await fetchVersions(selectedCycleId)
          setSelectedVersionId(newVersion.id)
        }
        setLastSavedAt(new Date())
        showToast('Version created - Active version auto-selected', 'success')

      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to create version', 'error')
      }
    } catch (error) {
      showToast('Error creating version', 'error')
      console.error('Error creating version:', error)
    } finally {
      setIsSavingVersion(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedVersionId) return

    try {
      const response = await fetch(
        `/api/execution-cycles/${selectedCycleId}/versions/${selectedVersionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        }
      )

      if (response.ok) {
        await fetchVersions(selectedCycleId!)
        setLastSavedAt(new Date())
        showToast('All changes saved', 'success')
      }
    } catch (error) {
      showToast('Error saving draft', 'error')
      console.error('Error saving draft:', error)
    }
  }

  const handleCompleteExecution = async () => {
    if (!selectedVersionId) return

    try {
      const response = await fetch(
        `/api/execution-cycles/${selectedCycleId}/versions/${selectedVersionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        }
      )

      if (response.ok) {
        await fetchVersions(selectedCycleId!)
        setLastSavedAt(new Date())
        showToast('Execution completed - All changes saved', 'success')
      }
    } catch (error) {
      showToast('Error completing execution', 'error')
      console.error('Error completing execution:', error)
    }
  }

  const handleRunStatusChange = async (runId: string, newStatus: string) => {
    try {
      // Find the current status before making changes (needed for reverting on error)
      let currentStatus = 'NOT_EXECUTED'
      for (const v of versions) {
        const run = v.testRuns?.find((r) => r.id === runId)
        if (run) {
          currentStatus = run.status
          break
        }
      }
      if (!currentStatus) {
        for (const c of cycles) {
          const run = c.testRuns?.find((r) => r.id === runId)
          if (run) {
            currentStatus = run.status
            break
          }
        }
      }

      // Optimistic update: Update local state immediately
      const updatedVersions = versions.map((v) => ({
        ...v,
        testRuns: (v.testRuns || []).map((run) =>
          run.id === runId ? { ...run, status: newStatus as any } : run
        ),
      }))
      setVersions(updatedVersions)

      // Optimistic update: ALWAYS update cycles to keep the list in sync
      const updatedCycles = cycles.map((c) =>
        c.id === selectedCycleId
          ? {
              ...c,
              testRuns: (c.testRuns || []).map((run) =>
                run.id === runId ? { ...run, status: newStatus as any } : run
              ),
            }
          : c
      )
      setCycles(updatedCycles as any)

      // Update UI immediately
      setLastSavedAt(new Date())

      // Send to server
      const response = await fetch(`/api/test-runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        // API confirmed - get the updated test run from response
        const updatedRun = await response.json()

        // Update versions with API response data
        const newVersions = versions.map((v) => ({
          ...v,
          testRuns: (v.testRuns || []).map((run) =>
            run.id === runId ? updatedRun : run
          ),
        }))
        setVersions(newVersions)

        // Update cycles with API response data
        const newCycles = cycles.map((c) =>
          c.id === selectedCycleId
            ? {
                ...c,
                testRuns: (c.testRuns || []).map((run) =>
                  run.id === runId ? updatedRun : run
                ),
              }
            : c
        )
        setCycles(newCycles as any)
      } else {
        // If API fails, revert optimistic update to original status
        const revertVersions = versions.map((v) => ({
          ...v,
          testRuns: (v.testRuns || []).map((run) =>
            run.id === runId ? { ...run, status: currentStatus as any } : run
          ),
        }))
        setVersions(revertVersions)

        const revertCycles = cycles.map((c) =>
          c.id === selectedCycleId
            ? {
                ...c,
                testRuns: (c.testRuns || []).map((run) =>
                  run.id === runId ? { ...run, status: currentStatus as any } : run
                ),
              }
            : c
        )
        setCycles(revertCycles as any)

        console.error('Error updating run status:', await response.json())
        showToast('Failed to update test run status', 'error')
      }
    } catch (error) {
      // If error, revert optimistic update
      showToast('Error updating test run status', 'error')
      console.error('Error updating run status:', error)
      // Refetch data to ensure consistency
      if (selectedCycleId && selectedVersionId) {
        fetchVersions(selectedCycleId)
      }
    }
  }

  const handleAddComment = async (runId: string) => {
    if (!newComment.trim()) return

    try {
      const commentText = newComment
      const commentAuthor = user?.email || 'Unknown'

      // Optimistic update: Add comment to local state
      const updatedVersions = versions.map((v) => ({
        ...v,
        testRuns: v.testRuns.map((run) =>
          run.id === runId
            ? {
                ...run,
                comments: [
                  ...(run.comments || []),
                  {
                    id: `temp-${Date.now()}`,
                    content: commentText,
                    author: commentAuthor,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : run
        ),
      }))
      setVersions(updatedVersions)

      // Optimistic update: Also update cycle if no version selected
      if (!selectedVersionId) {
        const updatedCycles = cycles.map((c) =>
          c.id === selectedCycleId
            ? {
                ...c,
                testRuns: c.testRuns.map((run) =>
                  run.id === runId
                    ? {
                        ...run,
                        comments: [
                          ...(run.comments || []),
                          {
                            id: `temp-${Date.now()}`,
                            content: commentText,
                            author: commentAuthor,
                            createdAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : run
                ),
              }
            : c
        )
        setCycles(updatedCycles)
      }

      setNewComment('')
      setLastSavedAt(new Date())

      // Send to server
      const response = await fetch(`/api/test-runs/${runId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          author: commentAuthor,
        }),
      })

      if (response.ok) {
        // API confirmed - fetch latest data to ensure sync
        if (selectedVersionId) {
          await fetchVersions(selectedCycleId!)
        } else {
          await fetchCycles()
        }
        showToast('Comment added - All changes saved', 'success')
      } else {
        // If API fails, revert optimistic update
        setVersions(versions)
        setCycles(cycles)
        setNewComment(commentText)
        showToast('Failed to add comment', 'error')
      }
    } catch (error) {
      showToast('Failed to add comment', 'error')
      console.error('Error adding comment:', error)
    }
  }

  const handleAddJiraLink = async (runId: string) => {
    if (!newJiraKey.trim()) return

    try {
      const issueKey = newJiraKey

      // Optimistic update: Add Jira link to local state
      const updatedVersions = versions.map((v) => ({
        ...v,
        testRuns: v.testRuns.map((run) =>
          run.id === runId
            ? {
                ...run,
                jiraLinks: [
                  ...(run.jiraLinks || []),
                  {
                    id: `temp-${Date.now()}`,
                    issueKey: issueKey,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : run
        ),
      }))
      setVersions(updatedVersions)

      // Optimistic update: Also update cycle if no version selected
      if (!selectedVersionId) {
        const updatedCycles = cycles.map((c) =>
          c.id === selectedCycleId
            ? {
                ...c,
                testRuns: c.testRuns.map((run) =>
                  run.id === runId
                    ? {
                        ...run,
                        jiraLinks: [
                          ...(run.jiraLinks || []),
                          {
                            id: `temp-${Date.now()}`,
                            issueKey: issueKey,
                            createdAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : run
                ),
              }
            : c
        )
        setCycles(updatedCycles)
      }

      setNewJiraKey('')
      setLastSavedAt(new Date())

      // Send to server
      const response = await fetch(`/api/test-runs/${runId}/jira-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey: issueKey,
        }),
      })

      if (response.ok) {
        // API confirmed - fetch latest data to ensure sync
        if (selectedVersionId) {
          await fetchVersions(selectedCycleId!)
        } else {
          await fetchCycles()
        }
        showToast('Jira link added - All changes saved', 'success')
      } else {
        // If API fails, revert optimistic update
        setVersions(versions)
        setCycles(cycles)
        setNewJiraKey(issueKey)
        showToast('Failed to add Jira link', 'error')
      }
    } catch (error) {
      showToast('Failed to add Jira link', 'error')
      console.error('Error adding Jira link:', error)
    }
  }

  const handleDeleteComment = async (runId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/test-runs/${runId}/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        if (selectedVersionId) {
          await fetchVersions(selectedCycleId!)
        } else {
          await fetchCycles()
        }
        showToast('Comment deleted', 'success')
      }
    } catch (error) {
      showToast('Failed to delete comment', 'error')
      console.error('Error deleting comment:', error)
    }
  }

  const handleDeleteJiraLink = async (runId: string, linkId: string) => {
    try {
      const response = await fetch(`/api/test-runs/${runId}/jira-links/${linkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        if (selectedVersionId) {
          await fetchVersions(selectedCycleId!)
        } else {
          await fetchCycles()
        }
        showToast('Jira link deleted', 'success')
      }
    } catch (error) {
      showToast('Failed to delete Jira link', 'error')
      console.error('Error deleting Jira link:', error)
    }
  }

  const handleToggleTestRunDetails = async (runId: string) => {
    if (expandedTestRunIds.has(runId)) {
      setExpandedTestRunIds((prev) => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
      return
    }

    setLoadingTestRunIds((prev) => new Set([...prev, runId]))

    try {
      const response = await fetch(`/api/test-runs/${runId}/details`)
      if (response.ok) {
        const fullTestRun = await response.json()

        const updatedVersions = versions.map((v) => ({
          ...v,
          testRuns: v.testRuns.map((run) =>
            run.id === runId
              ? {
                  ...run,
                  comments: fullTestRun.comments,
                  jiraLinks: fullTestRun.jiraLinks,
                }
              : run
          ),
        }))
        setVersions(updatedVersions)

        if (!selectedVersionId) {
          const updatedCycles = cycles.map((c) =>
            c.id === selectedCycleId
              ? {
                  ...c,
                  testRuns: c.testRuns.map((run) =>
                    run.id === runId
                      ? {
                          ...run,
                          comments: fullTestRun.comments,
                          jiraLinks: fullTestRun.jiraLinks,
                        }
                      : run
                  ),
                }
              : c
          )
          setCycles(updatedCycles)
        }

        setExpandedTestRunIds((prev) => new Set([...prev, runId]))
      }
    } catch (error) {
      showToast('Failed to load test run details', 'error')
      console.error('Error loading test run details:', error)
    } finally {
      setLoadingTestRunIds((prev) => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
    }
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId)
  const selectedVersion = versions.find((v) => v.id === selectedVersionId)

  // Debug: Log selected cycle and version with detailed breakdown
  console.log('==================== CYCLE RENDER DEBUG ====================')
  console.log('[Cycles Render] selectedCycleId:', selectedCycleId)
  console.log('[Cycles Render] selectedVersionId:', selectedVersionId)
  console.log('[Cycles Render] selectedCycle:', selectedCycle?.name, '(ID:', selectedCycle?.id, ')')
  console.log('[Cycles Render] selectedVersion:', selectedVersion?.buildVersion, '(ID:', selectedVersion?.id, ')')

  // Check all versions and their test counts
  console.log('[Cycles Render] All versions in state:')
  versions.forEach((v, idx) => {
    console.log(`  [${idx}] v${v.versionNumber}: ${v.buildVersion} - testRuns: ${v.testRuns?.length || 0}`)
  })

  console.log('[Cycles Render] selectedVersion.testRuns:', selectedVersion?.testRuns?.length || 0)
  console.log('[Cycles Render] selectedCycle.testRuns:', selectedCycle?.testRuns?.length || 0)

  const testRuns = (selectedVersion?.testRuns && selectedVersion.testRuns.length > 0) ? selectedVersion.testRuns : (selectedCycle?.testRuns || [])
  console.log('[Cycles Render] Final testRuns:', testRuns.length)
  if (testRuns.length > 0) {
    const statusCounts = {
      PASS: testRuns.filter(r => r.status === 'PASS').length,
      FAIL: testRuns.filter(r => r.status === 'FAIL').length,
      BLOCKED: testRuns.filter(r => r.status === 'BLOCKED').length,
      NOT_EXECUTED: testRuns.filter(r => r.status === 'NOT_EXECUTED').length,
    }
    console.log('[Cycles Render] Status breakdown:', statusCounts)
  }
  console.log('===========================================================')

  const isVersionCompleted = selectedVersion?.status === 'COMPLETED'

  if (selectedCycle) {
    const passCount = testRuns.filter((r) => r.status === 'PASS').length
    const failCount = testRuns.filter((r) => r.status === 'FAIL').length
    const blockedCount = testRuns.filter((r) => r.status === 'BLOCKED').length
    const notExecutedCount = testRuns.filter((r) => r.status === 'NOT_EXECUTED').length

    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              setSelectedCycleId(null)
              setSelectedVersionId(null)
              setVersions([])
            }}
            className="text-blue-600 hover:text-blue-800 mb-6"
          >
            ← Back to Cycles
          </button>

          {/* Cycle and Version Selectors */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Cycle</label>
                <select
                  value={selectedCycleId || ''}
                  onChange={(e) => {
                    setSelectedCycleId(e.target.value)
                    setSelectedVersionId(null)
                    setVersions([])
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a cycle --</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {versions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Version</label>
                  <select
                    value={selectedVersionId || ''}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a version --</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber}: {v.buildVersion} ({v.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedCycle.name}</h1>
          {selectedCycle.description && <p className="text-gray-600 mb-4">{selectedCycle.description}</p>}

          {/* Active Version Indicator */}
          {selectedVersion && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-indigo-900">
                <span className="font-semibold">Active Version:</span> {selectedVersion.buildVersion} ({selectedVersion.status})
              </p>
              {lastSavedAt && (
                <p className="text-xs text-indigo-700 mt-1">
                  ✓ All changes saved at {lastSavedAt.toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {/* Build Version Input */}
          {!selectedVersion ? (
            /* No version selected - show Create Version form */
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Build Version</label>
                  <input
                    type="text"
                    value={buildVersion}
                    onChange={(e) => setBuildVersion(e.target.value)}
                    placeholder="e.g., 2.4.3"
                    className="w-full md:w-96 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Release Notes (optional)
                  </label>
                  <textarea
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    placeholder="Document any release notes or changes..."
                    rows={2}
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateVersion}
                    disabled={isSavingVersion || !buildVersion.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {isSavingVersion ? 'Creating...' : 'Create Version'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedVersion.status === 'COMPLETED' ? (
            /* Version is COMPLETED - show read-only banner */
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">
                    Build Version: {selectedVersion.buildVersion}
                  </h3>
                  <p className="text-sm text-green-800">Status: COMPLETED (Read-only)</p>
                  {selectedVersion.completedAt && (
                    <p className="text-xs text-green-700 mt-1">
                      Completed: {new Date(selectedVersion.completedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Version is DRAFT or IN_PROGRESS - show Save Draft and Complete buttons */
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">
                    Build Version: {selectedVersion.buildVersion}
                  </h3>
                  <p className="text-sm text-blue-800">Status: {selectedVersion.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDraft}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 text-sm"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={handleCompleteExecution}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
                  >
                    Complete Execution
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version History Panel */}
          {versions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Version History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Version</th>
                      <th className="px-4 py-2 text-left">Build</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Created</th>
                      <th className="px-4 py-2 text-left">Completed</th>
                      <th className="px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{v.versionNumber}</td>
                        <td className="px-4 py-2">{v.buildVersion}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              v.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : v.status === 'IN_PROGRESS'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">{new Date(v.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          {v.completedAt ? new Date(v.completedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setSelectedVersionId(v.id)}
                            className={`text-sm font-medium px-2 py-1 rounded ${
                              selectedVersionId === v.id
                                ? 'bg-blue-100 text-blue-700'
                                : v.status === 'DRAFT'
                                  ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                  : v.status === 'IN_PROGRESS'
                                    ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                            }`}
                          >
                            {selectedVersionId === v.id
                              ? 'Active'
                              : v.status === 'DRAFT'
                                ? 'Resume Draft'
                                : v.status === 'IN_PROGRESS'
                                  ? 'Continue'
                                  : 'View Results'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Execution Notes Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Execution Notes</h3>
                {!isEditingNotes && (
                  <p className="text-blue-800 whitespace-pre-wrap">
                    {selectedCycle.executionNotes || 'No execution notes added yet'}
                  </p>
                )}
                {isEditingNotes && (
                  <div className="space-y-2">
                    <textarea
                      value={executionNotes}
                      onChange={(e) => setExecutionNotes(e.target.value)}
                      placeholder="Add execution notes here..."
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      disabled={isVersionCompleted}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setExecutionNotes(selectedCycle.executionNotes || '')
                          setIsEditingNotes(false)
                        }}
                        className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingNotes(false)
                          showToast('Execution notes updated', 'success')
                        }}
                        disabled={isVersionCompleted}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!isEditingNotes && !isVersionCompleted && (
                <button
                  onClick={() => {
                    setExecutionNotes(selectedCycle.executionNotes || '')
                    setIsEditingNotes(true)
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* DEBUG: Show data status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-xs text-blue-900">
            <strong>Debug Info:</strong>
            <div className="mt-2">
              <div>Cycle: {selectedCycle?.name} | Version: {selectedVersion?.buildVersion}</div>
              <div>TestRuns: {testRuns.length} | CycleTestRuns: {selectedCycle?.testRuns?.length || 0} | VersionTestRuns: {selectedVersion?.testRuns?.length || 0}</div>
              <div>Cycles: {cycles.length} | Versions: {versions.length}</div>
              <div className="mt-2 border-t border-blue-300 pt-2">
                <strong>All Versions Tests:</strong>
                {versions.map((v) => (
                  <div key={v.id} className={v.id === selectedVersionId ? 'font-bold bg-blue-100 px-2 py-1 rounded mt-1' : 'mt-1'}>
                    v{v.versionNumber} ({v.buildVersion}): {v.testRuns?.length || 0} tests
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-5">
              <div className="text-3xl font-bold text-green-700">{passCount}</div>
              <div className="text-xs font-semibold text-green-800 mt-2 uppercase tracking-wide">Passed</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-5">
              <div className="text-3xl font-bold text-red-700">{failCount}</div>
              <div className="text-xs font-semibold text-red-800 mt-2 uppercase tracking-wide">Failed</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
              <div className="text-3xl font-bold text-yellow-700">{blockedCount}</div>
              <div className="text-xs font-semibold text-yellow-800 mt-2 uppercase tracking-wide">Blocked</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="text-3xl font-bold text-gray-700">{notExecutedCount}</div>
              <div className="text-xs font-semibold text-gray-800 mt-2 uppercase tracking-wide">Not Executed</div>
            </div>
          </div>

          <div className="space-y-4">
            {testRuns.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-900">
                <p className="font-medium">No test cases to display</p>
                <p className="text-sm mt-1">
                  {selectedVersion ? (
                    <>
                      Version "{selectedVersion.buildVersion}" has no test runs.
                      {selectedCycle?.testRuns && selectedCycle.testRuns.length > 0 && (
                        <> But cycle has {selectedCycle.testRuns.length} tests at the cycle level.</>
                      )}
                    </>
                  ) : (
                    <>
                      Select a version to view test cases.
                      {selectedCycle?.testRuns && selectedCycle.testRuns.length > 0 && (
                        <> Cycle has {selectedCycle.testRuns.length} tests.</>
                      )}
                    </>
                  )}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">Showing {testRuns.length} test cases</p>
                {testRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-lg border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base text-gray-900">
                      {run.testCase?.title || 'Unknown'}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleToggleTestRunDetails(run.id)}
                    disabled={loadingTestRunIds.has(run.id)}
                    className="text-sm text-gray-600 hover:text-gray-900 mr-3"
                  >
                    {loadingTestRunIds.has(run.id)
                      ? 'Loading...'
                      : expandedTestRunIds.has(run.id)
                        ? '▼ Details'
                        : '▶ Details'}
                  </button>
                  <select
                    value={run.status}
                    onChange={(e) => handleRunStatusChange(run.id, e.target.value)}
                    disabled={isVersionCompleted}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                      run.status === 'PASS'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : run.status === 'FAIL'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : run.status === 'BLOCKED'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    <option value="NOT_EXECUTED">Not Executed</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>

                {(run.executedAt || run.executedBy) && (
                  <div className="text-xs text-gray-600 space-y-0.5 mb-3">
                    {run.executedAt && <div>Executed: {new Date(run.executedAt).toLocaleString()}</div>}
                    {run.executedBy && <div>By: {run.executedBy}</div>}
                    {run.durationMs && <div>Duration: {run.durationMs}ms</div>}
                  </div>
                )}

                {expandedTestRunIds.has(run.id) && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Comments</h4>
                  <div className="space-y-2 mb-3">
                    {run.comments && run.comments.length > 0 ? (
                      run.comments.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 font-medium">{comment.content}</p>
                              <p className="text-xs text-gray-700 mt-1">
                                {comment.author} • {new Date(comment.createdAt).toLocaleString()}
                              </p>
                            </div>
                            {user?.role === 'LEAD' && !isVersionCompleted && (
                              <button
                                onClick={() => handleDeleteComment(run.id, comment.id)}
                                className="text-red-600 hover:text-red-800 text-sm ml-2"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-700">No comments yet</p>
                    )}
                  </div>
                  {user?.role === 'LEAD' && !isVersionCompleted && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500 bg-white"
                      />
                      <button
                        onClick={() => handleAddComment(run.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Jira Links</h4>
                  <div className="space-y-2 mb-3">
                    {run.jiraLinks && run.jiraLinks.length > 0 ? (
                      run.jiraLinks.map((link) => (
                        <div key={link.id} className="bg-blue-50 border border-blue-200 rounded p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <a
                                href={link.issueUrl || `https://jira.atlassian.net/browse/${link.issueKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {link.issueKey}
                              </a>
                              {link.summary && <p className="text-sm text-gray-700 mt-1">{link.summary}</p>}
                              {link.issueType && (
                                <p className="text-xs text-gray-600 mt-1">Type: {link.issueType}</p>
                              )}
                            </div>
                            {user?.role === 'LEAD' && !isVersionCompleted && (
                              <button
                                onClick={() => handleDeleteJiraLink(run.id, link.id)}
                                className="text-red-600 hover:text-red-800 text-sm ml-2"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-700">No Jira links yet</p>
                    )}
                  </div>
                  {user?.role === 'LEAD' && !isVersionCompleted && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newJiraKey}
                        onChange={(e) => setNewJiraKey(e.target.value)}
                        placeholder="e.g., PROJ-123"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500 bg-white"
                      />
                      <button
                        onClick={() => handleAddJiraLink(run.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            ))}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Execution Cycles</h1>
            <p className="text-gray-600">Track and manage test execution runs</p>
          </div>
          {user?.role === 'LEAD' && projects.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Execution Cycle
            </button>
          )}
        </div>

        {user?.role === 'LEAD' && projects.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-2">Select Project</label>
            <select
              value={currentProjectId}
              onChange={(e) => setCurrentProjectId(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="default-project">Choose a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading execution cycles...</p>
          </div>
        ) : cycles.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">🔄</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No cycles yet</h2>
            <p className="text-gray-600 mb-6">Create an execution cycle to start testing</p>
            {user?.role === 'LEAD' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Execution Cycle
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {cycles.map((cycle) => (
              <button
                key={cycle.id}
                onClick={() => {
                  setSelectedCycleId(cycle.id)
                  fetchVersions(cycle.id)
                }}
                className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cycle.name}</h3>
                    {cycle.description && <p className="text-sm text-gray-600 mt-1">{cycle.description}</p>}
                    <div className="flex gap-4 mt-3">
                      <span className="text-sm text-gray-500">
                        {(cycle.testRuns ?? []).length} total tests
                      </span>
                      <span className="text-sm text-green-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'PASS').length} pass
                      </span>
                      <span className="text-sm text-red-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'FAIL').length} fail
                      </span>
                      <span className="text-sm text-yellow-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'BLOCKED').length} blocked
                      </span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {cycle.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Execution Cycle</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Cycle Name</label>
                  <input
                    type="text"
                    value={newCycleName}
                    onChange={(e) => setNewCycleName(e.target.value)}
                    placeholder="e.g., Smoke Test Run"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newCycleDesc}
                    onChange={(e) => setNewCycleDesc(e.target.value)}
                    placeholder="Cycle description"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Test Suite</label>
                  <select
                    value={selectedSuiteId}
                    onChange={(e) => setSelectedSuiteId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a suite...</option>
                    {suites.map((suite) => (
                      <option key={suite.id} value={suite.id}>
                        {suite.name} ({suite.testCases?.length || 0} tests)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewCycleName('')
                    setNewCycleDesc('')
                    setSelectedSuiteId('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCycle}
                  disabled={!newCycleName.trim() || !selectedSuiteId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Create Cycle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExecutionCyclesPage() {
  return (
    <ProtectedRoute>
      <ExecutionCyclesContent />
    </ProtectedRoute>
  )
}
