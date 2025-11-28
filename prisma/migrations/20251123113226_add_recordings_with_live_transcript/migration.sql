-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED');

-- CreateTable
CREATE TABLE "recording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "duration" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/webm',
    "transcript" TEXT,
    "summary" TEXT,
    "liveTranscript" TEXT,
    "status" "RecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "geminiTokensUsed" INTEGER,
    "processingTimeMs" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recording_sessionId_key" ON "recording"("sessionId");

-- CreateIndex
CREATE INDEX "recording_userId_idx" ON "recording"("userId");

-- CreateIndex
CREATE INDEX "recording_sessionId_idx" ON "recording"("sessionId");

-- CreateIndex
CREATE INDEX "recording_status_idx" ON "recording"("status");

-- AddForeignKey
ALTER TABLE "recording" ADD CONSTRAINT "recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
