export type ProjectSetupStepId =
  | "project-created"
  | "first-task"
  | "first-teammate"
  | "first-file"
  | "first-agent-question";

export type ProjectSetupSignals = {
  taskCount: number;
  memberCount: number;
  fileCount: number;
  agentQuestionCount: number;
};

export type ProjectSetupStep = {
  id: ProjectSetupStepId;
  label: string;
  description: string;
  href: string | null;
  complete: boolean;
};

export function buildProjectSetupSteps(
  projectId: string,
  signals: ProjectSetupSignals
): ProjectSetupStep[] {
  return [
    {
      id: "project-created",
      label: "Project created",
      description: "Workspace and delivery dates are ready.",
      href: null,
      complete: true,
    },
    {
      id: "first-task",
      label: "Build the schedule",
      description: "Add the first activity to the master schedule.",
      href: `/projects/${projectId}`,
      complete: signals.taskCount > 0,
    },
    {
      id: "first-teammate",
      label: "Add a teammate",
      description: "Invite someone from the office or field.",
      href: `/projects/${projectId}/members`,
      complete: signals.memberCount > 1,
    },
    {
      id: "first-file",
      label: "Add a project file",
      description: "Upload a drawing, photo, or PDF.",
      href: `/projects/${projectId}/files`,
      complete: signals.fileCount > 0,
    },
    {
      id: "first-agent-question",
      label: "Ask Agent",
      description: "Start the first project-aware conversation.",
      href: null,
      complete: signals.agentQuestionCount > 0,
    },
  ];
}

export function completedProjectSetupSteps(steps: ProjectSetupStep[]): number {
  return steps.filter((step) => step.complete).length;
}
