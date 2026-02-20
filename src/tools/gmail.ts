import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';

type EmailAttachmentInput = {
  filePath: string;
  filename?: string;
  mimeType?: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
};

const encodeBase64Url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const resolveMimeType = (filePath: string, overrideMimeType?: string): string => {
  if (overrideMimeType?.trim()) return overrideMimeType.trim();
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
};

const encodeAttachmentChunks = (contentBase64: string, lineLength = 76): string => {
  const chunks: string[] = [];
  for (let i = 0; i < contentBase64.length; i += lineLength) {
    chunks.push(contentBase64.slice(i, i + lineLength));
  }
  return chunks.join('\r\n');
};

type UnsubscribeMethod = {
  type: 'url' | 'mailto';
  value: string;
};

async function buildRawEmailMessage(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: EmailAttachmentInput[];
}): Promise<string> {
  const { to, subject, body, cc, bcc, attachments = [] } = args;

  const validAttachments = attachments.filter(a => a?.filePath?.trim());

  if (!validAttachments.length) {
    const headerLines = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
    ];

    const plainEmail = [...headerLines, '', body].join('\r\n');

    return encodeBase64Url(plainEmail);
  }

  const boundary = `mcp_boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const parts: string[] = [];

  const multipartHeaderLines = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  parts.push(
    [
      ...multipartHeaderLines,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      '',
    ].join('\r\n')
  );

  for (const attachment of validAttachments) {
    const absolutePath = path.resolve(attachment.filePath);
    const fileBuffer = await fs.readFile(absolutePath);
    const contentBase64 = fileBuffer.toString('base64');
    const filename = attachment.filename?.trim() || path.basename(absolutePath);
    const mimeType = resolveMimeType(absolutePath, attachment.mimeType);

    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        encodeAttachmentChunks(contentBase64),
        '',
      ].join('\r\n')
    );
  }

  parts.push(`--${boundary}--`);
  return encodeBase64Url(parts.join('\r\n'));
}

function parseListUnsubscribeHeader(value?: string): UnsubscribeMethod[] {
  if (!value?.trim()) return [];

  const methods: UnsubscribeMethod[] = [];
  const angleMatches = [...value.matchAll(/<([^>]+)>/g)].map(m => m[1]?.trim()).filter(Boolean) as string[];
  const tokens = angleMatches.length ? angleMatches : value.split(',').map(part => part.trim());

  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith('mailto:')) {
      methods.push({ type: 'mailto', value: token });
      continue;
    }
    if (token.startsWith('http://') || token.startsWith('https://')) {
      methods.push({ type: 'url', value: token });
    }
  }

  return methods;
}

function parseMailtoAddress(mailtoUri: string): string {
  try {
    const uri = new URL(mailtoUri);
    return decodeURIComponent(uri.pathname || '').trim();
  } catch {
    return mailtoUri.replace(/^mailto:/i, '').split('?')[0]?.trim() || '';
  }
}

function hasOneClickHeader(listUnsubscribePost?: string): boolean {
  return (listUnsubscribePost || '').toLowerCase().includes('list-unsubscribe=one-click');
}

export function registerGmailTools(auth: OAuth2Client) {
  const gmail = google.gmail({ version: 'v1', auth });

  return {
    // Search emails
    search_emails: async (args: {
      query: string;
      maxResults?: number;
      detail?: 'summary' | 'full';
    }) => {
      const { query, maxResults = 5, detail = 'summary' } = args;

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      const details = [];

      for (const message of messages.slice(0, maxResults)) {
        const detailResp = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        const headers = detailResp.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const snippet = (detailResp.data.snippet || '').slice(0, 200);

        if (detail === 'full') {
          details.push({
            id: message.id,
            threadId: message.threadId,
            from: getHeader('from'),
            to: getHeader('to'),
            subject: getHeader('subject'),
            date: getHeader('date'),
            snippet,
          });
        } else {
          details.push({
            id: message.id,
            from: getHeader('from'),
            subject: getHeader('subject'),
            date: getHeader('date'),
            snippet: snippet.slice(0, 120),
          });
        }
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
      attachments?: EmailAttachmentInput[];
      attachmentPaths?: string[];
    }) => {
      const { to, subject, body, cc, bcc, attachments = [], attachmentPaths = [] } = args;

      const normalizedAttachments: EmailAttachmentInput[] = [
        ...attachments,
        ...attachmentPaths.map(filePath => ({ filePath })),
      ];

      const raw = await buildRawEmailMessage({
        to,
        subject,
        body,
        cc,
        bcc,
        attachments: normalizedAttachments,
      });

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
        },
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
        attachmentsCount: normalizedAttachments.filter(a => a?.filePath?.trim()).length,
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

    // Inspect unsubscribe metadata for an email
    get_unsubscribe_options: async (args: { messageId: string }) => {
      const { messageId } = args;

      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
      });

      const headers = message.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const subject = getHeader('subject');
      const listUnsubscribe = getHeader('list-unsubscribe');
      const listUnsubscribePost = getHeader('list-unsubscribe-post');
      const methods = parseListUnsubscribeHeader(listUnsubscribe);
      const oneClick = hasOneClickHeader(listUnsubscribePost);

      return {
        id: messageId,
        from,
        subject,
        listUnsubscribe,
        listUnsubscribePost,
        oneClick,
        methods,
        recommended: methods.find(m => m.type === 'url' && m.value.startsWith('https://')) || methods[0] || null,
      };
    },

    // Attempt unsubscribe using List-Unsubscribe headers
    unsubscribe_email: async (args: {
      messageId: string;
      method?: 'auto' | 'url_one_click' | 'url_get' | 'mailto';
      dryRun?: boolean;
      allowHttp?: boolean;
    }) => {
      const { messageId, method = 'auto', dryRun = false, allowHttp = false } = args;

      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
      });

      const headers = message.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const subject = getHeader('subject');
      const listUnsubscribe = getHeader('list-unsubscribe');
      const listUnsubscribePost = getHeader('list-unsubscribe-post');
      const methods = parseListUnsubscribeHeader(listUnsubscribe);

      if (!methods.length) {
        return {
          id: messageId,
          from,
          subject,
          status: 'no_unsubscribe_header',
          detail: 'No List-Unsubscribe method found on this email.',
        };
      }

      const oneClick = hasOneClickHeader(listUnsubscribePost);
      const httpsUrlMethod = methods.find(m => m.type === 'url' && m.value.startsWith('https://'));
      const anyUrlMethod = methods.find(m => m.type === 'url');
      const mailtoMethod = methods.find(m => m.type === 'mailto');

      const selected = (() => {
        if (method === 'mailto') return mailtoMethod;
        if (method === 'url_get') return httpsUrlMethod || anyUrlMethod;
        if (method === 'url_one_click') return httpsUrlMethod;

        if (oneClick && httpsUrlMethod) return httpsUrlMethod;
        return httpsUrlMethod || anyUrlMethod || mailtoMethod;
      })();

      if (!selected) {
        return {
          id: messageId,
          from,
          subject,
          status: 'unsupported_unsubscribe_method',
          methods,
        };
      }

      if (selected.type === 'mailto') {
        const to = parseMailtoAddress(selected.value);
        const emailSubject = `Unsubscribe request${subject ? `: ${subject}` : ''}`;
        const emailBody = [
          'Please unsubscribe this address from your mailing list.',
          '',
          `Original sender: ${from || 'unknown'}`,
          `Original subject: ${subject || 'unknown'}`,
        ].join('\n');

        if (dryRun) {
          return {
            id: messageId,
            from,
            subject,
            status: 'dry_run',
            action: 'create_draft',
            to,
            draftSubject: emailSubject,
          };
        }

        const raw = await buildRawEmailMessage({
          to,
          subject: emailSubject,
          body: emailBody,
        });

        const draft = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: { message: { raw } },
        });

        return {
          id: messageId,
          from,
          subject,
          status: 'draft_created_for_manual_send',
          method: selected,
          draftId: draft.data.id,
        };
      }

      const selectedUrl = selected.value;
      const isHttp = selectedUrl.startsWith('http://');
      if (isHttp && !allowHttp) {
        return {
          id: messageId,
          from,
          subject,
          status: 'blocked_insecure_url',
          url: selectedUrl,
          detail: 'Refusing HTTP unsubscribe URL unless allowHttp=true.',
        };
      }

      const requestMode = method === 'url_get'
        ? 'get'
        : (method === 'url_one_click' || (method === 'auto' && oneClick))
          ? 'one_click_post'
          : 'get';

      if (dryRun) {
        return {
          id: messageId,
          from,
          subject,
          status: 'dry_run',
          mode: requestMode,
          url: selectedUrl,
        };
      }

      if (requestMode === 'one_click_post') {
        const postResp = await fetch(selectedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: 'List-Unsubscribe=One-Click',
          redirect: 'follow',
        });

        if (postResp.ok) {
          return {
            id: messageId,
            from,
            subject,
            status: 'unsubscribed',
            mode: 'one_click_post',
            url: selectedUrl,
            httpStatus: postResp.status,
          };
        }

        if (method === 'url_one_click') {
          return {
            id: messageId,
            from,
            subject,
            status: 'unsubscribe_failed',
            mode: 'one_click_post',
            url: selectedUrl,
            httpStatus: postResp.status,
          };
        }
      }

      const getResp = await fetch(selectedUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      return {
        id: messageId,
        from,
        subject,
        status: getResp.ok ? 'unsubscribed_or_confirmation_page_opened' : 'unsubscribe_failed',
        mode: 'url_get',
        url: selectedUrl,
        httpStatus: getResp.status,
      };
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
