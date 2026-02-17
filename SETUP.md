# Quick Setup Guide
## What You Built
A unified Google Workspace MCP server with **45 tools** across:
- **Gmail**: 11 tools (search, send, reply, drafts, labels, etc.)
- **Calendar**: 8 tools (events, free time, natural language creation)
- **Drive**: 11 tools (files, folders, sharing, content, export)
- **Docs**: 4 tools (structure, read, create, append)
- **Sheets**: 4 tools (read, update, append, create)
- **Slides**: 3 tools (get, create presentation, create slide)
- **People**: 4 tools (list/search/create/get contacts)
## Next Steps
### 1. Set Up Google OAuth Credentials
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Google People API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Desktop app**
   - Download the JSON file
5. Save credentials:
   ```powershell
   # Create directory
   mkdir $env:USERPROFILE\.google-workspace-mcp
   
   # Copy your downloaded credentials JSON to:
   # %USERPROFILE%\.google-workspace-mcp\credentials.json
   ```
### 2. Test Authentication
```powershell
cd C:\dev\goog-mcp
npm start
```
This will:
- Open your browser for OAuth
- Save tokens locally
- Start the MCP server
### 3. Configure Your MCP Clients
#### For Manus
Add to your Manus MCP configuration:
```json
{
  "google-workspace": {
    "command": "node",
    "args": ["C:\\dev\\goog-mcp\\build\\index.js"]
  }
}
```
#### For OpenClaw
Add to OpenClaw MCP settings:
```json
{
  "google-workspace": {
    "command": "node",
    "args": ["C:\\dev\\goog-mcp\\build\\index.js"]
  }
}
```
#### For Claude Desktop
Edit: `%APPDATA%\Claude\claude_desktop_config.json`
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
## Available Tools
### Gmail
- `search_emails` - Search with Gmail syntax
- `read_email` - Read specific message
- `send_email` - Send new email
- `reply_to_email` - Reply to message
- `create_draft` - Create draft
- `trash_email` - Move to trash
- `mark_as_read` / `mark_as_unread`
- `list_labels` - List all labels
- `add_label` - Add label to message
- `get_profile` - Get account info
### Calendar
- `list_calendars` - List all calendars
- `list_events` - List events
- `get_event` - Get event details
- `create_event` - Create event
- `update_event` - Update event
- `delete_event` - Delete event
- `find_free_time` - Find availability
- `quick_add_event` - Natural language ("Lunch tomorrow noon")
### Drive
- `list_files` - List files
- `get_file` - Get metadata
- `search_files` - Search by name/content
- `create_folder` - Create folder
- `delete_file` - Delete file
- `copy_file` - Copy file
- `move_file` - Move file
- `share_file` - Share with permissions
- `get_file_content` - Read text files
- `export_file` - Export to other formats
- `get_storage_quota` - Check storage
### Docs
- `list_doc_structure` - Inspect document structure
- `read_doc_text` - Read full document text
- `create_doc` - Create a document
- `append_doc_text` - Append content to a doc
### Sheets
- `get_sheet_values` - Read sheet ranges
- `update_sheet_values` - Update cell ranges
- `append_sheet_values` - Append rows
- `create_spreadsheet` - Create a spreadsheet
### Slides
- `get_presentation` - Get presentation details
- `create_presentation` - Create a presentation
- `create_slide` - Add a slide
### People
- `list_contacts` - List contacts
- `search_contacts` - Search contacts
- `create_contact` - Create contact
- `get_contact` - Get contact details
## Example Usage
Once configured, you can use natural language:
- "Show me unread emails from last week"
- "Send an email to john@example.com about the project update"
- "Create a meeting tomorrow at 2pm for 1 hour"
- "Find free time in my calendar next Monday"
- "List my recent Drive files"
- "Share document X with sarah@example.com as editor"
- "Read this Google Doc and summarize it"
- "Add these rows to my Google Sheet"
- "Create a slides deck called Q1 Review"
- "Find Jane's contact card"
## Security
✅ **Local execution** - Runs on your machine
✅ **OAuth tokens stored locally** - `~/.google-workspace-mcp/token.json`
✅ **No third-party servers** - Direct Google API access
✅ **Revocable access** - [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
## Development
```powershell
# Watch mode (auto-rebuild)
npm run watch

# Build
npm run build

# Run
npm start
```
## File Locations
- **Credentials**: `%USERPROFILE%\.google-workspace-mcp\credentials.json`
- **Tokens**: `%USERPROFILE%\.google-workspace-mcp\token.json`
- **Built server**: `C:\dev\goog-mcp\build\index.js`
## Troubleshooting
### "Credentials file not found"
Make sure credentials.json is in the right location:
```powershell
dir $env:USERPROFILE\.google-workspace-mcp\credentials.json
```
### "Authentication failed"
Delete token.json and re-authenticate:
```powershell
del $env:USERPROFILE\.google-workspace-mcp\token.json
npm start
```
### Port 4100 already in use
Close the process using port 4100 or change `REDIRECT_PORT` in `src/auth.ts`.
