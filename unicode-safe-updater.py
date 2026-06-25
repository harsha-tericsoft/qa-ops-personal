#!/usr/bin/env python3

"""
UNICODE-SAFE BLOCK UPDATER

Avoids shell string interpolation entirely by:
1. Using subprocess with proper argument lists (no shell=True)
2. Handling Unicode strings natively
3. Using roam-cli with array-based arguments, not shell commands
4. Writing to temporary files when needed

Safe for Windows, Linux, macOS
Handles smart quotes, em-dashes, bullets, all Unicode
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

class UnicodeSafeUpdater:
    def __init__(self, graph_name='Project_Kinergy'):
        self.graph = graph_name

    def update_block(self, uid, new_text):
        """
        Update a block using subprocess without shell interpolation

        Args:
            uid: Block UID
            new_text: New text (with all Unicode preserved)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Use subprocess.run with list of arguments (no shell=True)
            # This avoids any shell escaping issues
            result = subprocess.run(
                ['roam', 'update-block', '--uid', uid, '--string', new_text, '--graph', self.graph],
                capture_output=True,
                text=True,
                timeout=10
            )

            return result.returncode == 0
        except Exception as e:
            print(f"Error updating {uid}: {e}")
            return False

    def get_block(self, uid):
        """
        Read a block from Roam

        Args:
            uid: Block UID

        Returns:
            Block data dict or None
        """
        try:
            result = subprocess.run(
                ['roam', 'get-block', '--uid', uid, '--graph', self.graph],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                # Parse JSON response
                data = json.loads(result.stdout)
                return data
            return None
        except Exception as e:
            print(f"Error reading {uid}: {e}")
            return None

    def restore_blocks(self, uids, backup_data):
        """
        Restore blocks from backup

        Args:
            uids: List of UIDs to restore
            backup_data: Backup JSON data

        Returns:
            {restored: count, failed: count, details: []}
        """
        results = {
            'restored': 0,
            'failed': 0,
            'details': []
        }

        backup_blocks = {b['uid']: b for b in backup_data.get('blocks', [])}

        for i, uid in enumerate(uids):
            if uid not in backup_blocks:
                results['failed'] += 1
                results['details'].append({'uid': uid, 'status': 'NOT_IN_BACKUP'})
                continue

            original_text = backup_blocks[uid]['text']

            if self.update_block(uid, original_text):
                results['restored'] += 1
                results['details'].append({'uid': uid, 'status': 'RESTORED'})
            else:
                results['failed'] += 1
                results['details'].append({'uid': uid, 'status': 'UPDATE_FAILED'})

            if (i + 1) % 10 == 0:
                print(f"  Restored {i + 1}/{len(uids)}...")

        return results

    def verify_block(self, uid, expected_text):
        """
        Verify block content matches expected

        Args:
            uid: Block UID
            expected_text: Expected text content

        Returns:
            True if matches, False otherwise
        """
        block = self.get_block(uid)
        if not block:
            return False

        # Extract text from markdown (remove roam tags)
        markdown = block.get('markdown', '')
        actual_text = markdown.split('<roam')[0].rstrip()

        return actual_text == expected_text

def restore_phase3_blocks():
    """Restore the 50 corrupted blocks from Phase 3"""

    print("=" * 70)
    print("UNICODE-SAFE RESTORATION")
    print("=" * 70)
    print()

    # Load backup
    print("Loading backup...")
    with open('roam-testcase-backup.json', encoding='utf-8') as f:
        backup = json.load(f)

    # Load preview to get the UIDs
    print("Loading preview...")
    with open('roam-testcase-update-preview.json', encoding='utf-8') as f:
        preview = json.load(f)

    # Get the 50 UIDs that were corrupted
    updates = [u for u in preview['updates'] if u['action'] != 'SKIP_ALREADY_CORRECT' and u['changed']][:50]
    uids_to_restore = [u['uid'] for u in updates]

    print(f"Restoring {len(uids_to_restore)} blocks...\n")

    updater = UnicodeSafeUpdater()

    # Step 1: Restore
    print("STEP 1: Restoring blocks...")
    restore_results = updater.restore_blocks(uids_to_restore, backup)

    print(f"\n✓ Restored: {restore_results['restored']}")
    print(f"✗ Failed: {restore_results['failed']}")
    print()

    # Step 2: Verify
    print("STEP 2: Verifying restoration...")
    verified = 0
    mismatches = 0

    for i, update in enumerate(updates):
        if updater.verify_block(update['uid'], update['before']):
            verified += 1
        else:
            mismatches += 1
            if mismatches <= 5:
                print(f"  MISMATCH: {update['uid']}")

        if (i + 1) % 10 == 0:
            print(f"  Verified {i + 1}/{len(updates)}...")

    print(f"\n✓ Verified: {verified}")
    print(f"✗ Mismatches: {mismatches}")
    print()

    # Save report
    report = {
        'timestamp': str(Path.cwd()),
        'restoration': restore_results,
        'verification': {
            'verified': verified,
            'mismatches': mismatches
        }
    }

    with open('unicode-safe-restoration-report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Report saved: unicode-safe-restoration-report.json")
    print()

    if mismatches == 0:
        print("✓ RESTORATION SUCCESSFUL")
        print()
        return True
    else:
        print("⚠️  Restoration had issues")
        return False

def test_unicode_update(uids_to_test):
    """Test Unicode-safe update on 5 test blocks"""

    print("=" * 70)
    print("UNICODE-SAFE UPDATE TEST (5 blocks)")
    print("=" * 70)
    print()

    # Load preview
    with open('roam-testcase-update-preview.json', encoding='utf-8') as f:
        preview = json.load(f)

    updates = [u for u in preview['updates'] if u['action'] != 'SKIP_ALREADY_CORRECT' and u['changed']]
    test_updates = [u for u in updates if u['uid'] in uids_to_test]

    print(f"Testing {len(test_updates)} blocks...\n")

    updater = UnicodeSafeUpdater()

    # Update test blocks
    print("Updating test blocks...")
    update_results = []
    for i, update in enumerate(test_updates):
        success = updater.update_block(update['uid'], update['after'])
        update_results.append({
            'uid': update['uid'],
            'success': success,
            'expected': update['after'][:80]
        })
        print(f"  {i+1}. {update['uid']}: {'✓' if success else '✗'}")

    print()

    # Verify updates
    print("Verifying updates...")
    verified = 0
    failed = 0

    for i, result in enumerate(update_results):
        block = updater.get_block(result['uid'])
        if block:
            markdown = block.get('markdown', '')
            actual = markdown.split('<roam')[0].rstrip()

            # Find the matching update
            matching_update = next((u for u in test_updates if u['uid'] == result['uid']), None)
            if matching_update and actual == matching_update['after']:
                verified += 1
                print(f"  {i+1}. {result['uid']}: ✓ VERIFIED")
            else:
                failed += 1
                print(f"  {i+1}. {result['uid']}: ✗ MISMATCH")
                if matching_update:
                    print(f"       Expected: {matching_update['after'][:60]}...")
                    print(f"       Got:      {actual[:60]}...")
        else:
            failed += 1
            print(f"  {i+1}. {result['uid']}: ✗ ERROR")

    print()
    print(f"Results: {verified} verified, {failed} failed")
    print()

    # Save report
    test_report = {
        'timestamp': str(Path.cwd()),
        'test_blocks': len(test_updates),
        'verified': verified,
        'failed': failed,
        'details': update_results
    }

    with open('unicode-safe-test-report.json', 'w', encoding='utf-8') as f:
        json.dump(test_report, f, indent=2, ensure_ascii=False)

    print(f"Report saved: unicode-safe-test-report.json")

    return verified == len(test_updates)

if __name__ == '__main__':
    try:
        # Restore the corrupted blocks
        restore_success = restore_phase3_blocks()

        if restore_success:
            print("=" * 70)
            print("READY FOR UNICODE-SAFE UPDATE TEST")
            print("=" * 70)
            print()
            print("Next: Run test on 5 blocks to verify Unicode-safe approach")
        else:
            print("Restoration issues - investigate before proceeding")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

