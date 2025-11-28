AI-Powered Audio Scribing — Meeting Transcription App

Lightweight Next.js + Socket.IO application for recording meeting audio in the browser and producing transcripts via a backend pipeline. The repo includes two server flows: a dev-friendly file-writer Socket.IO server and an example transcription server that demonstrates integration with Google Generative AI (Gemini).

## Key parts of the repo
- `app/` — Next.js client UI (React) and audio recorder components.
- `server/server.ts` — Socket.IO file-writer server: accepts binary audio chunks and appends them to `server/temp/<sessionId>.webm`.
- `server.ts` (root) — Example real-time transcription server using `@google/generative-ai` to transcribe buffered audio and emit `transcript` events.
- `prisma/` — Prisma schema and generated client for optional persistence (users/sessions).

## Quick features
- Browser audio recording (WebM) with chunked upload via Socket.IO.
- Resumable sessions with a reconnect grace period to avoid losing data on brief disconnects.
- Buffering and batching logic to control transcription request frequency.
- Example Gemini integration with basic rate-limit handling.

## Prerequisites
- Node.js v18+ (recommended)
- Optional: Postgres (or Neon) if using Prisma persistence
- Optional: Google Generative AI / Gemini API key for server-side transcription

## Environment
Create a `.env` file in the project root for local development. Example values:

```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
GOOGLE_API_KEY="your_google_generative_ai_key"
PORT=4000
```

Notes:
- `DATABASE_URL` — used by Prisma. The current schema may contain a direct URL; for local development change `prisma/schema.prisma` to `url = env("DATABASE_URL")` and run `npx prisma generate`.
- `GOOGLE_API_KEY` — replace the placeholder in `server.ts` or configure the code to read from `process.env.GOOGLE_API_KEY`.

## Install & Prisma

```bash
npm install
npx prisma generate
# (optional) npx prisma migrate dev --name init
```

## Run locally (recommended flow)
1. Start the Socket.IO file-writer server (writes `.webm` files):

```bash
npm run dev
```

2. Start the Next.js client:

```bash
npm run dev:next
```

3. To run the example transcription server (Gemini integration):

```bash
npm run start
```

Script notes:
- `npm run dev` => `tsx server/server.ts` (dev file-writer server)
- `npm run dev:next` => `next dev` (client)
- `npm run start` => `ts-node --project tsconfig.json server.ts` (example Gemini transcription)

## How it works (high level)
- Client records audio and emits `audio-chunk` events over Socket.IO.
- `server/server.ts` appends chunks to `server/temp/<sessionId>.webm` for safe local testing.
- `server.ts` demonstrates buffering multiple chunks into a single audio payload, encoding it to base64, sending it to Gemini via `@google/generative-ai`, and emitting `transcript` events back to the client.

## Where recordings are stored
- Local dev recordings: `server/temp/<sessionId>.webm`.

## Troubleshooting
- CORS errors: ensure client origin (`http://localhost:3000`) is allowed by the server CORS config.
- Prisma errors: set `DATABASE_URL` and re-run `npx prisma generate`.
- Gemini rate limits (429): code logs warnings and skips chunks; consider increasing buffer size or adding retries/backoff.

## Next steps (optional)
- Replace the hardcoded Gemini key with `process.env.GOOGLE_API_KEY` in `server.ts`.
- Update `prisma/schema.prisma` to use `env("DATABASE_URL")` and commit migrations.
- Add a client config page to ease local testing of server origins and keys.

If you'd like, I can apply the two optional changes above now (use env var for Gemini key and update Prisma schema). Tell me which to do.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
