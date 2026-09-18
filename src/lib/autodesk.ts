import { env } from "@/lib/env";

/** Autodesk Platform Services (ACC) OAuth + Data Management helpers. */

const APS_BASE = "https://developer.api.autodesk.com";
const APS_SCOPES = "data:read";

export type AutodeskTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export type AutodeskHub = { id: string; attributes: { name: string } };
export type AutodeskProject = { id: string; attributes: { name: string } };

type JsonApiResource = {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

type JsonApiList<T> = { data: T[] };

export function isAutodeskConfigured(): boolean {
  return !!(process.env.AUTODESK_CLIENT_ID && process.env.AUTODESK_CLIENT_SECRET);
}

export function autodeskRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return process.env.AUTODESK_REDIRECT_URI ?? `${base}/api/integrations/autodesk/callback`;
}

function basicAuthHeader(): string {
  const clientId = process.env.AUTODESK_CLIENT_ID;
  const clientSecret = process.env.AUTODESK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Autodesk isn't configured on this server");
  }
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

export function buildAutodeskAuthorizeUrl(state: string): string {
  const clientId = process.env.AUTODESK_CLIENT_ID;
  if (!clientId) throw new Error("Autodesk isn't configured on this server");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: autodeskRedirectUri(),
    scope: APS_SCOPES,
    state,
  });
  return `${APS_BASE}/authentication/v2/authorize?${params}`;
}

async function postToken(body: URLSearchParams): Promise<AutodeskTokenResponse> {
  const res = await fetch(`${APS_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Autodesk token request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<AutodeskTokenResponse>;
}

export async function exchangeAutodeskCode(code: string): Promise<AutodeskTokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: autodeskRedirectUri(),
    })
  );
}

export async function refreshAutodeskToken(refreshToken: string): Promise<AutodeskTokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

export function tokenExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000 - 60_000);
}

async function apsRequest<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${APS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Autodesk API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/** BIM 360 / ACC hubs only (skip personal drives). */
export async function listAutodeskHubs(accessToken: string): Promise<AutodeskHub[]> {
  const result = await apsRequest<JsonApiList<JsonApiResource>>(accessToken, "/project/v1/hubs");
  return result.data
    .filter((hub) => hub.id.startsWith("b."))
    .map((hub) => ({
      id: hub.id,
      attributes: { name: String(hub.attributes?.name ?? "ACC Hub") },
    }));
}

export async function listAutodeskProjects(accessToken: string, hubId: string): Promise<AutodeskProject[]> {
  const result = await apsRequest<JsonApiList<JsonApiResource>>(
    accessToken,
    `/project/v1/hubs/${encodeURIComponent(hubId)}/projects`
  );
  return result.data.map((project) => ({
    id: project.id,
    attributes: { name: String(project.attributes?.name ?? "ACC Project") },
  }));
}

export type AutodeskFileItem = {
  id: string;
  name: string;
  mimeType: string | null;
};

/** Walk ACC project folders and collect PDF drawing files. */
export async function listAutodeskDrawingFiles(
  accessToken: string,
  hubId: string,
  projectId: string
): Promise<AutodeskFileItem[]> {
  const topFolders = await apsRequest<JsonApiList<JsonApiResource>>(
    accessToken,
    `/project/v1/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}/topFolders`
  );

  const files: AutodeskFileItem[] = [];
  const seenFolders = new Set<string>();
  const queue = [...topFolders.data];

  while (queue.length > 0 && files.length < 200) {
    const folder = queue.shift()!;
    if (seenFolders.has(folder.id)) continue;
    seenFolders.add(folder.id);

    const contents = await apsRequest<{ data: JsonApiResource[] }>(
      accessToken,
      `/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folder.id)}/contents`
    ).catch(() => ({ data: [] }));

    for (const entry of contents.data) {
      if (entry.type === "folders") {
        queue.push(entry);
        continue;
      }
      if (entry.type !== "items") continue;
      const name = String(entry.attributes?.displayName ?? entry.attributes?.name ?? "Drawing");
      const mimeType = String(entry.attributes?.mimeType ?? "");
      const isPdf = name.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf");
      if (!isPdf) continue;
      files.push({ id: entry.id, name, mimeType: mimeType || null });
    }
  }

  return files;
}

type ItemWithIncluded = {
  included?: Array<{
    type: string;
    attributes?: { extension?: { data?: { sourceFileName?: string } } };
    relationships?: {
      storage?: { meta?: { link?: { href?: string } } };
    };
  }>;
};

/** Download bytes for an ACC item's latest version. */
export async function downloadAutodeskItem(
  accessToken: string,
  projectId: string,
  itemId: string
): Promise<{ bytes: Buffer; fileName: string; contentType: string }> {
  const item = await apsRequest<ItemWithIncluded>(
    accessToken,
    `/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}`
  );

  const version = item.included?.find((v) => v.type === "versions");
  const href = version?.relationships?.storage?.meta?.link?.href;
  if (!href) throw new Error(`No download URL for Autodesk item ${itemId}`);

  const fileName =
    version?.attributes?.extension?.data?.sourceFileName ??
    `drawing-${itemId}.pdf`;

  const res = await fetch(href, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Autodesk file download failed (${res.status}): ${text}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/pdf";
  return { bytes, fileName, contentType };
}
