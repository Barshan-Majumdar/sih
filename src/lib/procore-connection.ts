import { prisma } from "@/lib/prisma";
import {
  refreshProcoreToken,
  tokenExpiresAt,
  type ProcoreTokenResponse,
} from "@/lib/procore";
import type { ProcoreConnection } from "@prisma/client";

async function persistTokens(connectionId: string, tokens: ProcoreTokenResponse) {
  return prisma.procoreConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    },
  });
}

/** Return a connection with a fresh access token, refreshing when needed. */
export async function getProcoreConnectionForOrg(organizationId: string): Promise<ProcoreConnection | null> {
  const connection = await prisma.procoreConnection.findUnique({ where: { organizationId } });
  if (!connection) return null;

  const stillValid = connection.accessTokenExpiresAt.getTime() > Date.now() + 30_000;
  if (stillValid) return connection;

  const tokens = await refreshProcoreToken(connection.refreshToken);
  return persistTokens(connection.id, tokens);
}
