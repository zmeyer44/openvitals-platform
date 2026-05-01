import { createFileRoute } from "@tanstack/react-router";
import { skipIntakeStepBodySchema } from "@openvitals/domain";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { IntakeApiError, skipIntakeStep } from "../server/intake";

export const Route = createFileRoute("/api/intake/$intakeId/skip")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body.", code: "invalid_json" },
            { status: 400 }
          );
        }

        const parsed = skipIntakeStepBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid intake skip request.",
              code: "invalid_intake_skip",
              issues: parsed.error.issues
            },
            { status: 400 }
          );
        }

        try {
          const detail = await skipIntakeStep(db, {
            owner,
            intakeId: params.intakeId,
            body: parsed.data
          });
          return Response.json({ intake: detail });
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
