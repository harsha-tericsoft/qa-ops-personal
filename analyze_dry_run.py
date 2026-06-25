#!/usr/bin/env python3
import json
import re
import subprocess

print("=== DRY RUN: Analyzing Test Case Prefixes in Roam ===\n")

# Fetch test cases
all_cases = []
seen = set()

try:
    result = subprocess.run(
        ["roam", "search", "--graph", "Project_Kinergy", "--query", "Test", "--limit", "500"],
        capture_output=True,
        text=True,
        timeout=30
    )

    # Parse JSON (skip warning lines)
    lines = result.stdout.split('\n')
    json_start = next(i for i, line in enumerate(lines) if line.startswith('{'))
    json_text = '\n'.join(lines[json_start:])

    data = json.loads(json_text)

    for result_item in data.get('results', []):
        md = result_item.get('markdown', '').strip()
        if md and md not in seen:
            seen.add(md)

            # Clean markdown: remove roam tags and leading dash
            clean = md
            clean = re.sub(r'<roam uid="[^"]*"[^>]*/?>', '', clean)
            clean = re.sub(r'^-\s*', '', clean)
            clean = clean.strip()

            if clean:
                all_cases.append(clean)
except Exception as e:
    print(f"Error fetching data: {e}")
    exit(1)

print(f"Total test case blocks found: {len(all_cases)}\n")

# Categorize
categories = {
    'correct': [],
    'missing_prefix': [],
    'single_colon': [],
    'invalid_variant': [],
    'double_prefix': []
}

for case in all_cases:
    # Check for correct format
    if re.match(r'^Test::\s', case) or re.match(r'^\*\*Test::\s\*\*', case):
        categories['correct'].append(case)
    # Check for double prefix
    elif case.count('Test::') >= 2:
        categories['double_prefix'].append(case)
    # Check for single colon
    elif re.match(r'^Test:\s', case) or re.match(r'^\*\*Test:\s', case):
        categories['single_colon'].append(case)
    # Check for invalid variants
    elif 'TEST::' in case or re.match(r'^Test\s+-', case):
        categories['invalid_variant'].append(case)
    # Check for missing prefix (starts with number, When, Then, etc)
    elif re.match(r'^\d+\.\s+When', case) or re.match(r'^When ', case) or re.match(r'^\d+\.\s+Then', case) or '#Manual' in case or '#Automated' in case:
        categories['missing_prefix'].append(case)
    else:
        categories['missing_prefix'].append(case)

# Print summary
print("CATEGORY BREAKDOWN:")
print(f"  Correct (Test::): {len(categories['correct'])}")
print(f"  Single Colon (Test:): {len(categories['single_colon'])}")
print(f"  Missing Prefix: {len(categories['missing_prefix'])}")
print(f"  Invalid Variant (TEST::, Test -, etc): {len(categories['invalid_variant'])}")
print(f"  Double Prefix (Test:: Test::): {len(categories['double_prefix'])}")
print()

# Show examples
print("=== BEFORE → AFTER EXAMPLES (First 50 total) ===\n")

example_count = 0

if categories['correct']:
    print("CORRECT (No change needed):")
    for case in categories['correct'][:5]:
        print(f"  {case[:80]}")
    example_count += len(categories['correct'][:5])
    print()

if categories['single_colon']:
    print("SINGLE COLON (Test: → Test::):")
    for case in categories['single_colon'][:10]:
        fixed = case.replace('**Test:**', 'Test::').replace('Test:', 'Test::')
        print(f'  "{case[:70]}"')
        print(f'  → "{fixed[:70]}"')
    example_count += len(categories['single_colon'][:10])
    print()

if categories['missing_prefix']:
    print("MISSING PREFIX (Add Test::):")
    for case in categories['missing_prefix'][:15]:
        clean = re.sub(r'^\d+\.\s+', '', case)
        fixed = f"Test:: {clean}"
        print(f'  "{case[:70]}"')
        print(f'  → "{fixed[:70]}"')
    example_count += min(15, len(categories['missing_prefix']))
    print()

if categories['invalid_variant']:
    print("INVALID VARIANT (Fix prefix):")
    for case in categories['invalid_variant'][:10]:
        fixed = re.sub(r'^(.*?)(?:TEST::|Test\s+-)\s*(.*)$', r'Test:: \2', case)
        print(f'  "{case[:70]}"')
        print(f'  → "{fixed[:70]}"')
    example_count += len(categories['invalid_variant'][:10])
    print()

if categories['double_prefix']:
    print("DOUBLE PREFIX (Test:: Test:: → Test::):")
    for case in categories['double_prefix'][:5]:
        fixed = case.replace('Test:: Test::', 'Test::')
        print(f'  "{case[:70]}"')
        print(f'  → "{fixed[:70]}"')
    example_count += len(categories['double_prefix'][:5])
    print()

print(f"\n=== DRY RUN SUMMARY ===")
print(f"Total test cases: {len(all_cases)}")
print(f"Already correct: {len(categories['correct'])}")
print(f"Need updates:")
print(f"  - Missing prefix: {len(categories['missing_prefix'])}")
print(f"  - Single colon: {len(categories['single_colon'])}")
print(f"  - Invalid variant: {len(categories['invalid_variant'])}")
print(f"  - Double prefix: {len(categories['double_prefix'])}")
print(f"Total to update: {len(all_cases) - len(categories['correct'])}")
print(f"\nExamples shown: {example_count} of {len(all_cases)} total")
print("\n✅ DRY RUN COMPLETE - Awaiting approval before making changes")
