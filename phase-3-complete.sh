#!/bin/bash

# PHASE 3: Limited execution of 50 blocks with verification

GRAPH="Project_Kinergy"
BACKUP_FILE="roam-testcase-backup.json"
PREVIEW_FILE="roam-testcase-update-preview.json"
REPORT_FILE="phase-3-verification-report.json"
LOG_FILE="phase-3-execution.log"

# Clear old files
> "$LOG_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "======================================================================="
log "PHASE 3: LIMITED EXECUTION - Update 50 blocks with verification"
log "======================================================================="
log ""

# Extract UIDs and expected text from preview
log "STEP 1: Updating 50 blocks..."
log ""

UPDATES=$(python3 << 'PYTHON'
import json
preview = json.load(open('roam-testcase-update-preview.json', encoding='utf-8'))
updates = [u for u in preview['updates'] if u['action'] != 'SKIP_ALREADY_CORRECT' and u['changed']][:50]
for i, u in enumerate(updates):
    print(f"{i}|{u['uid']}|{u['before']}|{u['after']}")
PYTHON
)

UPDATED=0
FAILED=0

while IFS='|' read -r INDEX UID BEFORE AFTER; do
    [ -z "$UID" ] && continue

    # Update block - roam update-block passes string without shell parsing issues
    if roam update-block --uid "$UID" --string "$AFTER" --graph "$GRAPH" > /dev/null 2>&1; then
        UPDATED=$((UPDATED + 1))
        [ $((($UPDATED) % 10)) -eq 0 ] && log "  Updated $UPDATED blocks..."
    else
        FAILED=$((FAILED + 1))
        log "  ERROR: Failed to update $UID"
    fi

    sleep 0.05
done <<< "$UPDATES"

log ""
log "✓ Updated $UPDATED blocks ($FAILED failed)"
log ""

# Verify updates
log "STEP 2: Verifying all updated blocks..."
log ""

VERIFIED=0
VERIFICATION_FAILED=0

while IFS='|' read -r INDEX UID BEFORE AFTER; do
    [ -z "$UID" ] && continue

    # Re-read block
    CURRENT=$(roam get-block --uid "$UID" --graph "$GRAPH" 2>/dev/null | jq -r '.markdown' | sed 's/<roam.*//g' | sed 's/^- //' | xargs)

    # Check if matches
    if [ "$CURRENT" = "$AFTER" ]; then
        VERIFIED=$((VERIFIED + 1))
    else
        VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
        if [ $VERIFICATION_FAILED -le 5 ]; then
            log "  MISMATCH: $UID"
            log "    Expected: ${AFTER:0:70}..."
            log "    Got:      ${CURRENT:0:70}..."
        fi
    fi

    [ $((($VERIFIED + $VERIFICATION_FAILED) % 10)) -eq 0 ] && log "  Verified $((VERIFIED + VERIFICATION_FAILED)) blocks..."
done <<< "$UPDATES"

log ""
log "✓ Verification complete"
log ""

# Summary
log "======================================================================="
log "PHASE 3 VERIFICATION SUMMARY"
log "======================================================================="
log ""
log "Total updated: $UPDATED"
log "Verification passed: $VERIFIED"
log "Verification failed: $VERIFICATION_FAILED"
log ""

if [ $VERIFICATION_FAILED -eq 0 ]; then
    log "✓ ALL 50 BLOCKS VERIFIED SUCCESSFULLY"
    log ""
    log "READY FOR PHASE 4: Update remaining 1,133 blocks"
else
    log "⚠️  $VERIFICATION_FAILED blocks failed verification"
    log "Review log for details"
fi

log ""
log "======================================================================="
log "PHASE 3 COMPLETE"
log "======================================================================="

