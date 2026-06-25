#!/usr/bin/env python3
"""Trace exact test case through sync pipeline"""

import json
import re
import subprocess
from pathlib import Path

def get_block_from_roam():
    """Step 1: Get block from roam get-page"""
    print("=" * 70)
    print("STEP 1: Get block from roam get-page")
    print("=" * 70)
    print()

    result = subprocess.run(
        ['roam', 'get-page', '--graph', 'Project_Kinergy', '--title', 'TestSuite : Kinergy'],
        capture_output=True,
        text=True,
        timeout=60
    )

    if result.returncode != 0:
        print(f"ERROR: roam command failed: {result.stderr}")
        return None, None

    # Extract JSON from response
    match = re.search(r'\{[\s\S]*\}', result.stdout, re.DOTALL)
    if not match:
        print("ERROR: No JSON in response")
        return None, None

    try:
        data = json.loads(match.group())
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON parse failed: {e}")
        return None, None

    markdown = data.get('markdown', '')

    # Search for block
    block_text = 'hjgfhjggjhhhgghjgh'
    if block_text not in markdown:
        print(f"✗ Block '{block_text}' NOT in roam get-page response")
        print(f"  Markdown size: {len(markdown)} chars")
        return None, None

    print(f"✓ Block found in roam get-page response")

    # Extract UID
    pos = markdown.find(block_text)
    snippet = markdown[max(0, pos-100):pos+300]

    uid_match = re.search(r'<roam uid="([^"]+)"', snippet)
    if not uid_match:
        print("✗ Could not extract UID from markdown")
        return None, markdown

    uid = uid_match.group(1)
    print(f"✓ Block UID: {uid}")
    print()
    print("Context from markdown:")
    print(snippet)
    print()

    return uid, markdown

def check_repository_node(uid):
    """Step 2: Check if RepositoryNode was created"""
    print("\n" + "=" * 70)
    print(f"STEP 2: Check RepositoryNode for UID {uid}")
    print("=" * 70)
    print()

    try:
        from app.generated.prisma import PrismaClient
    except ImportError:
        print("ERROR: Cannot import Prisma client from Node.js context")
        print("Using alternative: database query directly")
        return None

    # We need to query the database
    print("(Note: Would query: SELECT * FROM RepositoryNode WHERE roamNodeId = ?)")
    print(f"UID to search: {uid}")

    return None  # Indicate we need Node.js for this

def main():
    print("TRACING TEST CASE: Test:: hjgfhjggjhhhgghjgh #Manual")
    print()

    # Step 1
    uid, markdown = get_block_from_roam()

    if not uid:
        print("\n✗✗✗ BLOCK NOT FOUND IN roam get-page OUTPUT")
        print("\nThis means:")
        print("- The block is NOT being returned by roam get-page")
        print("- Therefore it cannot be parsed or imported")
        print("- This is where the block is being DROPPED")
        return

    print(f"\n✓ Block found with UID: {uid}")
    print("Next: Check if RepositoryNode was created...")

if __name__ == '__main__':
    main()
