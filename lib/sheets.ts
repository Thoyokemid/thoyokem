import { google, sheets_v4 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Reused across requests on the same warm serverless instance — building a fresh
// GoogleAuth (and re-fetching an OAuth token from Google) on every single sheet
// call was adding avoidable latency and occasional transient failures under load,
// which surfaced in the UI as pages randomly showing "no data" that was actually
// just a swallowed fetch error. Auth libraries handle their own token refresh
// internally, so a long-lived client is safe to reuse.
let cachedSheetsClient: sheets_v4.Sheets | null = null;

export async function getGoogleSheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });

  cachedSheetsClient = google.sheets({ version: 'v4', auth });
  return cachedSheetsClient;
}

// Retries a transient Google API failure (network blip, momentary rate limit) once
// after a short delay before giving up. Non-transient errors (bad range, auth
// misconfig) still throw immediately — no point retrying those.
async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.code || error?.response?.status;
    const isTransient = status === 429 || status === 500 || status === 503 || !status;
    if (retries > 0 && isTransient) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

export async function readSheet(sheetName: string, range?: string) {
  try {
    return await withRetry(async () => {
      const sheets = await getGoogleSheetsClient();
      const fullRange = range ? `${sheetName}!${range}` : sheetName;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: fullRange,
      });

      return response.data.values || [];
    });
  } catch (error) {
    console.error('Error reading sheet:', error);
    throw error;
  }
}

export async function writeSheet(sheetName: string, range: string, values: any[][]) {
  try {
    const sheets = await getGoogleSheetsClient();
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error writing to sheet:', error);
    throw error;
  }
}

export async function appendSheet(sheetName: string, values: any[][]) {
  try {
    const sheets = await getGoogleSheetsClient();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error appending to sheet:', error);
    throw error;
  }
}

/**
 * Clear all data rows (keep header row) then write new data.
 * Used for replacing attendance import data entirely.
 */
export async function clearAndWriteSheet(sheetName: string, values: any[][]) {
  try {
    const sheets = await getGoogleSheetsClient();

    // Read existing data to get header row
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: sheetName,
    });

    const existingRows = existing.data.values || [];
    const headerRow = existingRows.length > 0 ? existingRows[0] : [];

    // Clear entire sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: sheetName,
    });

    // Write header + new data
    const allRows = [headerRow, ...values];
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: allRows,
      },
    });

    return true;
  } catch (error) {
    console.error('Error clearing and writing sheet:', error);
    throw error;
  }
}

/**
 * Read a sheet and return both the header row and each data row parsed as an
 * object keyed by header name (instead of relying on column position).
 * This way, reordering/inserting columns in the actual Google Sheet does not
 * break the app — only the header *names* matter.
 */
export async function readSheetAsObjects<T = Record<string, any>>(
  sheetName: string
): Promise<{ headers: string[]; records: T[] }> {
  const rows = await readSheet(sheetName);

  if (!rows || rows.length < 1) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((h: any) => String(h ?? '').trim());

  const records = rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = row[i] ?? '';
    });
    return obj as T;
  });

  return { headers, records };
}

/**
 * Convert a plain object into a row array ordered to match the sheet's
 * existing header row, so writes always land in the correct column
 * regardless of how the object's keys were ordered in code.
 */
export function objectToRow(headers: string[], obj: Record<string, any>): any[] {
  return headers.map((header) => obj[header] ?? '');
}

/**
 * Find the 0-based data-row index (i.e. index into rows.slice(1)) whose
 * value in `idField` column matches `idValue`. Returns -1 if not found.
 */
export function findRowIndexByField(
  headers: string[],
  rows: any[][],
  idField: string,
  idValue: string
): number {
  const colIndex = headers.indexOf(idField);
  if (colIndex === -1) return -1;
  return rows.slice(1).findIndex((row) => String(row[colIndex] ?? '') === String(idValue));
}

/**
 * Create a new sheet tab with the given header row if it doesn't already exist.
 * Safe to call multiple times — no-op if the sheet is already there.
 */
export async function ensureSheetExists(sheetName: string, headers: string[]) {
  const sheets = await getGoogleSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
  });

  const exists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === sheetName
  );

  if (exists) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });

  await writeSheet(sheetName, 'A1', [headers]);

  return true;
}

export async function deleteRow(sheetName: string, rowIndex: number) {
  try {
    const sheets = await getGoogleSheetsClient();
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });

    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );

    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error('Sheet not found');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting row:', error);
    throw error;
  }
}