# Google Workspace MCP Server

A unified Model Context Protocol (MCP) server for Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Google Slides, and Google People. Works with any MCP-compatible client including Manus, OpenClaw, Claude Desktop, Cursor, and more.

## Features

### Gmail (11 tools)
- Search emails with Gmail query syntax
- Read, send, and reply to emails
- Create drafts
- Trash emails, mark as read/unread
- List and manage labels
- Get profile information

### Calendar (8 tools)
- List calendars and events
- Create, update, and delete events
- Find free time slots
- Quick add events with natural language

### Drive (11 tools)
- List and search files
- Get file metadata and content
- Create folders, copy/move/delete files
- Share files with permissions
- Export Google Docs/Sheets/Slides
- Get storage quota

### Docs (4 tools)
- List document structure
- Read document text
- Create docs
- Append text to docs

### Sheets (4 tools)
- Read cell ranges
- Update cell ranges
- Append rows
- Create spreadsheets

### Slides (3 tools)
- Get presentation metadata
- Create presentations
- Create slides

### People (4 tools)
- List contacts
- Search contacts
- Create contacts
- Get contact details

## Installation

### Prerequisites
- Node.js 18 or higher
- Google Cloud project with Gmail, Calendar, Drive, Docs, Sheets, Slides, and People APIs enabled
- OAuth 2.0 credentials

### Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd goog-mcp
npm install
```

2. **Set up Google Cloud OAuth:**

   a. Go to [Google Cloud Console](https://console.cloud.google.com/)
   
   b. Create a new project (or use existing)
   
   c. Enable these APIs:
      - Gmail API
      - Google Calendar API
      - Google Drive API
      - Google Docs API
      - Google Sheets API
      - Google Slides API
      - Google People API
   
   d. Go to "APIs & Services" > "OAuth consent screen"
      - Choose "External" user type
      - Fill in app name and contact info
      - Add scopes:
        - `https://www.googleapis.com/auth/gmail.modify`
        - `https://www.googleapis.com/auth/calendar`
        - `https://www.googleapis.com/auth/drive`
        - `https://www.googleapis.com/auth/documents`
        - `https://www.googleapis.com/auth/spreadsheets`
        - `https://www.googleapis.com/auth/presentations`
        - `https://www.googleapis.com/auth/contacts`
      - Add yourself as a test user
   
   e. Go to "APIs & Services" > "Credentials"
      - Click "Create Credentials" > "OAuth client ID"
      - Application type: "Desktop app"
      - Download the JSON credentials
   
   f. Save credentials file:
      - Windows: `%USERPROFILE%\.google-workspace-mcp\credentials.json`
      - macOS/Linux: `~/.google-workspace-mcp/credentials.json`

3. **Build the project:**
```bash
npm run build
```

4. **Test authentication:**
```bash
npm start
```

This will open a browser window for OAuth authentication. After granting permissions, your tokens will be saved locally.

## Usage

### With Claude Desktop

Add to your Claude Desktop config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["C:\\dev\\goog-mcp\\build\\index.js"]
    }
  }
}
```

### With Manus

Configure Manus to use stdio MCP servers and add the same command as above.

### With OpenClaw

Add to your OpenClaw MCP configuration with the command path pointing to the built index.js file.

### With npx (after publishing to npm)

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["-y", "@alanx/google-workspace-mcp"]
    }
  }
}
```

## Example Commands

Once configured, you can use natural language with your AI assistant:

- "Search my unread emails from last week"
- "Send an email to john@example.com about the meeting"
- "Create a calendar event for lunch tomorrow at noon"
- "Find free time in my calendar next week"
- "List files in my Google Drive modified in the last 7 days"
- "Share document with sarah@example.com as editor"
- "Read the content of this Google Doc"
- "Append these rows to my tracking spreadsheet"
- "Create a new slide deck for tomorrow's update"
- "Find contact details for Jane in Google Contacts"

## Architecture

```
src/
├── index.ts          # Main MCP server entry point
├── auth.ts           # OAuth authentication handler
└── tools/
    ├── gmail.ts      # Gmail operations
    ├── calendar.ts   # Calendar operations
    ├── drive.ts      # Drive operations
    ├── docs.ts       # Docs operations
    ├── sheets.ts     # Sheets operations
    ├── slides.ts     # Slides operations
    └── people.ts     # Contacts operations
```

## Security

- **OAuth tokens stored locally** in `~/.google-workspace-mcp/token.json`
- **No data sent to third-party servers** - runs entirely on your machine
- **You control permissions** via Google OAuth consent screen
- **Revoke access anytime** at https://myaccount.google.com/permissions

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Build
npm run build

# Run
npm start
```

## License

MIT

## Credits

Built with:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK
- [googleapis](https://github.com/googleapis/google-api-nodejs-client) - Google APIs Node.js client
