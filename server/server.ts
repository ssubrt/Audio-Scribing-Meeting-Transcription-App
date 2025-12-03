import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv"; // Added for Day 3
import { GoogleGenerativeAI } from "@google/generative-ai"; // Added for Day 3
import { GoogleAIFileManager } from "@google/generative-ai/server"; // Added for Day 3

// ✅ FIX: Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ FIX: Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors({
  origin: "https://audio-scribing-meeting-transcriptio.vercel.app",
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://audio-scribing-meeting-transcriptio.vercel.app", 
    methods: ["GET", "POST"],
    credentials: true
  },
});

// --- DAY 3: GEMINI SETUP ---
// ✅ FIX: Validate API key is loaded
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ FATAL: GEMINI_API_KEY not found in environment variables!");
  console.error("📁 Looking for .env at:", path.join(__dirname, '.env'));
  process.exit(1);
}

console.log("✅ Gemini API Key loaded successfully");
console.log("🔑 Key preview:", GEMINI_API_KEY.substring(0, 10) + "...");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// ---------------------------

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  console.log(`✅ Created temp directory: ${TEMP_DIR}`);
}

// Track active sessions and grace periods for reconnection
const activeSessions = new Map<string, {
  fileStream: fs.WriteStream;
  socketId: string;
  gracePeriodTimer: NodeJS.Timeout | null;
  filePath: string; // Added this so we know where to upload from later
}>();

const GRACE_PERIOD_MS = 30000; 

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  
  let currentSessionId: string | null = null;

  // 1. Start Recording Handshake
  socket.on("start-session", ({ sessionId, isResume }) => {
    console.log(`${isResume ? '🔄 Resuming' : '🎙️ Starting'} session: ${sessionId}`);
    currentSessionId = sessionId;
    
    const filePath = path.join(TEMP_DIR, `${sessionId}.webm`);
    
    const existingSession = activeSessions.get(sessionId);
    
    if (existingSession) {
      if (existingSession.gracePeriodTimer) {
        console.log(`✅ Client reconnected to ${sessionId}, canceling cleanup`);
        clearTimeout(existingSession.gracePeriodTimer);
        existingSession.gracePeriodTimer = null;
      }
      existingSession.socketId = socket.id;
    } else {
      const fileStream = fs.createWriteStream(filePath, { flags: "a" });
      
      activeSessions.set(sessionId, {
        fileStream,
        socketId: socket.id,
        gracePeriodTimer: null,
        filePath // Store path for Gemini later
      });
    }
  });

  // 2. Handle Audio Chunks
  socket.on("audio-chunk", (chunk) => {
    if (currentSessionId) {
      const session = activeSessions.get(currentSessionId);
      if (session?.fileStream) {
        session.fileStream.write(chunk);
      }
    }
  });

  socket.on("pause-marker", ({ timestamp, sessionId }) => {
    console.log(`⏸️ Pause marker at ${timestamp} for ${sessionId}`);
  });

  socket.on("resume-marker", ({ timestamp, sessionId }) => {
    console.log(`▶️ Resume marker at ${timestamp} for ${sessionId}`);
  });

  // --- DAY 3 UPDATE: STOP & PROCESS ---
  socket.on("stop-session", async () => { // Make async
    console.log(`🛑 Ending session: ${currentSessionId}`);
    
    if (currentSessionId) {
      const session = activeSessions.get(currentSessionId);
      
      if (session) {
        if (session.gracePeriodTimer) clearTimeout(session.gracePeriodTimer);
        
        // Close the file stream first
        session.fileStream.end();
        
        // Remove from active sessions immediately so we don't write more
        activeSessions.delete(currentSessionId);

        // --- GEMINI PROCESSING START ---
        // ✅ IMPROVEMENT: Retry logic with exponential backoff
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000; // Start with 2 seconds
        
        let attempt = 0;
        let success = false;
        
        while (attempt < MAX_RETRIES && !success) {
          try {
            attempt++;
            
            // Tell client we are working
            socket.emit("processing-start");
            console.log(`🚀 Uploading to Gemini... (Attempt ${attempt}/${MAX_RETRIES})`);

            // 1. Upload
            const uploadResult = await fileManager.uploadFile(session.filePath, {
              mimeType: "audio/webm",
              displayName: `Session ${currentSessionId}`,
            });
            
            console.log(`✅ File uploaded: ${uploadResult.file.uri}`);

            // 2. Generate with improved prompt
//             const PROMPT = `You are an expert AI transcription and meeting analysis assistant.

// **Task**: Analyze this audio recording and provide:

// 1. **TRANSCRIPTION** (near-verbatim)
//    - Include all spoken words with proper punctuation
//    - Use [Speaker 1], [Speaker 2] etc. if multiple voices detected
//    - Mark unclear audio as [inaudible]
//    - Include natural pauses as "..."

// 2. **KEY POINTS** (3-5 bullet points)
//    - Main topics discussed
//    - Important insights or findings
//    - Critical information shared

// 3. **ACTION ITEMS** (if any)
//    - Who needs to do what
//    - Deadlines mentioned
//    - Follow-up tasks

// 4. **DECISIONS MADE** (if any)
//    - Agreements reached
//    - Choices finalized
//    - Consensus points

// **Format**: Use clear Markdown formatting with headers (##) and bullet points (-).
// **Tone**: Professional and concise.`;

const PROMPT = `You are an expert meeting transcription and analysis AI assistant. Your task is to analyze this audio recording and extract MAXIMUM VALUE for professionals.

**CRITICAL REQUIREMENTS:**

1. **COMPLETE TRANSCRIPTION** (MANDATORY)
   - Transcribe EVERY word spoken, preserving exact phrasing
   - Use [Speaker 1], [Speaker 2], [Speaker 3] etc. for different speakers
   - Include timestamps like [0:15] for key statements
   - Mark inaudible sections as [inaudible at 1:23]
   - Preserve filler words and pauses if they indicate hesitation
   - Use proper punctuation and capitalization
   - Include verbal cues like "um", "uh", "like" if they're frequent

2. **KEY POINTS & DISCUSSION TOPICS** (PRIORITY)
   - List EVERY major topic discussed (use ## Topic Name format)
   - Under each topic, include 2-3 sentences of what was discussed
   - Highlight any disagreements or different viewpoints
   - Include any statistics, metrics, or specific numbers mentioned
   - Note any problems identified
   - Highlight innovative ideas or suggestions made

3. **ACTION ITEMS** (EXTREMELY IMPORTANT - EXTRACT ALL)
   Format each as: **[Person Name]** - Action description (Due: deadline if mentioned)
   
   Look for these keywords: "will", "should", "need to", "must", "I'll", "we'll", "by", "deadline", "due", "by next", "ASAP"
   
   Examples of what to extract:
   - "John will send the report by Friday" → **[John]** - Send report (Due: Friday)
   - "We need to schedule a meeting" → **[Team]** - Schedule follow-up meeting
   - "Can you review this by tomorrow?" → **[Assigned Person]** - Review document (Due: Tomorrow)
   
   Extract EVERY assignment, even implied ones.
   DO NOT leave this section empty.

4. **DECISIONS MADE** (EXTREMELY IMPORTANT - EXTRACT ALL)
   Format each as: **Decision:** Description → **Reason:** Why this was chosen
   
   Look for these keywords: "decided", "agreed", "we'll go with", "let's use", "approved", "confirmed", "finalized", "consensus"
   
   Examples of what to extract:
   - "We decided to use AWS instead of Azure" → **Decision:** Use AWS for cloud infrastructure → **Reason:** Better pricing and support
   - "Let's hire 3 more developers" → **Decision:** Expand team by 3 developers → **Reason:** Accelerate product delivery
   - "We agreed on Q3 launch" → **Decision:** Product launch in Q3 2025 → **Reason:** Market readiness
   
   Extract EVERY agreement and consensus, even small ones.
   DO NOT leave this section empty.

5. **RISKS & CONCERNS** (if mentioned)
   - Any risks identified
   - Concerns raised by participants
   - Potential blockers mentioned

6. **SUCCESS METRICS / GOALS** (if discussed)
   - Specific goals mentioned
   - Success criteria or KPIs
   - Measurement methods

7. **NEXT STEPS / FOLLOW-UP**
   - When is the next meeting?
   - What needs to happen before next meeting?
   - Outstanding questions or information needed?

**OUTPUT FORMAT:**

Use clear Markdown with:
- ## for section headers
- **Bold** for important names and decisions
- - for bullet points
- > for quotes or important statements

**TONE:** Professional, concise, and action-oriented. Assume this will be shared with executives and team members.

**CRITICAL:** 
- Never skip sections 3 and 4 (Action Items & Decisions)
- If you're unsure about something, include it anyway with [unclear] notation
- Better to have too much detail than too little
- Extract specific names and dates whenever possible`;


            const result = await model.generateContent([
              {
                fileData: {
                  mimeType: uploadResult.file.mimeType,
                  fileUri: uploadResult.file.uri,
                },
              },
              { text: PROMPT },
            ]);

            const responseText = result.response.text();
            console.log("✨ Gemini Response generated.");

            // 3. Send to Client
            socket.emit("processing-complete", { 
               summary: responseText,
               sessionId: currentSessionId
            });

            // ✅ IMPROVEMENT: Clean up file after successful processing
            try {
              fs.unlinkSync(session.filePath);
              console.log(`🗑️ Deleted temporary file: ${session.filePath}`);
            } catch (unlinkError) {
              console.warn(`⚠️ Could not delete file: ${unlinkError}`);
            }

            success = true; // Mark as successful
            
          } catch (error) {
            // ✅ IMPROVED: Better error logging
            console.error(`❌ Error on attempt ${attempt}/${MAX_RETRIES}:`);
            console.error("Error type:", error instanceof Error ? error.name : typeof error);
            console.error("Error message:", error instanceof Error ? error.message : String(error));
            
            if (error instanceof Error && error.stack) {
              console.error("Stack trace:", error.stack);
            }
            
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
              console.log(`⏳ Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              // All retries failed
              console.error("❌ All retries exhausted. Gemini processing failed.");
              console.error("📁 File path:", session.filePath);
              console.error("📊 File exists:", fs.existsSync(session.filePath));
              
              if (fs.existsSync(session.filePath)) {
                const stats = fs.statSync(session.filePath);
                console.error("📦 File size:", stats.size, "bytes");
              }
              
              socket.emit("error", { 
                message: "Failed to process audio after multiple attempts. Please try again." 
              });
            }
          }
        }
        // --- GEMINI PROCESSING END ---
      }
      
      currentSessionId = null;
    }
  });

  socket.on("disconnect", () => {
    console.log("⚠️ Client disconnected:", socket.id);
    
    if (currentSessionId) {
      const session = activeSessions.get(currentSessionId);
      const sessionIdForTimer = currentSessionId;
      
      if (session && !session.gracePeriodTimer) {
        console.log(`⏱️ Starting ${GRACE_PERIOD_MS / 1000}s grace period for ${sessionIdForTimer}`);
        
        session.gracePeriodTimer = setTimeout(() => {
          console.log(`⏰ Grace period expired for ${sessionIdForTimer}, cleaning up`);
          const expiredSession = activeSessions.get(sessionIdForTimer);
          if (expiredSession) {
            expiredSession.fileStream.end();
            activeSessions.delete(sessionIdForTimer);
            console.log(`📁 Session ${sessionIdForTimer} file saved (no reconnect)`);
          }
        }, GRACE_PERIOD_MS);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});