# MCP Servers Setup Guide

This project is configured with four MCP (Model Context Protocol) servers. Here's how to set them up.

## Files Created

- `.mcp.json` - MCP server configurations
- `.claude/settings.json` - Claude Code settings for MCP enablement
- `.env.example` - Template for required environment variables

## Important Note on MCP Server Availability

The official Anthropic MCP servers for Jira and Vercel may not be available on NPM yet. Here are the recommended alternatives:

## Installation Options

### Option 1: Git MCP (✓ Available)

Git is typically available as a system command. No installation needed.

### Option 2: Playwright MCP (✓ Available via @playwright/test)

Already installed in this project's devDependencies. Claude can interact with your Playwright tests directly.

```bash
# Ensure Playwright browsers are installed
npx playwright install
```

### Option 3: Jira MCP (Community/Custom)

For Jira integration, you have two options:

**Option A: Use Claude directly with Jira API**
- Set `JIRA_HOST`, `JIRA_USERNAME`, `JIRA_API_TOKEN` in `.env`
- Ask Claude to create scripts that use Jira REST API via axios (already installed)

**Option B: Install community MCP (if available)**
```bash
# Check if a community Jira MCP is available
npm search mcp jira
```

### Option 4: Vercel MCP (Community/Custom)

For Vercel integration:

**Option A: Use Claude directly with Vercel API**
- Set `VERCEL_API_TOKEN` in `.env`
- Ask Claude to create scripts that use Vercel REST API

**Option B: Install via Vercel CLI**
```bash
npm install --save-dev vercel
```

Then Claude can run Vercel CLI commands directly.

## Recommended Setup

Given the current MCP ecosystem, here's what to install:

```bash
# Essential
npx playwright install

# Optional - Vercel CLI for better Vercel integration
npm install --save-dev vercel
```

## Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Jira - for API-based integration
JIRA_HOST=https://your-jira-instance.atlassian.net
JIRA_USERNAME=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Vercel - for API-based integration
VERCEL_API_TOKEN=your-vercel-api-token
```

### Getting Credentials

**Jira API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create a new API token
3. Copy and paste into `.env`

**Vercel API Token:**
1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy and paste into `.env`

## MCP Servers Overview & Usage

### 1. **Git** (System Command)
- **Status**: ✓ Ready to use
- **What it does**: 
  - View commit history
  - Check repository status
  - Examine changes and branches
  - Read file versions at specific commits

**Ask Claude:**
```
"Show me the last 5 commits"
"What changes were made to lib/prisma.ts?"
"Compare this file with the version from 3 commits ago"
```

### 2. **Playwright** (Available via @playwright/test)
- **Status**: ✓ Ready after `npx playwright install`
- **What it does**:
  - Create browser automation tests
  - Run end-to-end tests
  - Interact with web applications programmatically

**Ask Claude:**
```
"Create a Playwright test that logs in and verifies the dashboard"
"Run the Playwright tests and show me any failures"
"Write a test that checks if the form validation works"
```

### 3. **Jira** (API-based Integration)
- **Status**: ⚠️ Works via REST API
- **What you can do**:
  - Query issues via API
  - Create/update tickets via API
  - Search for specific issues
  
**Ask Claude:**
```
"Create a script that lists all open Jira issues in the QA-OPS project"
"Write a script to create a Jira ticket for this bug"
"Find all tickets assigned to me"
```

### 4. **Vercel** (CLI + API)
- **Status**: ⚠️ Works via Vercel CLI and REST API
- **What you can do**:
  - Deploy projects
  - Check deployment status
  - Manage environment variables
  - View logs

**Ask Claude:**
```
"Deploy the current branch to Vercel preview"
"Show me the deployment logs"
"Set an environment variable in production"
```

## Usage With Claude Code

Once configured, use Claude Code as follows:

### For Git Operations
Claude can run git commands directly. Just ask:
```
"Show me the recent commits"
"Who last modified the database schema?"
"Create a git commit with these changes"
```

### For Playwright Tests
Claude can write and run tests:
```
"Write a test for the login flow"
"Run all Playwright tests in the tests directory"
"Show me which tests are failing"
```

### For Jira (via Scripts)
Ask Claude to create automation scripts:
```
"Create a script that exports all open bugs as CSV"
"Write a script to bulk update tickets in sprint 5"
"Generate a report of all resolved issues this week"
```

### For Vercel (via CLI)
Ask Claude to use the Vercel CLI:
```
"Deploy this to preview"
"Show me the latest 5 deployments"
"Set DATABASE_URL in production"
```

## Advanced: Setting Up Custom MCPs

If you need full MCP support for Jira or Vercel, you can:

1. **Clone an existing MCP server**: https://github.com/anthropics/mcp-servers
2. **Create your own MCP**: Use the [MCP SDK](https://modelcontextprotocol.io/)
3. **Use community MCPs**: Search GitHub for `mcp-server-jira` or `mcp-server-vercel`

Example custom MCP entry in `.mcp.json`:
```json
{
  "custom-jira": {
    "command": "node",
    "args": ["./path/to/jira-mcp-server.js"],
    "env": {
      "JIRA_HOST": "${JIRA_HOST}",
      "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
    }
  }
}
```

## Troubleshooting

### MCP Servers Not Found
1. Check `.mcp.json` syntax is valid JSON
2. Verify commands are in your PATH (run `which git`, `which npx`)
3. Ensure environment variables are set in `.env`

### "Command not found" errors
- Run `npm install` to ensure all dependencies are present
- Check your PATH includes npm binaries
- For Windows: Restart your terminal after installing packages

### Playwright browser issues
- Run `npx playwright install` to download browsers
- Check you have enough disk space (browsers ~1GB total)

### Jira/Vercel API errors
- Verify API tokens are correct and not expired
- Check token has appropriate permissions
- Ensure JIRA_HOST is correct (include https://)

## Next Steps

1. ✓ Configuration files created (`.mcp.json`, `.claude/settings.json`)
2. Run `npx playwright install` to set up Playwright
3. (Optional) Install Vercel CLI: `npm install --save-dev vercel`
4. Create `.env` file with your credentials
5. Restart Claude Code
6. Test by asking Claude to use each tool

## References

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Anthropic MCP Servers](https://github.com/anthropics/mcp-servers)
- [Playwright Documentation](https://playwright.dev/)
- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Jira REST API Docs](https://developer.atlassian.com/cloud/jira/rest/)
