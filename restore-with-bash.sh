#!/bin/bash

# RESTORATION: Restore 50 corrupted blocks using bash + array arguments
# This approach uses bash to execute roam but passes text through environment
# variables or stdin to avoid shell escaping issues

GRAPH="Project_Kinergy"
BACKUP_FILE="roam-testcase-backup.json"
PREVIEW_FILE="roam-testcase-update-preview.json"

echo "=========================================="
echo "RESTORATION: 50 Corrupted Blocks"
echo "=========================================="
echo ""

# Step 1: Get list of UIDs
echo "Loading UIDs..."
UIDS=$(python3 << 'PYTHON'
import json
preview = json.load(open('roam-testcase-update-preview.json', encoding='utf-8'))
updates = [u for u in preview['updates'] if u['action'] != 'SKIP_ALREADY_CORRECT' and u['changed']][:50]
for u in updates:
    print(u['uid'])
PYTHON
)

# Step 2: Load backup
echo "Loading backup..."
BACKUP=$(cat "$BACKUP_FILE")

echo ""
echo "Restoring blocks..."

RESTORED=0
FAILED=0
COUNT=0

while read -r UID; do
    [ -z "$UID" ] && continue

    # Find the block in backup
    ORIGINAL=$(echo "$BACKUP" | python3 << PYTHON
import json, sys
data = json.load(sys.stdin)
uid = "$UID"
for block in data.get('blocks', []):
    if block['uid'] == uid:
        print(json.dumps(block['text']))
        break
PYTHON
)

    if [ -z "$ORIGINAL" ]; then
        FAILED=$((FAILED + 1))
        continue
    fi

    # Remove the JSON quotes
    ORIGINAL=$(echo "$ORIGINAL" | python3 -c "import sys, json; print(json.load(sys.stdin))")

    # Use a temporary file to avoid shell escaping
    TEMP_FILE="/tmp/roam_update_$UID.txt"
    echo "$ORIGINAL" > "$TEMP_FILE"

    # Execute roam with file-based approach
    # Since roam may not support file input directly, we use bash here-doc
    if bash -c "roam update-block --uid '$UID' --string \"\$(cat '$TEMP_FILE')\" --graph '$GRAPH'" > /dev/null 2>&1; then
        RESTORED=$((RESTORED + 1))
    else
        FAILED=$((FAILED + 1))
    fi

    COUNT=$((COUNT + 1))
    if [ $((COUNT % 10)) -eq 0 ]; then
        echo "  Restored $COUNT/50..."
    fi

    rm -f "$TEMP_FILE"
done <<< "$UIDS"

echo ""
echo "Restored: $RESTORED, Failed: $FAILED"
echo ""

# Step 3: Verify
echo "Verifying restoration..."

VERIFIED=0
while read -r UID; do
    [ -z "$UID" ] && continue

    # Get current state
    CURRENT=$(roam get-block --uid "$UID" --graph "$GRAPH" 2>/dev/null | jq -r '.markdown' | sed 's/<roam.*//g' | xargs)

    # Get expected from backup
    EXPECTED=$(echo "$BACKUP" | python3 << PYTHON
import json, sys
data = json.load(sys.stdin)
uid = "$UID"
for block in data.get('blocks', []):
    if block['uid'] == uid:
        print(block['text'])
        break
PYTHON
)

    if [ "$CURRENT" = "$EXPECTED" ]; then
        VERIFIED=$((VERIFIED + 1))
    fi
done <<< "$UIDS"

echo "Verified: $VERIFIED / 50"
echo ""

if [ "$VERIFIED" -eq 50 ]; then
    echo "✓ ALL BLOCKS RESTORED SUCCESSFULLY"
else
    echo "✗ Some blocks still not restored"
fi

