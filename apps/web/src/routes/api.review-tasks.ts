import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { listReviewTasksForOwner, listReviewTasksQuerySchema } from "../server/reviews";

export const Route = createFileRoute("/api/review-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const parsed = listReviewTasksQuerySchema.safeParse(
          Object.fromEntries(new URL(request.url).searchParams)
        );

        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid review tasks query.",
              code: "invalid_review_tasks_query",
              issues: parsed.error.issues
            },
            { status: 400 }
          );
        }

        const tasks = await listReviewTasksForOwner(db, { owner, query: parsed.data });
        return Response.json({ reviewTasks: tasks });
      }
    }
  }
});
