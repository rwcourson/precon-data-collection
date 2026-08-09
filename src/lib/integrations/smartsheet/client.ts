import "server-only";

/**
 * Read-only Smartsheet API client. Never POSTs mutations (add/update/delete rows).
 * Token: SMARTSHEET_ACCESS_TOKEN
 */

const API = "https://api.smartsheet.com/2.0";

export type SmartsheetConfig = {
  token: string;
};

export function smartsheetConfig(): SmartsheetConfig | null {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return { token };
}

async function ssFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Smartsheet ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export type SheetListItem = {
  id: number;
  name: string;
  accessLevel?: string;
  permalink?: string;
};

/** Lists sheets visible to the token (paginated). Read-only. */
export async function listSheets(token: string): Promise<SheetListItem[]> {
  const out: SheetListItem[] = [];
  const url = "/sheets?includeAll=true";
  // Smartsheet returns { data, pageNumber, totalPages } for some endpoints;
  // includeAll=true collapses pagination for sheets list.
  const body = (await ssFetch(url, token)) as {
    data?: SheetListItem[];
    pageNumber?: number;
    totalPages?: number;
  };
  out.push(...(body.data ?? []));
  return out;
}

/** Full sheet payload (columns + rows). Read-only GET. */
export async function getSheet(token: string, sheetId: number): Promise<unknown> {
  return ssFetch(`/sheets/${sheetId}`, token);
}

/** Lightweight whoami / token check. */
export async function getCurrentUser(token: string): Promise<{ email?: string; firstName?: string }> {
  return (await ssFetch("/users/me", token)) as { email?: string; firstName?: string };
}
