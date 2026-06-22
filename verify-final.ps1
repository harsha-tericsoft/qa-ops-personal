$report = Get-Content 'migration-results-corrected.json' -Raw | ConvertFrom-Json
$updatedUIDs = $report.updatedUIDs

Write-Host "=== MIGRATION VERIFICATION REPORT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Migration completed at: $($report.endTime)" -ForegroundColor Yellow
Write-Host "Total candidates identified: $($report.totalCandidates)"
Write-Host "Blocks updated: $($report.updated)" -ForegroundColor Green
Write-Host "Blocks already with Test::: $($report.alreadyPrefixed)"
Write-Host "Blocks failed to update: $($report.failed.Count)" -ForegroundColor Red
Write-Host ""

# Randomly select up to 20 UIDs to verify
$sampleSize = [Math]::Min(20, $updatedUIDs.Count)
$sampleUIDs = $updatedUIDs | Get-Random -Count $sampleSize

Write-Host "Randomly verifying $sampleSize updated blocks:" -ForegroundColor Yellow
Write-Host ""

$verifiedBlocks = @()
$failedVerifications = @()

for ($i = 0; $i -lt $sampleUIDs.Count; $i++) {
    $uid = $sampleUIDs[$i]
    try {
        # Get the block - capture all output and filter JSON
        $output = @(& roam get-block --graph "Project_Kinergy" --uid "$uid" 2>&1)

        # Find JSON lines (start with { or whitespace+quote)
        $jsonLines = $output | Where-Object { $_ -match '^\s*[\{\"]' -and $_ -notmatch 'WARNING|Error' }

        if ($jsonLines.Count -eq 0) {
            throw "No valid JSON output"
        }

        # Join and parse JSON
        $jsonStr = $jsonLines -join "`n"
        $block = $jsonStr | ConvertFrom-Json -ErrorAction Stop

        # Get the markdown which contains the block text
        $markdown = $block.markdown
        if ([string]::IsNullOrEmpty($markdown)) {
            if ($block.string) { $markdown = $block.string }
            elseif ($block.title) { $markdown = $block.title }
            else { $markdown = "" }
        }

        # Extract first line (remove leading bullet point and <roam> tag)
        $firstLine = ($markdown -split "`n")[0]
        $firstLine = $firstLine -replace '^\s*-\s*', '' -replace '<roam[^>]*>', ''

        if ($firstLine.StartsWith("Test::")) {
            $displayText = if ($firstLine.Length -gt 100) { $firstLine.Substring(0, 100) } else { $firstLine }
            $verifiedBlocks += @{
                uid = $uid
                text = $displayText
                verified = $true
            }
            Write-Host "[✅ $(($i + 1))/$sampleSize] UID: $uid" -ForegroundColor Green
            $shortText = if ($firstLine.Length -gt 75) { $firstLine.Substring(0, 75) + "..." } else { $firstLine }
            Write-Host "        $shortText" -ForegroundColor Gray
        } else {
            $displayText = if ($firstLine.Length -gt 100) { $firstLine.Substring(0, 100) } else { $firstLine }
            $failedVerifications += @{
                uid = $uid
                text = $displayText
                error = "Does not start with 'Test::'"
            }
            Write-Host "[❌ $(($i + 1))/$sampleSize] UID: $uid - NOT UPDATED" -ForegroundColor Red
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg.Length -gt 80) { $errorMsg = $errorMsg.Substring(0, 80) + "..." }
        $failedVerifications += @{
            uid = $uid
            error = $errorMsg
        }
        Write-Host "[❌ $(($i + 1))/$sampleSize] UID: $uid - ERROR" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== VERIFICATION SUMMARY ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Successfully verified: $($verifiedBlocks.Count)/$sampleSize blocks" -ForegroundColor Green
Write-Host "❌ Verification failed: $($failedVerifications.Count)/$sampleSize blocks" -ForegroundColor Red

if ($failedVerifications.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed verifications:" -ForegroundColor Yellow
    $failedVerifications | ForEach-Object {
        Write-Host "    [$($_.uid)] $($_.error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== FINAL TEST:: BLOCK COUNT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before migration: 2 blocks starting with 'Test::'" -ForegroundColor Yellow
$expectedCount = 2 + $report.updated
Write-Host "After migration: Expected $expectedCount blocks starting with 'Test::'" -ForegroundColor Green
Write-Host "Sample verification: $($verifiedBlocks.Count)/$sampleSize blocks correctly prefixed" -ForegroundColor Green

# Save verification report
$verificationReport = @{
    verificationTime = [datetime]::UtcNow.ToString('o')
    totalCandidates = $report.totalCandidates
    totalUpdated = $report.updated
    totalAlreadyPrefixed = $report.alreadyPrefixed
    totalFailed = $report.failed.Count
    sampleSize = $sampleSize
    successfulVerifications = $verifiedBlocks.Count
    failedVerifications = $failedVerifications.Count
    verificationSuccess = ($verifiedBlocks.Count -eq $sampleSize)
    expectedTestBlockCount = $expectedCount
}

$verificationReport | ConvertTo-Json -Depth 5 | Out-File 'verification-report-final.json' -Encoding utf8
Write-Host ""
Write-Host "✅ Verification report saved to: verification-report-final.json" -ForegroundColor Green
