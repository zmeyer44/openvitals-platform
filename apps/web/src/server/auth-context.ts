import { auth } from "./auth";
import { createOwnerContextForAuthUser, type AuthenticatedOwnerContext } from "./ownership";

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export async function getAuthenticatedOwnerContext(request: Request): Promise<AuthenticatedOwnerContext | null> {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  if (!session) {
    return null;
  }

  return createOwnerContextForAuthUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name
  });
}

export async function requireAuthenticatedOwnerContext(request: Request): Promise<AuthenticatedOwnerContext> {
  const context = await getAuthenticatedOwnerContext(request);

  if (!context) {
    throw jsonError(401, "Authentication is required.");
  }

  return context;
}
