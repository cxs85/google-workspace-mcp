#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAuthenticatedClient } from './auth.js';
import { registerGmailTools } from './tools/gmail.js';
import { registerCalendarTools } from './tools/calendar.js';
import { registerDriveTools } from './tools/drive.js';

const SERVER_NAME = 'google-workspace-mcp';
const SERVER_VERSION = '1.0.0';

// Tool definitions for MCP
const TOOL_DEFINITIONS = [
  // Gmail tools
  {
    name: 'search_emails',
    description: 'Search emails using Gmail query syntax (e.g., "is:unread", "from:example@gmail.com")',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_email',
    description: 'Read a specific email by its message ID',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'send_email',
    description: 'Send a new email',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' },
        cc: { type: 'string', description: 'CC recipients (optional)' },
        bcc: { type: 'string', description: 'BCC recipients (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'reply_to_email',
    description: 'Reply to an existing email',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID of message to reply to' },
        body: { type: 'string', description: 'Reply body text' },
      },
      required: ['messageId', 'body'],
    },
  },
  {
    name: 'create_draft',
    description: 'Create an email draft',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' },
        cc: { type: 'string', description: 'CC recipients (optional)' },
        bcc: { type: 'string', description: 'BCC recipients (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'trash_email',
    description: 'Move an email to trash',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'mark_as_read',
    description: 'Mark an email as read',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'mark_as_unread',
    description: 'Mark an email as unread',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'list_labels',
    description: 'List all Gmail labels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_label',
    description: 'Add a label to a message',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID' },
        labelId: { type: 'string', description: 'Label ID to add' },
      },
      required: ['messageId', 'labelId'],
    },
  },
  {
    name: 'get_profile',
    description: 'Get Gmail profile information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // Calendar tools
  {
    name: 'list_calendars',
    description: 'List all available calendars',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_events',
    description: 'List upcoming calendar events',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
        timeMin: { type: 'string', description: 'Start time (ISO 8601 format)' },
        timeMax: { type: 'string', description: 'End time (ISO 8601 format)' },
      },
    },
  },
  {
    name: 'get_event',
    description: 'Get details of a specific calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        eventId: { type: 'string', description: 'Event ID' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'create_event',
    description: 'Create a new calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        summary: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        start: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end: { type: 'string', description: 'End time (ISO 8601 format)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
        timeZone: { type: 'string', description: 'Time zone' },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'update_event',
    description: 'Update an existing calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        eventId: { type: 'string', description: 'Event ID' },
        summary: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        start: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end: { type: 'string', description: 'End time (ISO 8601 format)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        eventId: { type: 'string', description: 'Event ID' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'find_free_time',
    description: 'Find free time slots across calendars',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start time (ISO 8601 format)' },
        timeMax: { type: 'string', description: 'End time (ISO 8601 format)' },
        calendars: { type: 'array', items: { type: 'string' }, description: 'Calendar IDs to check' },
      },
      required: ['timeMin', 'timeMax'],
    },
  },
  {
    name: 'quick_add_event',
    description: 'Create event using natural language (e.g., "Lunch tomorrow at noon")',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        text: { type: 'string', description: 'Natural language event description' },
      },
      required: ['text'],
    },
  },

  // Drive tools
  {
    name: 'list_files',
    description: 'List files in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Drive query string' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
        orderBy: { type: 'string', description: 'Order by (e.g., "modifiedTime desc")' },
      },
    },
  },
  {
    name: 'get_file',
    description: 'Get metadata for a specific file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'search_files',
    description: 'Search files by name or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_folder',
    description: 'Create a new folder in Drive',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parentId: { type: 'string', description: 'Parent folder ID (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from Drive',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'copy_file',
    description: 'Create a copy of a file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to copy' },
        name: { type: 'string', description: 'New file name (optional)' },
        parentId: { type: 'string', description: 'Parent folder ID (optional)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'move_file',
    description: 'Move a file to a different folder',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        newParentId: { type: 'string', description: 'New parent folder ID' },
      },
      required: ['fileId', 'newParentId'],
    },
  },
  {
    name: 'share_file',
    description: 'Share a file with someone',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        email: { type: 'string', description: 'Email address to share with' },
        role: { type: 'string', enum: ['reader', 'writer', 'commenter'], description: 'Permission role' },
        sendNotification: { type: 'boolean', description: 'Send email notification' },
      },
      required: ['fileId', 'email'],
    },
  },
  {
    name: 'get_file_content',
    description: 'Get content of a text file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        mimeType: { type: 'string', description: 'MIME type (optional)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'export_file',
    description: 'Export a Google Doc/Sheet/Slides to another format',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        mimeType: { type: 'string', description: 'Export MIME type (e.g., "text/plain", "application/pdf")' },
      },
      required: ['fileId', 'mimeType'],
    },
  },
  {
    name: 'get_storage_quota',
    description: 'Get Drive storage quota information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function main() {
  console.error('Starting Google Workspace MCP Server...');

  // Initialize OAuth client
  let auth;
  try {
    auth = await getAuthenticatedClient();
    console.error('Authentication successful!');
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }

  // Register all tools
  const gmailTools = registerGmailTools(auth);
  const calendarTools = registerCalendarTools(auth);
  const driveTools = registerDriveTools(auth);

  const allTools = {
    ...gmailTools,
    ...calendarTools,
    ...driveTools,
  };

  // Create MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const tool = allTools[name as keyof typeof allTools];
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = await tool(args as any || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Google Workspace MCP Server is running!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
