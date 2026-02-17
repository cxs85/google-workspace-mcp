import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export function registerGmailTools(auth: OAuth2Client) {
  const gmail = google.gmail({ version: 'v1', auth });

  return {
    // Search emails
    search_emails: async (args: {
      query: string;
      maxResults?: number;
    }) => {
      const { query, maxResults = 10 } = args;
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      const details = [];

      for (const message of messages.slice(0, maxResults)) {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        const headers = detail.data.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        details.push({
          id: message.id,
          threadId: message.threadId,
          from: getHeader('from'),
          to: getHeader('to'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          snippet: detail.data.snippet,
        });
      }

      return {
        count: details.length,
        messages: details,
      };
    },

    // Read email
    read_email: async (args: { messageId: string }) => {
      const { messageId } = args;

      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = message.data.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body
      let body = '';
      const parts = message.data.payload?.parts || [message.data.payload];
      
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: message.data.id,
        threadId: message.data.threadId,
        from: getHeader('from'),
        to: getHeader('to'),
        cc: getHeader('cc'),
        subject: getHeader('subject'),
        date: getHeader('date'),
        body: body || message.data.snippet,
        labels: message.data.labelIds,
      };
    },

    // Send email
    send_email: async (args: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }) => {
      const { to, subject, body, cc, bcc } = args;

      const email = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${subject}`,
        '',
        body,
      ].filter(Boolean).join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
      };
    },

    // Reply to email
    reply_to_email: async (args: {
      messageId: string;
      body: string;
    }) => {
      const { messageId, body } = args;

      // Get original message to extract thread and recipient info
      const original = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Message-ID'],
      });

      const headers = original.data.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const subject = getHeader('subject');
      const messageIdHeader = getHeader('message-id');

      const email = [
        `To: ${from}`,
        `Subject: Re: ${subject.replace(/^Re: /i, '')}`,
        `In-Reply-To: ${messageIdHeader}`,
        `References: ${messageIdHeader}`,
        '',
        body,
      ].join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: original.data.threadId,
        },
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
      };
    },

    // Create draft
    create_draft: async (args: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }) => {
      const { to, subject, body, cc, bcc } = args;

      const email = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${subject}`,
        '',
        body,
      ].filter(Boolean).join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });

      return {
        id: response.data.id,
        message: response.data.message,
        status: 'draft_created',
      };
    },

    // Delete/trash email
    trash_email: async (args: { messageId: string }) => {
      const { messageId } = args;

      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });

      return { id: messageId, status: 'trashed' };
    },

    // Mark as read/unread
    mark_as_read: async (args: { messageId: string }) => {
      const { messageId } = args;

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });

      return { id: messageId, status: 'marked_read' };
    },

    mark_as_unread: async (args: { messageId: string }) => {
      const { messageId } = args;

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD'],
        },
      });

      return { id: messageId, status: 'marked_unread' };
    },

    // List labels
    list_labels: async () => {
      const response = await gmail.users.labels.list({
        userId: 'me',
      });

      return {
        labels: response.data.labels?.map(label => ({
          id: label.id,
          name: label.name,
          type: label.type,
        })),
      };
    },

    // Add label to message
    add_label: async (args: { messageId: string; labelId: string }) => {
      const { messageId, labelId } = args;

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });

      return { id: messageId, labelId, status: 'label_added' };
    },

    // Get profile info
    get_profile: async () => {
      const response = await gmail.users.getProfile({
        userId: 'me',
      });

      return {
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal,
        historyId: response.data.historyId,
      };
    },
  };
}
