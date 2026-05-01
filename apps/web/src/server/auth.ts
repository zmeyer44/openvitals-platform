import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuthSchema } from "@openvitals/database";
import { ensureAppUserForAuthUser } from "./ownership";
import { db } from "./db";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;

export const auth = betterAuth({
  appName: "OpenVitals",
  baseURL,
  secret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: betterAuthSchema,
    transaction: true
  }),
  emailAndPassword: {
    enabled: true
  },
  account: {
    encryptOAuthTokens: true
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensureAppUserForAuthUser({
            id: user.id,
            email: user.email,
            name: user.name
          });
        }
      },
      update: {
        after: async (user) => {
          await ensureAppUserForAuthUser({
            id: user.id,
            email: user.email,
            name: user.name
          });
        }
      }
    }
  },
  plugins: [tanstackStartCookies()]
});

export type OpenVitalsAuth = typeof auth;
