/**
 * Google Sheets append (서버 전용).
 * 서비스 계정 JSON 또는 client_email + private_key 환경변수 필요.
 * 스프레드시트는 해당 서비스 계정 이메일에 편집 권한 공유.
 */

import { google } from "googleapis";

function getCredentials(): { client_email: string; private_key: string } | null {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const j = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
      if (j.client_email && j.private_key) {
        return { client_email: j.client_email, private_key: j.private_key };
      }
    } catch {
      return null;
    }
  }
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) return { client_email: email, private_key: key };
  return null;
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() && getCredentials());
}

export function shouldSkipSheetAppend(): boolean {
  console.log("[sheets] raw env =", process.env.GOOGLE_SHEETS_SKIP_APPEND);
  const raw = process.env.GOOGLE_SHEETS_SKIP_APPEND?.toLowerCase().trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * AI_예약로그 탭(또는 env로 지정)에 한 행 append.
 * @param values 한 행 (열 순서는 시트 1행 헤더와 맞출 것)
 */
export async function appendSheetRow(values: string[]): Promise<void> {
  if (shouldSkipSheetAppend()) {
    console.warn("[google-sheets] GOOGLE_SHEETS_SKIP_APPEND: append skipped");
    return;
  }
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  }
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "Google credentials missing: set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY",
    );
  }

  const tab =
    process.env.GOOGLE_SHEETS_AI_RESERVATION_TAB?.trim() || "AI_예약로그";
  const range = `'${tab.replace(/'/g, "''")}'!A:Z`;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

/** 승인 시트 기본 컬럼 순서 (헤더는 시트 1행에 수동 정렬) */
export function buildAiReservationLogRow(input: {
  reviewedAtIso: string;
  callId: string | null;
  phone: string | null;
  guestName: string | null;
  checkInDate: string;
  checkInTime: string | null;
  roomType: string | null;
  occupancy: number | null;
  status: string;
  memo: string | null;
  reviewer: string | null;
  source: string;
}): string[] {
  return [
    input.reviewedAtIso,
    input.callId ?? "",
    input.phone ?? "",
    input.guestName ?? "",
    input.checkInDate,
    input.checkInTime ?? "",
    input.roomType ?? "",
    input.occupancy != null ? String(input.occupancy) : "",
    input.status,
    input.memo ?? "",
    input.reviewer ?? "",
    input.source,
  ];
}
