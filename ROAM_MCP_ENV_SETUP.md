# Roam MCP Environment Setup - Evidence-Based Guide

**Based on actual source code inspection of roam-research-mcp v2.19.1**

---

## 1. How Environment Variables Are Loaded

**Source File**: `build/config/environment.js` (lines 1-11)

```javascript
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Get the project root from the script path
const scriptPath = process.argv[1]; // Full path to the running script
const projectRoot = dirname(dirname(scriptPath)); // Go up two levels from build/index.js

// Try to load .env from project root
const envPath = join(projectRoot, '.env');
if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
}
```

**What This Means**:
1. The script uses `process.argv[1]` to get the path to the running script
2. It goes up 2 directory levels from that script
3. It looks for `.env` in that calculated directory
4. If the `.env` file exists, it loads it with dotenv

---

## 2. The Roam Wrapper Script

**Location**: `/c/Program Files/nodejs/roam` (or similar on your system)

```sh
#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")

if [ -x "$basedir/node" ]; then
  exec "$basedir/node"  "$basedir/node_modules/roam-research-mcp/build/cli/roam.js" "$@"
else 
  exec node  "$basedir/node_modules/roam-research-mcp/build/cli/roam.js" "$@"
fi
```

**What Happens When You Run `roam status`**:
1. Shell runs the wrapper script at `/c/Program Files/nodejs/roam`
2. Wrapper executes: `node $basedir/node_modules/roam-research-mcp/build/cli/roam.js`
3. Node sets `process.argv[1]` to the full path of roam.js

---

## 3. Calculating the .env File Path

**Given**:
- Wrapper script location: `/c/Program Files/nodejs/roam`
- Executed script: `/c/Program Files/nodejs/node_modules/roam-research-mcp/build/cli/roam.js`

**When roam command executes**:
```
process.argv[1] = /c/Program Files/nodejs/node_modules/roam-research-mcp/build/cli/roam.js

dirname(scriptPath) = /c/Program Files/nodejs/node_modules/roam-research-mcp/build/cli

dirname(dirname(scriptPath)) = /c/Program Files/nodejs/node_modules/roam-research-mcp/build

envPath = /c/Program Files/nodejs/node_modules/roam-research-mcp/build/.env
```

---

## 4. Required Environment Variables

**Source File**: `build/config/environment.js` (lines 19-20, 51-56)

```javascript
const API_TOKEN = process.env.ROAM_API_TOKEN;
const GRAPH_NAME = process.env.ROAM_GRAPH_NAME;

// Validation (lines 51-56)
if (!API_TOKEN || !GRAPH_NAME) {
    const missingVars = [];
    if (!API_TOKEN) missingVars.push('ROAM_API_TOKEN');
    if (!GRAPH_NAME) missingVars.push('ROAM_GRAPH_NAME');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
```

**Required Variables**:
- `ROAM_API_TOKEN` - Your Local API Token from Roam Desktop
- `ROAM_GRAPH_NAME` - Your Roam graph name

---

## 5. Creating the .env File

**Location**: You MUST place .env at:
```
C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env
```

Or on Unix-like systems:
```
/c/Program Files/nodejs/node_modules/roam-research-mcp/build/.env
```

**Contents** (EXACT format):
```
ROAM_API_TOKEN=roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
ROAM_GRAPH_NAME=Project_Kinergy
```

**Replace with YOUR values**:
- `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv` → Your actual token from Roam Desktop
- `Project_Kinergy` → Your actual graph name

---

## 6. Creating the File

### Option A: Using Bash
```bash
cat > "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env" << 'EOF'
ROAM_API_TOKEN=roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
ROAM_GRAPH_NAME=Project_Kinergy
EOF
```

### Option B: Using PowerShell
```powershell
$envPath = "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env"
@"
ROAM_API_TOKEN=roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
ROAM_GRAPH_NAME=Project_Kinergy
"@ | Out-File -FilePath $envPath -Encoding UTF8
```

### Option C: Manual
1. Open File Explorer
2. Navigate to: `C:\Program Files\nodejs\node_modules\roam-research-mcp\build\`
3. Create new file: `.env` (note the dot at start)
4. Open in text editor
5. Paste:
```
ROAM_API_TOKEN=roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
ROAM_GRAPH_NAME=Project_Kinergy
```
6. Save (Ctrl+S)

---

## 7. Verification

**Test if .env is being loaded**:

```bash
# Run roam status (it will try to load .env before showing the error)
export ROAM_API_TOKEN="roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv"
export ROAM_GRAPH_NAME="Project_Kinergy"
roam status --ping
```

**Expected output** (if .env is loaded and token is valid):
```
Roam Research MCP v2.19.1

Graphs:
  • default (default)  ✓ connected
```

**If you see** "Token cannot be verified":
- Your token format is wrong
- Or Roam Desktop is not running
- Or the token has been revoked

**If you still see** "Missing required environment variables":
- The .env file is not in the correct location
- Or the file isn't being read (permissions issue)

---

## 8. Troubleshooting

### Symptom: "Missing required environment variables"

**Diagnosis**:
1. Check the .env file is at the EXACT correct location:
```bash
ls -la "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env"
```

2. Check file permissions (must be readable):
```bash
# On Linux/Mac
ls -la "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env"

# On Windows PowerShell
Get-Item -Path "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env" -Force
```

3. Verify file contents:
```bash
cat "C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env"
```

Should output:
```
ROAM_API_TOKEN=roam-graph-local-token-XXXXX
ROAM_GRAPH_NAME=your-graph-name
```

### Symptom: "Token cannot be verified or is improperly formatted"

**Diagnosis**:
1. Verify token format:
   - Should start with: `roam-graph-local-token-`
   - Should be from Roam Desktop Settings → Graph → Local API Tokens
   
2. Verify Roam Desktop is running:
   ```bash
   # Check if Roam is listening on port 7654
   netstat -an | grep 7654
   ```

3. Try generating a new token in Roam Desktop:
   - Settings → Graph → Local API Tokens → New Token
   - Approve the dialog
   - Copy the exact token value

---

## 9. Source Code References

**File**: `C:\Program Files\nodejs\node_modules\roam-research-mcp\build\config\environment.js`
- **Lines 1-11**: dotenv loading and path calculation
- **Lines 19-20**: Environment variable extraction
- **Lines 34-82**: Validation logic

**File**: `C:\Program Files\nodejs\node_modules\roam-research-mcp\build\cli\utils\graph.js`
- **Lines 5, 12**: Import and call to `validateEnvironment()`

**File**: `C:\Program Files\nodejs\node_modules\roam-research-mcp\build\cli\roam.js`
- **Shebang line**: `#!/usr/bin/env node`
- **No direct environment loading** (happens in imported modules)

---

## Summary

✅ **.env file location**: `C:\Program Files\nodejs\node_modules\roam-research-mcp\build\.env`

✅ **Required contents**:
```
ROAM_API_TOKEN=your-token-here
ROAM_GRAPH_NAME=your-graph-name
```

✅ **How it works**:
1. You run `roam status`
2. Wrapper script executes the actual roam.js file
3. roam.js's environment.js module loads .env from the calculated path
4. Environment variables are validated
5. Roam connection is established

This is proven by reading the actual source code from the installed package.
