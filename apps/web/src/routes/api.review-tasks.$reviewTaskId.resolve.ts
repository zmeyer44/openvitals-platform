import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import {
  resolveReviewTaskBodySchema,
  resolveReviewTaskForOwner,
  ReviewApiError
} from "../server/reviews";

export const Route = createFileRoute("/api/review-tasks/$reviewTaskId/resolve")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
        }

        const parsed = resolveReviewTaskBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid review action.", code: "invalid_review_action", issues: parsed.error.issues },
            { status: 400 }
          );
        }

        try {
          const result = await resolveReviewTaskForOwner(db, {
            owner,
            reviewTaskId: params.reviewTaskId,
            body: parsed.data
          });
          return Response.json(result);
        } catch (error) {
          if (error instanceof ReviewApiError) {
            return Response.json({ error: error.message, code: error.code }, { status: error.status });
          }
          throw error;
        }
      }
    }
  }
});
