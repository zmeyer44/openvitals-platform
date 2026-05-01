import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { listReviewTasksForOwner, listReviewTasksQuerySchema } from "../server/reviews";

export const Route = createFileRoute("/api/review-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const query = listReviewTasksQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams)
        );
        const tasks = await listReviewTasksForOwner(db, { owner, query });
        return Response.json({ reviewTasks: tasks });
      }
    }
  }
});
