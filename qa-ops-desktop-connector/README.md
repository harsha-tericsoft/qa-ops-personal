# QA Ops Desktop Connector

Bridge your local Roam graph to the cloud-based QA Ops application.

**Status:** Milestone 1 - Foundation Complete ✅

---

## Architecture

- **Framework:** Express.js (Node.js)
- **Language:** TypeScript
- **Roam Integration:** Roam CLI (battle-tested approach)
- **Architecture:** Separate standalone project (not global npm package yet)
- **Deployment:** Local machine only (localhost:7890)

---

## What's Included (Milestone 1)

✅ Project structure with TypeScript
✅ Express server on localhost:7890
✅ Health check endpoint: `GET /health`
✅ Version endpoint: `GET /version`
✅ Configuration manager framework
✅ Logging framework
✅ Error handling infrastructure
✅ Graceful shutdown handling
✅ CORS for localhost

---

## Requirements

- **Node.js** 18+ or 20 LTS
- **npm** 9+
- **Roam Desktop** running locally (for later milestones)
- **Roam CLI** installed globally (for later milestones)

---

## Quick Start

### 1. Install Dependencies

```bash
cd qa-ops-desktop-connector
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Run in Development Mode

```bash
npm run dev
```

Expected output:
```
[2026-06-30T12:00:00.000Z] [INFO] [server] Server started on http://127.0.0.1:7890
[2026-06-30T12:00:00.000Z] [INFO] [main] =============================================================
[2026-06-30T12:00:00.000Z] [INFO] [main] Desktop Connector Ready
[2026-06-30T12:00:00.000Z] [INFO] [main] =============================================================
```

### 4. Test the Server

In another terminal:

```bash
# Test health endpoint
curl http://localhost:7890/health

# Test version endpoint
curl http://localhost:7890/version

# Get API info
curl http://localhost:7890/
```

### 5. Stop the Server

Press `Ctrl+C` in the terminal. The server will shut down gracefully.

---

## Project Structure

```
qa-ops-desktop-connector/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── README.md                 # This file
├── src/
│   ├── index.ts              # Main entry point
│   ├── server.ts             # Express server setup
│   ├── config/
│   │   └── manager.ts        # Configuration management
│   ├── api/
│   │   └── routes.ts         # API route definitions
│   ├── cli/
│   │   └── setup.ts          # Setup wizard (framework)
│   ├── logging/
│   │   └── logger.ts         # Logging framework
│   └── utils/
│       └── errors.ts         # Error types and handling
├── dist/                     # Compiled JavaScript (after build)
└── node_modules/             # Dependencies (after npm install)
```

---

## Available Scripts

### Development

```bash
npm run dev          # Run in development mode (with ts-node)
npm run type-check   # Check TypeScript without building
npm run clean        # Remove dist/ directory
```

### Production

```bash
npm run build        # Build TypeScript to JavaScript
npm start            # Run compiled JavaScript
```

### Setup (Future Milestones)

```bash
npm run setup        # Interactive setup wizard
```

---

## API Endpoints (Milestone 1)

### GET /

Returns API information.

**Response:**
```json
{
  "name": "QA Ops Desktop Connector",
  "status": "running",
  "endpoints": {
    "health": "GET /health",
    "version": "GET /version"
  },
  "timestamp": "2026-06-30T12:00:00.000Z"
}
```

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-30T12:00:00.000Z",
  "uptime": 123.456,
  "pid": 12345,
  "nodeVersion": "v20.10.0"
}
```

### GET /version

Current version information.

**Response:**
```json
{
  "name": "qa-ops-desktop-connector",
  "version": "0.1.0",
  "description": "Desktop Connector for QA Ops",
  "timestamp": "2026-06-30T12:00:00.000Z"
}
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

**Available variables:**

```
PORT=7890                                    # Server port (default: 7890)
HOST=127.0.0.1                              # Server host (default: 127.0.0.1)
NODE_ENV=development                        # Environment (development/production)
BACKEND_URL=http://localhost:3000           # QA Ops backend URL
LOG_LEVEL=info                              # Logging level (debug/info/warn/error)
LOG_DIR=~/.qa-ops-bridge/logs               # Log file directory
CONFIG_DIR=~/.qa-ops-bridge                 # Config directory
```

### Configuration File (Future)

Configuration will be stored in `~/.qa-ops-bridge/config.json` (Milestone 2+).

---

## Logging

### Log Output

Logs are printed to console in development mode:

```
[2026-06-30T12:00:00.000Z] [INFO] [server] Middleware configured
[2026-06-30T12:00:00.000Z] [INFO] [routes] Routes configured
[2026-06-30T12:00:00.000Z] [INFO] [server] Server started on http://127.0.0.1:7890
[2026-06-30T12:00:00.000Z] [INFO] [main] Desktop Connector Ready
```

### Log Levels

- `debug` - Detailed debugging information
- `info` - General information messages
- `warn` - Warning messages
- `error` - Error messages

Control log level with `LOG_LEVEL` environment variable.

---

## Error Handling

The connector handles errors gracefully:

1. **Runtime Errors** - Logged and reported with error code
2. **Uncaught Exceptions** - Logged and process exits with code 1
3. **Unhandled Promise Rejections** - Logged and process exits with code 1
4. **Graceful Shutdown** - SIGTERM and SIGINT signals handled cleanly

---

## Development Notes

### TypeScript

The project uses strict TypeScript configuration:

```bash
npm run type-check   # Check types without building
npm run build        # Build TypeScript to JavaScript
```

### Testing Endpoints

Use `curl` or Postman:

```bash
# Health check
curl -X GET http://localhost:7890/health -H "Content-Type: application/json"

# Version
curl -X GET http://localhost:7890/version -H "Content-Type: application/json"

# Root
curl -X GET http://localhost:7890/ -H "Content-Type: application/json"
```

---

## Roadmap

### Milestone 1 ✅ DONE
- [x] Project setup and structure
- [x] Express server framework
- [x] Health and version endpoints
- [x] Configuration manager framework
- [x] Logging framework
- [x] Error handling

### Milestone 2 (Next)
- [ ] Express server running
- [ ] Authentication middleware
- [ ] Bridge registration with backend
- [ ] Heartbeat mechanism

### Milestone 3
- [ ] Roam CLI integration
- [ ] /api/roam/sync endpoint
- [ ] /api/roam/test-connection endpoint

### Milestone 4
- [ ] Backend registration flow
- [ ] Token management
- [ ] Health monitoring

### Milestone 5
- [ ] File-based logging
- [ ] Sensitive data masking
- [ ] Error tracking

### Milestone 6
- [ ] CLI commands: setup, start, status, logs

---

## Troubleshooting

### Port Already in Use

If port 7890 is already in use:

```bash
# Check what's using the port
lsof -i :7890  # macOS/Linux
netstat -ano | findstr :7890  # Windows

# Use different port
PORT=7891 npm run dev
```

### TypeScript Errors

```bash
npm run type-check   # Check for type errors
npm run build        # Full build with error reporting
```

### Dependencies Issues

```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Support

For issues, questions, or suggestions:

1. Check the logs for error messages
2. Verify all dependencies are installed: `npm install`
3. Ensure Roam Desktop is running (for later milestones)
4. Check port 7890 is not in use

---

## License

MIT

---

**Last Updated:** Milestone 1 Foundation  
**Status:** Ready for Milestone 2 Development
