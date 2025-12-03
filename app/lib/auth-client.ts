import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://audio-scribing-meeting-transcriptio.vercel.app",
});

export const { signIn, signUp, signOut, useSession } = authClient;
