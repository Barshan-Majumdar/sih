import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AssistantActionError,
  cancelAssistantAction,
  confirmAssistantAction,
} from "@/lib/assistant-actions";
import { PermissionError } from "@/lib/permissions";
import { requireActiveOrganization, requireUser } from "@/lib/session";
import { logger, observeApiRequest, reportException } from "@/lib/observability";

const requestSchema = z.object({ action: z.enum(["confirm", "cancel"]) });

async function handlePatch(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose confirm or cancel." }, { status: 400 });
  }

  try {
    const { proposalId } = await params;
    const user = await requireUser();
    const { organizationId } = await requireActiveOrganization();
    const context = { userId: user.id, organizationId };
    const proposal =
      parsed.data.action === "confirm"
        ? await confirmAssistantAction(proposalId, context)
        : await cancelAssistantAction(proposalId, context);

    if (parsed.data.action === "confirm") {
      const projectBase = `/projects/${proposal.projectId}`;
      revalidatePath(projectBase);
      revalidatePath(`${projectBase}/gantt`);
      revalidatePath(`${projectBase}/dashboard`);
      revalidatePath(`${projectBase}/lookahead`);
      revalidatePath(`${projectBase}/weekly-plan`);
      revalidatePath(`${projectBase}/roadblocks`);
      revalidatePath(proposal.href);
      revalidatePath("/timeline");
    }

    return Response.json({ proposal });
  } catch (error) {
    const status =
      error instanceof AssistantActionError
        ? error.status
        : error instanceof PermissionError
          ? 403
          : 500;
    const message = error instanceof Error ? error.message : "Could not update this proposal.";
    if (status >= 500) reportException(error, "assistant.action.failed");
    else logger.warn("assistant.action.rejected", { status, errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ proposalId: string }> }
) {
  return observeApiRequest(request, "assistant.action", () => handlePatch(request, context));
}
