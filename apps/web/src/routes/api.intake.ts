import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getCurrentIntake, IntakeApiError, startOrResumeIntake } from "../server/intake";

export const Route = createFileRoute("/api/intake")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const detail = await getCurrentIntake(db, { owner });
        if (!detail) {
          return Response.json({ intake: null });
        }
        return Response.json({ intake: detail });
      },

      POST: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        try {
          const result = await startOrResumeIntake(db, { owner });
          return Response.json(result, { status: result.resumed ? 200 : 201 });
        } catch (error) {
          if (error instanceof IntakeApiError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status }
            );
          }
          throw error;
        }
      }
    }
  }
});
