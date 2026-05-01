import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getReviewTaskForOwner } from "../server/reviews";

export const Route = createFileRoute("/api/review-tasks/$reviewTaskId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const task = await getReviewTaskForOwner(db, {
          owner,
          reviewTaskId: params.reviewTaskId
        });

        if (!task) {
          return Response.json({ error: "Review task not found." }, { status: 404 });
        }

        return Response.json({ reviewTask: task });
      }
    }
  }
});
