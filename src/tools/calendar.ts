import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export function registerCalendarTools(auth: OAuth2Client) {
  const calendar = google.calendar({ version: 'v3', auth });

  return {
    // List calendars
    list_calendars: async () => {
      const response = await calendar.calendarList.list();

      return {
        calendars: response.data.items?.map(cal => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary,
          timeZone: cal.timeZone,
          accessRole: cal.accessRole,
        })),
      };
    },

    // List events
    list_events: async (args: {
      calendarId?: string;
      maxResults?: number;
      timeMin?: string;
      timeMax?: string;
    }) => {
      const {
        calendarId = 'primary',
        maxResults = 10,
        timeMin,
        timeMax,
      } = args;

      const response = await calendar.events.list({
        calendarId,
        maxResults,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return {
        events: response.data.items?.map(event => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          attendees: event.attendees?.map(a => ({
            email: a.email,
            responseStatus: a.responseStatus,
          })),
          htmlLink: event.htmlLink,
        })),
      };
    },

    // Get event
    get_event: async (args: {
      calendarId?: string;
      eventId: string;
    }) => {
      const { calendarId = 'primary', eventId } = args;

      const response = await calendar.events.get({
        calendarId,
        eventId,
      });

      const event = response.data;

      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        timeZone: event.start?.timeZone,
        attendees: event.attendees?.map(a => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
          organizer: a.organizer,
        })),
        organizer: event.organizer,
        htmlLink: event.htmlLink,
        hangoutLink: event.hangoutLink,
        recurringEventId: event.recurringEventId,
      };
    },

    // Create event
    create_event: async (args: {
      calendarId?: string;
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end: string;
      attendees?: string[];
      timeZone?: string;
    }) => {
      const {
        calendarId = 'primary',
        summary,
        description,
        location,
        start,
        end,
        attendees,
        timeZone,
      } = args;

      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          location,
          start: {
            dateTime: start,
            timeZone,
          },
          end: {
            dateTime: end,
            timeZone,
          },
          attendees: attendees?.map(email => ({ email })),
        },
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime,
        end: response.data.end?.dateTime,
        htmlLink: response.data.htmlLink,
        status: 'created',
      };
    },

    // Update event
    update_event: async (args: {
      calendarId?: string;
      eventId: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: string;
      end?: string;
      attendees?: string[];
    }) => {
      const {
        calendarId = 'primary',
        eventId,
        summary,
        description,
        location,
        start,
        end,
        attendees,
      } = args;

      // Get existing event first
      const existing = await calendar.events.get({
        calendarId,
        eventId,
      });

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: {
          ...existing.data,
          summary: summary || existing.data.summary,
          description: description !== undefined ? description : existing.data.description,
          location: location !== undefined ? location : existing.data.location,
          start: start ? { dateTime: start } : existing.data.start,
          end: end ? { dateTime: end } : existing.data.end,
          attendees: attendees ? attendees.map(email => ({ email })) : existing.data.attendees,
        },
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime,
        end: response.data.end?.dateTime,
        status: 'updated',
      };
    },

    // Delete event
    delete_event: async (args: {
      calendarId?: string;
      eventId: string;
    }) => {
      const { calendarId = 'primary', eventId } = args;

      await calendar.events.delete({
        calendarId,
        eventId,
      });

      return {
        id: eventId,
        status: 'deleted',
      };
    },

    // Find free time slots
    find_free_time: async (args: {
      timeMin: string;
      timeMax: string;
      calendars?: string[];
    }) => {
      const {
        timeMin,
        timeMax,
        calendars = ['primary'],
      } = args;

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: calendars.map(id => ({ id })),
        },
      });

      return {
        timeMin,
        timeMax,
        calendars: Object.entries(response.data.calendars || {}).map(([id, data]) => ({
          calendarId: id,
          busy: data.busy?.map(slot => ({
            start: slot.start,
            end: slot.end,
          })),
          errors: data.errors,
        })),
      };
    },

    // Quick add event (natural language)
    quick_add_event: async (args: {
      calendarId?: string;
      text: string;
    }) => {
      const { calendarId = 'primary', text } = args;

      const response = await calendar.events.quickAdd({
        calendarId,
        text,
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime || response.data.start?.date,
        end: response.data.end?.dateTime || response.data.end?.date,
        htmlLink: response.data.htmlLink,
        status: 'created',
      };
    },
  };
}
