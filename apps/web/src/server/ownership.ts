import { eq } from "drizzle-orm";
import { appUsers, type OpenVitalsDatabase } from "@openvitals/database";
import { actorForUser, type Actor } from "@openvitals/domain";
import { db } from "./db";

export type AuthUserIdentity = {
  id: string;
  email: string;
  name?: string | null;
};

export type AppUser = typeof appUsers.$inferSelect;

export type AuthenticatedOwnerContext = {
  authUser: AuthUserIdentity;
  appUser: AppUser;
  ownerUserId: string;
  actor: Actor;
};

async function updateAppUser(
  database: OpenVitalsDatabase,
  userId: string,
  input: AuthUserIdentity
): Promise<AppUser> {
  const [updated] = await database
    .update(appUsers)
    .set({
      externalAuthId: input.id,
      email: input.email,
      displayName: input.name ?? input.email,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, userId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update OpenVitals app user for authenticated identity");
  }

  return updated;
}

export async function ensureAppUserForAuthUser(
  input: AuthUserIdentity,
  database: OpenVitalsDatabase = db
): Promise<AppUser> {
  const [byAuthId] = await database.select().from(appUsers).where(eq(appUsers.externalAuthId, input.id)).limit(1);

  if (byAuthId) {
    return updateAppUser(database, byAuthId.id, input);
  }

  const [byEmail] = await database.select().from(appUsers).where(eq(appUsers.email, input.email)).limit(1);

  if (byEmail) {
    if (byEmail.externalAuthId && byEmail.externalAuthId !== input.id) {
      throw new Error("Authenticated identity email is already linked to a different OpenVitals user");
    }

    return updateAppUser(database, byEmail.id, input);
  }

  const [created] = await database
    .insert(appUsers)
    .values({
      externalAuthId: input.id,
      email: input.email,
      displayName: input.name ?? input.email,
      role: "user"
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create OpenVitals app user for authenticated identity");
  }

  return created;
}

export async function createOwnerContextForAuthUser(
  input: AuthUserIdentity,
  database: OpenVitalsDatabase = db
): Promise<AuthenticatedOwnerContext> {
  const appUser = await ensureAppUserForAuthUser(input, database);

  return {
    authUser: input,
    appUser,
    ownerUserId: appUser.id,
    actor: actorForUser({ id: appUser.id, role: appUser.role })
  };
}
