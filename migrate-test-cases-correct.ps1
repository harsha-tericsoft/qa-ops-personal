$reportJson = Get-Content 'migration-analysis-report.json' -Raw | ConvertFrom-Json
$candidates = $reportJson.candidates

Write-Host "=== ROAM TEST CASE MIGRATION (CORRECTED) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total candidates to migrate: $($candidates.Count)" -ForegroundColor Yellow
Write-Host "Graph: Project_Kinergy" -ForegroundColor Yellow
Write-Host ""

$results = @{
    startTime = [datetime]::UtcNow.ToString('o')
    graphName = 'Project_Kinergy'
    totalCandidates = $candidates.Count
    updated = 0
    alreadyPrefixed = 0
    failed = @()
    updatedUIDs = @()
    failedUIDs = @()
}

# Migrate each candidate
$totalProcessed = 0
foreach ($candidate in $candidates) {
    $totalProcessed++
    $text = $candidate.text
    $uid = $candidate.uid

    # Skip if already starts with "Test::"
    if ($text.StartsWith('Test::')) {
        $results.alreadyPrefixed++
        continue
    }

    $newText = "Test:: $text"

    try {
        # Use correct flag: --string (not --content)
        $arguments = @('update-block', '--graph', 'Project_Kinergy', '--uid', $uid, '--string', $newText)

        # Execute command
        & roam @arguments 2>&1 | Out-Null

        $results.updated++
        $results.updatedUIDs += $uid

        if ($totalProcessed % 50 -eq 0) {
            Write-Host "Progress: $totalProcessed/$($candidates.Count) blocks processed" -ForegroundColor Green
        }
    } catch {
        $results.failed += @{
            uid = $uid
            originalText = $text.Substring(0, [Math]::Min(100, $text.Length))
            error = $_.Exception.Message.Substring(0, [Math]::Min(200, $_.Exception.Message.Length))
        }
        $results.failedUIDs += $uid

        if ($totalProcessed % 100 -eq 0) {
            Write-Host "  - Failures so far: $($results.failed.Count)" -ForegroundColor Red
        }
    }
}

$results.endTime = [datetime]::UtcNow.ToString('o')

Write-Host ""
Write-Host "=== MIGRATION COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Updated: $($results.updated)" -ForegroundColor Green
Write-Host "⏭️  Already prefixed (Test::): $($results.alreadyPrefixed)" -ForegroundColor Yellow
Write-Host "❌ Failed: $($results.failed.Count)" -ForegroundColor Red
Write-Host ""
Write-Host "Total blocks modified: $($results.updated)" -ForegroundColor Green
Write-Host "Expected Test:: blocks after migration: $([int]2 + [int]$results.updated)" -ForegroundColor Yellow

# Save results as JSON
$resultsJson = $results | ConvertTo-Json -Depth 10
$resultsJson | Out-File -FilePath 'migration-results-corrected.json' -Encoding utf8

Write-Host ""
Write-Host "✅ Results saved to: migration-results-corrected.json" -ForegroundColor Green
