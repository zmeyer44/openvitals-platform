import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getIntakeDetail } from "../server/intake";

export const Route = createFileRoute("/api/intake/$intakeId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const detail = await getIntakeDetail(db, { owner, intakeId: params.intakeId });
        if (!detail) {
          return Response.json(
            { error: "Intake workflow not found.", code: "intake_not_found" },
            { status: 404 }
          );
        }
        return Response.json({ intake: detail });
      }
    }
  }
});
