import { handleTaskActionRequest } from "@/lib/tasks/task-action-handler";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleTaskActionRequest(req, id, "cancel");
}
