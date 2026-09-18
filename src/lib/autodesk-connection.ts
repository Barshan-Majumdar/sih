import { prisma } from "@/lib/prisma";
import { refreshAutodeskToken, tokenExpiresAt, type AutodeskTokenResponse } from "@/lib/autodesk";
import type { AutodeskConnection } from "@prisma/client";

async function persistTokens(connectionId: string, tokens: AutodeskTokenResponse) {
  return prisma.autodeskConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    },
  });
}

export async function getAutodeskConnectionForOrg(organizationId: string): Promise<AutodeskConnection | null> {
  const connection = await prisma.autodeskConnection.findUnique({ where: { organizationId } });
  if (!connection) return null;

  const stillValid = connection.accessTokenExpiresAt.getTime() > Date.now() + 30_000;
  if (stillValid) return connection;

  const tokens = await refreshAutodeskToken(connection.refreshToken);
  return persistTokens(connection.id, tokens);
}
