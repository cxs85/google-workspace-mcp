import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export function registerSheetsTools(auth: OAuth2Client) {
  const sheets = google.sheets({ version: 'v4', auth });

  return {
    get_sheet_values: async (args: { spreadsheetId: string; range: string }) => {
      const { spreadsheetId, range } = args;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return {
        range: response.data.range,
        majorDimension: response.data.majorDimension,
        values: response.data.values || [],
      };
    },

    update_sheet_values: async (args: {
      spreadsheetId: string;
      range: string;
      values: (string | number | boolean)[][];
      valueInputOption?: 'RAW' | 'USER_ENTERED';
    }) => {
      const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = args;
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: { values },
      });

      return {
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };
    },

    append_sheet_values: async (args: {
      spreadsheetId: string;
      range: string;
      values: (string | number | boolean)[][];
      valueInputOption?: 'RAW' | 'USER_ENTERED';
    }) => {
      const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = args;
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: { values },
      });

      return {
        tableRange: response.data.tableRange,
        updates: response.data.updates,
      };
    },

    create_spreadsheet: async (args: { title: string; sheetTitle?: string }) => {
      const { title, sheetTitle = 'Sheet1' } = args;
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: sheetTitle } }],
        },
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        title: response.data.properties?.title,
      };
    },
  };
}
