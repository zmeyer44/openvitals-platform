import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_APP_URL as string | undefined;

export const authClient = createAuthClient(baseURL ? { baseURL } : {});

export const { useSession, signIn, signOut, signUp } = authClient;
