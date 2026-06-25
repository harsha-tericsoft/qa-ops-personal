#!/bin/bash

GRAPH="Project_Kinergy"

# Get the 50 UIDs and their original text
python3 << 'PYTHON_END'
import json

backup = json.load(open('roam-testcase-backup.json', encoding='utf-8'))
preview = json.load(open('roam-testcase-update-preview.json', encoding='utf-8'))

updates = [u for u in preview['updates'] if u['action'] != 'SKIP_ALREADY_CORRECT' and u['changed']][:50]

for update in updates:
    # Get original text from backup
    original = next((b for b in backup['blocks'] if b['uid'] == update['uid']), None)
    if original:
        print(f"{update['uid']}|||{original['text']}")

PYTHON_END
