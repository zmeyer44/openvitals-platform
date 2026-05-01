import { createFileRoute } from "@tanstack/react-router";
import { saveIntakeStepBodySchema } from "@openvitals/domain";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { IntakeApiError, saveIntakeStep } from "../server/intake";

export const Route = createFileRoute("/api/intake/$intakeId/steps")({
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

        const parsed = saveIntakeStepBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid intake step submission.",
              code: "invalid_intake_step",
              issues: parsed.error.issues
            },
            { status: 400 }
          );
        }

        try {
          const detail = await saveIntakeStep(db, {
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
