import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ project: null }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("projectId");

  const cookieStore = await cookies();
  const preferredId = requestedId || cookieStore.get("agira_active_project")?.value;

  if (preferredId && preferredId !== "new") {
    let preferred = await prisma.project.findFirst({
      where: {
        id: preferredId,
        isArchived: false,
        members: { some: { userId: session.user.id } },
      },
      select: { id: true, name: true },
    });
    if (!preferred) {
      preferred = await prisma.project.findFirst({
        where: {
          id: preferredId,
          isArchived: false,
        },
        select: { id: true, name: true },
      });
    }
    if (preferred) {
      return NextResponse.json({ project: preferred });
    }
  }

  const recent = await prisma.project.findFirst({
    where: {
      isArchived: false,
      members: { some: { userId: session.user.id } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ project: recent });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body?.projectId;
    const cookieStore = await cookies();

    if (projectId && typeof projectId === "string" && projectId !== "new") {
      cookieStore.set("agira_active_project", projectId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });

      const session = await getCurrentSession();
      if (session?.user) {
        let project = await prisma.project.findFirst({
          where: {
            id: projectId,
            isArchived: false,
            members: { some: { userId: session.user.id } },
          },
          select: { id: true, name: true },
        });

        if (!project) {
          project = await prisma.project.findFirst({
            where: {
              id: projectId,
              isArchived: false,
            },
            select: { id: true, name: true },
          });
        }

        if (project) {
          return NextResponse.json({ success: true, project });
        }
      }
    }

    return NextResponse.json({ success: true, project: null });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
