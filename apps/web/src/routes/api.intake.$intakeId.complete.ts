import { createFileRoute } from "@tanstack/react-router";
import { completeIntakeBodySchema } from "@openvitals/domain";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { completeIntake, IntakeApiError } from "../server/intake";

export const Route = createFileRoute("/api/intake/$intakeId/complete")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);

        let parsedBody = undefined;
        const text = await request.text();
        if (text.trim().length > 0) {
          let raw: unknown;
          try {
            raw = JSON.parse(text);
          } catch {
            return Response.json(
              { error: "Invalid JSON body.", code: "invalid_json" },
              { status: 400 }
            );
          }

          const result = completeIntakeBodySchema.safeParse(raw);
          if (!result.success) {
            return Response.json(
              {
                error: "Invalid intake completion body.",
                code: "invalid_intake_complete",
                issues: result.error.issues
              },
              { status: 400 }
            );
          }
          parsedBody = result.data;
        }

        try {
          const detail = await completeIntake(db, {
            owner,
            intakeId: params.intakeId,
            body: parsedBody
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
