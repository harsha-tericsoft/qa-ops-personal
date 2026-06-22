$report = Get-Content 'migration-results.json' -Raw | ConvertFrom-Json
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
        $output = & roam get-block --graph "Project_Kinergy" --uid "$uid" 2>&1
        $block = $output | ConvertFrom-Json -ErrorAction Stop
        $text = if ($block.string) { $block.string } elseif ($block.title) { $block.title } else { "" }

        if ([string]::IsNullOrEmpty($text)) {
            $failedVerifications += @{
                uid = $uid
                error = "Block returned empty text"
            }
            Write-Host "[❌ $(($i + 1))/$sampleSize] UID: $uid - EMPTY RESPONSE" -ForegroundColor Red
        } elseif ($text.StartsWith("Test::")) {
            $displayText = if ($text.Length -gt 100) { $text.Substring(0, 100) } else { $text }
            $verifiedBlocks += @{
                uid = $uid
                text = $displayText
                verified = $true
            }
            Write-Host "[✅ $(($i + 1))/$sampleSize] UID: $uid" -ForegroundColor Green
            $shortText = if ($text.Length -gt 80) { $text.Substring(0, 80) } else { $text }
            Write-Host "        Text: $shortText" -ForegroundColor Gray
        } else {
            $displayText = if ($text.Length -gt 100) { $text.Substring(0, 100) } else { $text }
            $failedVerifications += @{
                uid = $uid
                text = $displayText
                error = "Does not start with 'Test::'"
            }
            Write-Host "[❌ $(($i + 1))/$sampleSize] UID: $uid - NOT UPDATED" -ForegroundColor Red
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg.Length -gt 100) { $errorMsg = $errorMsg.Substring(0, 100) }
        $failedVerifications += @{
            uid = $uid
            error = $errorMsg
        }
        Write-Host "[❌ $(($i + 1))/$sampleSize] UID: $uid - VERIFICATION FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== VERIFICATION SUMMARY ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Successfully verified: $($verifiedBlocks.Count)/$sampleSize" -ForegroundColor Green
Write-Host "❌ Verification failed: $($failedVerifications.Count)/$sampleSize" -ForegroundColor Red

Write-Host ""
Write-Host "=== FINAL TEST:: COUNT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before migration: 2 blocks starting with 'Test::'"
$expectedCount = 2 + $report.updated
Write-Host "After migration: Expected $expectedCount blocks starting with 'Test::'" -ForegroundColor Yellow
Write-Host "Verified blocks in sample: $($verifiedBlocks.Count)/$sampleSize correctly prefixed" -ForegroundColor Green

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
    sampledBlocksVerified = $verifiedBlocks
    failedBlockVerifications = $failedVerifications
}

$verificationReport | ConvertTo-Json -Depth 10 | Out-File 'verification-report.json' -Encoding utf8
Write-Host ""
Write-Host "✅ Verification report saved to: verification-report.json" -ForegroundColor Green
