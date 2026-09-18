import { cache } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrganizationMembership } from "@/lib/permissions";

export interface AppUserSession {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    clerkId?: string | null;
    role?: string | null;
  };
  session: {
    id: string;
    userId: string;
    activeOrganizationId?: string | null;
  };
}

export const getCurrentSession = cache(async (): Promise<AppUserSession | null> => {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email =
      clerkUser.emailAddresses[0]?.emailAddress || `${clerkUser.id}@clerk.local`;
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "User";
    const image = clerkUser.imageUrl || null;

    // Fast read check first to avoid unnecessary remote database writes on every GET request
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ clerkId: clerkUser.id }, { email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email,
          name,
          image,
        },
      });
    } else if (user.clerkId !== clerkUser.id || user.name !== name || user.image !== image) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          clerkId: clerkUser.id,
          name,
          image,
        },
      });
    }

    let firstMembership = await prisma.member.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!firstMembership) {
      const existingOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
      });
      if (existingOrg) {
        firstMembership = await prisma.member.create({
          data: {
            organizationId: existingOrg.id,
            userId: user.id,
            role: "owner",
          },
        });
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        clerkId: user.clerkId,
        role: user.role,
      },
      session: {
        id: clerkUser.id,
        userId: user.id,
        activeOrganizationId: firstMembership?.organizationId ?? null,
      },
    };
  } catch (err) {
    console.error("getCurrentSession error:", err);
    return null;
  }
});

/**
 * Use in Server Components / Server Actions that require a signed-in user.
 * Redirects to /sign-in if there is no session.
 */
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

/**
 * Use on pages that require an active organization. Redirects to /sign-in if
 * unauthenticated, or automatically provisions / returns the user's active organization.
 */
export async function requireActiveOrganization() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in");

  let membership = session.session.activeOrganizationId
    ? await getOrganizationMembership(session.user.id, session.session.activeOrganizationId)
    : null;

  if (!membership) {
    membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) {
    const existingOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existingOrg) {
      const created = await prisma.member.create({
        data: {
          organizationId: existingOrg.id,
          userId: session.user.id,
          role: "owner",
        },
      });
      return { user: session.user, organizationId: created.organizationId };
    }

    // Auto-create a default workspace organization so the user is immediately productive
    const cleanSlug = `workspace-${session.user.id.slice(-6).toLowerCase()}-${Date.now().toString(36)}`;
    const newOrg = await prisma.organization.create({
      data: {
        name: `${session.user.name || "Default"}'s Workspace`,
        slug: cleanSlug,
        members: {
          create: {
            userId: session.user.id,
            role: "owner",
          },
        },
      },
    });
    return { user: session.user, organizationId: newOrg.id };
  }

  return { user: session.user, organizationId: membership.organizationId };
}
