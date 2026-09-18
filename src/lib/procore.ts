/** Procore OAuth + REST helpers. Gracefully inactive when PROCORE_CLIENT_ID is unset. */

export type ProcoreEnvironment = "sandbox" | "production";

export type ProcoreTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  created_at?: number;
};

export type ProcoreCompany = { id: number; name: string };
export type ProcoreProject = { id: number; name: string; project_number?: string | null };

export function isProcoreConfigured(): boolean {
  return false;
}

export function procoreRedirectUri(): string {
  return "/api/integrations/procore/callback";
}

export function procoreHosts(environment: ProcoreEnvironment = (process.env.PROCORE_ENV as ProcoreEnvironment) || "sandbox") {
  if (environment === "production") {
    return {
      login: "https://login.procore.com",
      api: "https://api.procore.com",
    };
  }
  return {
    login: "https://login-sandbox.procore.com",
    api: "https://sandbox.procore.com",
  };
}

export function buildProcoreAuthorizeUrl(state: string): string {
  const clientId = process.env.PROCORE_CLIENT_ID;
  if (!clientId) throw new Error("Procore isn't configured on this server");
  const { login } = procoreHosts();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: procoreRedirectUri(),
    state,
  });
  return `${login}/oauth/authorize?${params}`;
}

export async function exchangeProcoreCode(code: string): Promise<ProcoreTokenResponse> {
  const clientId = process.env.PROCORE_CLIENT_ID;
  const clientSecret = process.env.PROCORE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Procore isn't configured on this server");
  }
  const { login } = procoreHosts();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: procoreRedirectUri(),
  });
  const res = await fetch(`${login}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Procore token exchange failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<ProcoreTokenResponse>;
}

export async function refreshProcoreToken(refreshToken: string): Promise<ProcoreTokenResponse> {
  const clientId = process.env.PROCORE_CLIENT_ID;
  const clientSecret = process.env.PROCORE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Procore isn't configured on this server");
  }
  const { login } = procoreHosts();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${login}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Procore token refresh failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<ProcoreTokenResponse>;
}

export function tokenExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000 - 60_000);
}

type ProcoreRequestOptions = {
  accessToken: string;
  companyId: string;
  path: string;
  searchParams?: Record<string, string | number | undefined>;
};

export async function procoreRequest<T>(options: ProcoreRequestOptions): Promise<T> {
  const { api } = procoreHosts();
  const url = new URL(`${api}${options.path}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Procore-Company-Id": options.companyId,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Procore API ${options.path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listProcoreCompanies(accessToken: string): Promise<ProcoreCompany[]> {
  return procoreRequest<ProcoreCompany[]>({ accessToken, companyId: "0", path: "/rest/v1.0/companies" });
}

export async function listProcoreProjects(accessToken: string, companyId: string): Promise<ProcoreProject[]> {
  return procoreRequest<ProcoreProject[]>({
    accessToken,
    companyId,
    path: "/rest/v1.0/projects",
    searchParams: { company_id: companyId },
  });
}

export type ProcoreRfi = {
  id: number;
  subject?: string | null;
  question?: string | null;
  status?: string | null;
  due_date?: string | null;
  answers?: Array<{ answer?: string | null }> | null;
};

export async function listProcoreRfis(
  accessToken: string,
  companyId: string,
  projectId: string
): Promise<ProcoreRfi[]> {
  return procoreRequest<ProcoreRfi[]>({
    accessToken,
    companyId,
    path: `/rest/v1.0/projects/${projectId}/rfis`,
    searchParams: { per_page: 100 },
  });
}

export type ProcoreSubmittal = {
  id: number | string;
  title?: string | null;
  number?: string | null;
  description?: string | null;
  due_date?: string | null;
  status?: { name?: string | null } | string | null;
  specification_section?: { number?: string | null; description?: string | null } | null;
};

type SubmittalListResponse = { data?: ProcoreSubmittal[] } | ProcoreSubmittal[];

export async function listProcoreSubmittals(
  accessToken: string,
  companyId: string,
  projectId: string
): Promise<ProcoreSubmittal[]> {
  const raw = await procoreRequest<SubmittalListResponse>({
    accessToken,
    companyId,
    path: `/rest/v2.0/companies/${companyId}/projects/${projectId}/submittals`,
    searchParams: { per_page: 100 },
  });
  if (Array.isArray(raw)) return raw;
  return raw.data ?? [];
}
