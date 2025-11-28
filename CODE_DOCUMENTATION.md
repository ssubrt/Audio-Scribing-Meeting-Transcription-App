# 📋 AI Audio Transcription App - Complete Code Documentation

## 🎯 Project Overview

This is a **Next.js + Socket.IO** real-time audio transcription application that records meeting audio in the browser and processes it with Google Generative AI (Gemini) for transcription and summarization.

**Key Features:**
- 🎤 Browser-based audio recording (WebM format)
- 🔌 Real-time Socket.IO streaming to backend
- 📝 Live transcription during recording
- ✨ AI-powered summaries with Gemini
- 🔄 Automatic session resumption after disconnects
- 💾 PostgreSQL persistence with Prisma ORM
- 👤 User authentication with Better Auth
- 📊 Chunk buffering during network outages

---

## 📁 Project Structure

```
├── app/                          # Next.js frontend (port 3000)
│   ├── page.tsx                  # Auth UI (sign in/up)
│   ├── layout.tsx                # Root layout wrapper
│   ├── globals.css               # Global styles
│   ├── favicon.ico
│   ├── components/
│   │   └── client/
│   │       ├── AudioRecorder.tsx # Recording UI component
│   │       ├── hooks/
│   │       │   └── useAudioStream.ts # Core recording logic
│   │       └── machines/
│   │           └── recorderMachine.ts # XState state machine
│   ├── api/
│   │   └── auth/[...all]/route.ts # Better Auth endpoints
│   └── lib/
│       ├── auth.ts               # Better Auth config
│       └── auth-client.ts        # Client-side auth
│
├── server/
│   ├── server.ts                 # Socket.IO server (port 4000)
│   ├── temp/                     # Temp audio files directory
│   └── package.json
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # DB migrations
│
├── public/                       # Static assets
│   └── *.svg
│
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.ts                # Next.js config
├── eslint.config.mjs             # ESLint rules
├── postcss.config.mjs            # PostCSS config
├── .env                          # Environment variables
├── README.md                     # Quick start guide
├── SETUP_SUMMARY.md              # Setup instructions
├── BUG_FIXES.md                  # Known issues
├── FLOW_DIAGRAMS.md              # Visual flow diagrams
└── CODE_DOCUMENTATION.md         # This file
```

---

## 🏗️ System Architecture

### **High-Level Flow**

```
┌──────────────────────────────────────────────────────────────┐
│           NEXT.JS CLIENT (React) - Port 3000                 │
│                                                               │
│  ┌────────────────┐         ┌──────────────────┐             │
│  │  page.tsx      │         │  AudioRecorder   │             │
│  │  (Auth UI)     │◄────────┤  (Recording UI)  │             │
│  └────────────────┘         └──────────────────┘             │
│                                      ▲                        │
│  useSession() ◄───────────────────┐  │                       │
│  (Better Auth)                    │  │                       │
│                            useAudioStream Hook               │
│                                 (CORE LOGIC)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Socket.IO connection (lazy-loaded)                │   │
│  │ • MediaRecorder API (audio capture)                 │   │
│  │ • Chunk buffering (network resilience)              │   │
│  │ • XState machine (state management)                 │   │
│  │ • localStorage (session persistence)                │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────┬─────────────────────────────┘
                                 │
                    Socket.IO (WebSocket/Polling)
                                 │
┌────────────────────────────────▼─────────────────────────────┐
│           NODE.JS SERVER (Express) - Port 4000               │
│                                                               │
│  server.ts (Socket.IO Handler)                               │
│  ├─ start-session      → Create session, open file           │
│  ├─ audio-chunk        → Write to .webm, buffer live         │
│  ├─ stop-session       → Upload to Gemini, get summary       │
│  ├─ pause-session      → Pause MediaRecorder                 │
│  └─ disconnect         → Cleanup, close streams              │
│                                                               │
│  Processing Pipeline:                                        │
│  1. Receive audio chunks every 1000ms                        │
│  2. Write to temp file                                       │
│  3. Every 5s: buffer 5KB and send to Gemini for live text    │
│  4. On stop: upload full file for final summary              │
│  5. Save results to PostgreSQL                               │
│  6. Emit to client                                           │
└────────────────────────────────┬─────────────────────────────┘
                                 │
                           PostgreSQL (Neon)
                                 │
┌────────────────────────────────▼─────────────────────────────┐
│           DATABASE (PostgreSQL)                              │
│                                                               │
│  ┌──────────────┐         ┌──────────────────┐              │
│  │ users        │◄────────┤ recordings       │              │
│  │ (auth)       │ userId  │ (audio metadata) │              │
│  └──────────────┘         └──────────────────┘              │
│                                                               │
│  Recording Fields: status, transcript, summary, timestamps   │
└────────────────────────────────────────────────────────────┘
```

---

## 🔑 Core Components Deep Dive

### **1. [`app/page.tsx`](app/page.tsx ) - Authentication Page**

**Purpose:** Sign up/Sign in interface using Better Auth

**User Flow:**
```
1. User loads app
2. Check if session exists (useSession hook)
3. If YES → Show AudioRecorder
4. If NO → Show auth form (email + password)
5. User clicks "Create Account" or "Sign In"
6. Form validates inputs
7. Better Auth processes request
8. Session created → AudioRecorder displays
```

**Key State:**
```typescript
email           // Input: user@example.com
password        // Input: secure password
name            // Input: Full Name (sign up only)
isSignUp        // Toggle: "Sign In" ↔ "Create Account"
isLoadingAuth   // Loading spinner during auth
errors          // Validation errors: { email?, password?, name? }
```

**Key Functions:**
```typescript
validateForm()  // Check email format, password length, name (sign up)
handleAuth()    // Call signIn.email() or signUp.email()
```

**Conditional Rendering:**
```typescript
if (isPending) return <LoadingSpinner /> // Session check in progress

if (session?.user) return <AudioRecorder /> // User authenticated

return <AuthForm />  // User not authenticated
```

---

### **2. [`app/components/client/AudioRecorder.tsx`](app/components/client/AudioRecorder.tsx ) - Recording UI**

**Purpose:** Visual interface for recording controls and status display

**States & Their UI:**

| State | Indicator | Buttons | Display |
|-------|-----------|---------|---------|
| **idle** | ● Gray | Start Recording | — |
| **recording** | ● Red (pulsing) | Pause, Stop | Waveform animation + live transcript |
| **paused** | ● Blue (pulsing) | Resume, Stop | — |
| **reconnecting** | ● Yellow (pulsing) | Pause, Stop | "Reconnecting..." banner + buffered count |
| **processing** | ● Purple (pulsing) | — | Spinner + "Processing with AI..." |
| **success** | ● Green | New Recording | AI Summary box + Copy button |
| **error** | ● Red | Try Again | Error message box |

**UI Components Breakdown:**

#### **1. Reconnection Banner** (only when `isReconnecting`)
```tsx
<div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
  <p className="text-yellow-400">Connection Stable</p>
  <p className="text-yellow-400/70">Reconnecting... (3 chunks buffered)</p>
</div>
```

#### **2. Status Indicator**
```tsx
<div className="flex items-center gap-2">
  {/* Status dot */}
  <div className={`w-3 h-3 rounded-full ${
    isRecording ? 'bg-red-500 animate-pulse' :
    isReconnecting ? 'bg-yellow-500 animate-pulse' :
    isProcessing ? 'bg-purple-500 animate-pulse' :
    isSuccess ? 'bg-green-500' :
    isError ? 'bg-red-600' :
    isPaused ? 'bg-blue-400' :
    'bg-gray-500'
  }`} />
  
  {/* Status text */}
  <span className="text-gray-200 uppercase">
    {isReconnecting ? 'RECONNECTING' : status}
  </span>
  
  {/* Buffered chunk count */}
  {queuedChunks > 0 && (
    <span className="ml-auto text-xs bg-yellow-500/20">
      📦 {queuedChunks} buffered
    </span>
  )}
</div>
```

#### **3. Error Display** (when `isError`)
```tsx
{isError && error && (
  <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
    <p className="text-red-400 font-semibold">⚠️ Error</p>
    <p className="text-red-300 text-sm">{error}</p>
  </div>
)}
```

#### **4. Live Transcript** (during recording)
```tsx
{isRecording && liveTranscript && (
  <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-blue-400 font-semibold">📝 Live Transcription</span>
      <div className="w-2 h-2 bg-blue-500 animate-pulse"></div>
    </div>
    <p className="text-gray-300 text-sm whitespace-pre-wrap">
      {liveTranscript}
    </p>
  </div>
)}
```

#### **5. Waveform Visualizer** (during recording)
```tsx
<div className="h-16 flex items-center gap-1">
  {isRecording && [1,2,3,4,5].map(i => (
    <div 
      key={i} 
      className="w-1 bg-blue-500 h-8 animate-bounce" 
      style={{ animationDelay: `${i * 0.1}s` }} 
    />
  ))}
</div>
```

#### **6. Processing Spinner** (when processing)
```tsx
{isProcessing && (
  <div className="flex flex-col items-center gap-3">
    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-purple-400">⏳ Processing with AI...</p>
    <p className="text-purple-300/70 text-xs">Transcribing and generating summary</p>
  </div>
)}
```

#### **7. Control Buttons**
```tsx
{/* Start/New/Retry */}
{(status === 'idle' || isError || isSuccess) && (
  <button onClick={startRecording}>
    {isError ? 'Try Again' : isSuccess ? 'New Recording' : 'Start Recording'}
  </button>
)}

{/* Pause/Resume + Stop */}
{(isRecording || isPaused || isReconnecting) && (
  <>
    {isPaused ? (
      <button onClick={resumeRecording}>Resume</button>
    ) : (
      <button onClick={pauseRecording} disabled={isReconnecting}>
        Pause
      </button>
    )}
    <button onClick={stopRecording}>Stop</button>
  </>
)}
```

#### **8. AI Summary Display** (on success)
```tsx
{summary && isSuccess && (
  <div className="p-6 bg-purple-900/30 border border-purple-500/30 rounded-xl">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-2xl">✨</span>
      <h3 className="text-xl font-bold text-purple-300">AI Summary</h3>
    </div>
    
    <div className="text-gray-200 whitespace-pre-wrap text-sm">
      {summary}
    </div>
    
    <button 
      onClick={() => navigator.clipboard.writeText(summary)}
      className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500"
    >
      📋 Copy Summary
    </button>
  </div>
)}
```

---

### **3. [`app/components/client/hooks/useAudioStream.ts`](app/components/client/hooks/useAudioStream.ts ) - Core Recording Logic**

**This is the heart of the application.** It handles:
- Socket.IO connection lifecycle
- MediaRecorder setup and audio capture
- Chunk buffering and flushing
- XState machine dispatch
- Database integration via server

#### **Constants & Setup**
```typescript
const SOCKET_URL = 'http://localhost:4000';
const CHUNK_INTERVAL_MS = 1000;  // Send chunk every 1 second
const SESSION_STORAGE_KEY = 'currentSessionId';

// Refs for non-state data
const socketRef = useRef<Socket | null>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const streamRef = useRef<MediaStream | null>(null);
const audioChunkQueueRef = useRef<Blob[]>([]);
const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
```

#### **Socket Initialization** (once per session)
```typescript
useEffect(() => {
  if (!session?.user?.id) return; // Don't connect if not logged in
  
  // Create socket with lazy connection
  socketRef.current = io(SOCKET_URL, {
    autoConnect: false,           // ✅ Don't connect immediately
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  
  const socket = socketRef.current;
  
  // Event: Connected
  socket.on('connect', () => {
    console.log('✅ Socket Connected');
    setIsConnected(true);
    
    // ✅ CRITICAL: Flush buffered chunks
    if (audioChunkQueueRef.current.length > 0) {
      console.log(`📤 Flushing ${audioChunkQueueRef.current.length} buffered chunks`);
      audioChunkQueueRef.current.forEach(chunk => {
        socket.emit('audio-chunk', chunk);
      });
      audioChunkQueueRef.current = [];
      setQueuedChunks(0);
    }
  });
  
  // Event: Disconnected
  socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket Disconnected:', reason);
    setIsConnected(false);
    // Still recording? → switch to buffering mode
  });
  
  // Event: Live transcription chunk from server
  socket.on('live-transcript', (data) => {
    setLiveTranscript(prev => prev + ' ' + data.text);
  });
  
  // Event: Final summary ready
  socket.on('processing-complete', (data) => {
    setSummary(data.summary);
    send({ type: 'COMPLETE' }); // → 'success' state
  });
  
  // Event: Error from server
  socket.on('error', (data) => {
    console.error('Server error:', data);
    send({ type: 'ERROR', error: data.message });
  });
  
  // Cleanup
  return () => {
    console.log('🧹 Cleaning up socket');
    socket.disconnect();
  };
}, [session?.user?.id]); // Only re-run if user ID changes
```

#### **Auto-Resume on Tab Refresh** (once per mount)
```typescript
useEffect(() => {
  // Check if there's a saved session
  const existingSessionId = typeof window !== 'undefined'
    ? localStorage.getItem(SESSION_STORAGE_KEY)
    : null;
  
  const wasRecording = typeof window !== 'undefined'
    ? localStorage.getItem('wasRecording') === 'true'
    : false;
  
  // If user was recording before refresh AND logged in
  if (existingSessionId && wasRecording && session?.user?.id && state.value === 'idle') {
    // ✅ Prevent infinite loop: clear flag immediately
    localStorage.removeItem('wasRecording');
    
    // Wait 1.5s before resuming (for safety)
    const timer = setTimeout(() => {
      console.log(`🔄 Auto-resuming session: ${existingSessionId}`);
      startRecording(); // Calls with existing sessionId
    }, 1500);
    
    return () => clearTimeout(timer);
  }
}, [session?.user?.id]); // Only run when user logs in
```

#### **Start Recording Function** (called when user clicks button)
```typescript
const startRecording = useCallback(async () => {
  try {
    console.log('🎤 Starting recording...');
    send({ type: 'START', sessionId: `session-${Date.now()}` });
    
    // ✅ FIX: Connect socket if not connected (lazy connection)
    if (socketRef.current && !socketRef.current.connected) {
      console.log('🔌 Connecting socket...');
      socketRef.current.connect();
      
      // Wait for actual connection (max 5 seconds)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Socket connection timeout')), 
          5000
        );
        
        socketRef.current!.once('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        socketRef.current!.once('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
    
    // 1. Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true 
    });
    streamRef.current = stream;
    
    // 2. Create MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, { 
      mimeType: 'audio/webm' 
    });
    mediaRecorderRef.current = mediaRecorder;
    
    // 3. Create or resume session
    const existingSession = typeof window !== 'undefined'
      ? localStorage.getItem(SESSION_STORAGE_KEY)
      : null;
    
    const sessionId = existingSession || `session-${Date.now()}`;
    const isResume = !!existingSession;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      localStorage.setItem('wasRecording', 'true');
    }
    
    console.log(isResume 
      ? `🔄 Resuming session: ${sessionId}` 
      : `🎙️ New session: ${sessionId}`
    );
    
    const userId = session?.user?.id || 'anonymous';
    
    // 4. Tell server to start session
    socketRef.current?.emit('start-session', {
      sessionId,
      isResume,
      userId
    });
    
    // 5. Setup chunk capture and send
    let isFirstChunk = true;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      
      // Skip WebM header on resume
      if (!isFirstChunk || !isResume) {
        if (socketRef.current?.connected) {
          // Connected: send immediately
          socketRef.current.emit('audio-chunk', event.data);
          console.log(`📤 Sent chunk (${event.data.size} bytes)`);
        } else {
          // Disconnected: buffer locally
          audioChunkQueueRef.current.push(event.data);
          setQueuedChunks(q => q + 1);
          console.log(`📦 Buffering chunk (disconnected) - ${audioChunkQueueRef.current.length} queued`);
        }
      }
      isFirstChunk = false;
    };
    
    // 6. Start recording (capture every 1000ms)
    mediaRecorder.start(CHUNK_INTERVAL_MS);
    console.log('▶️ Recording started');
    
  } catch (error) {
    console.error('Start recording error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Distinguish between different error types
    let displayError = errorMsg;
    if (errorMsg.includes('NotAllowedError')) {
      displayError = 'Microphone permission denied. Please enable it in browser settings.';
    } else if (errorMsg.includes('NotFoundError')) {
      displayError = 'No microphone found. Please connect one and try again.';
    }
    
    send({ type: 'ERROR', error: displayError });
  }
}, [send, session?.user?.id]);
```

#### **Pause Recording**
```typescript
const pauseRecording = useCallback(() => {
  if (mediaRecorderRef.current?.state === 'recording') {
    mediaRecorderRef.current.pause();
    send({ type: 'PAUSE' });
    console.log('⏸️ Recording paused');
  }
}, [send]);
```

#### **Resume Recording**
```typescript
const resumeRecording = useCallback(() => {
  if (mediaRecorderRef.current?.state === 'paused') {
    mediaRecorderRef.current.resume();
    send({ type: 'RESUME' });
    console.log('▶️ Recording resumed');
  }
}, [send]);
```

#### **Stop Recording** (most complex)
```typescript
const stopRecording = useCallback(() => {
  try {
    // 1. Stop MediaRecorder
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    
    // 2. Stop microphone stream
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    // 3. Clear session storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentSessionId');
      localStorage.removeItem('wasRecording');
    }
    
    // 4. Flush remaining chunks (if any)
    if (audioChunkQueueRef.current.length > 0) {
      console.log(`📤 Flushing ${audioChunkQueueRef.current.length} remaining chunks on stop`);
      audioChunkQueueRef.current.forEach(chunk => {
        socketRef.current?.emit('audio-chunk', chunk);
      });
      audioChunkQueueRef.current = [];
      setQueuedChunks(0);
    }
    
    // 5. Tell server to process
    socketRef.current?.emit('stop-session');
    
    // 6. Update state
    send({ type: 'STOP' }); // → 'processing' state
    
    console.log('⏹️ Recording stopped, waiting for summary...');
    
  } catch (error) {
    console.error('Stop recording error:', error);
    send({ type: 'ERROR', error: 'Failed to stop recording' });
  }
}, [send]);
```

#### **Return Hook Values**
```typescript
return {
  status: state.value,        // 'idle' | 'recording' | 'paused' | ...
  summary,                    // AI summary text (null until complete)
  liveTranscript,             // Accumulated live transcription
  error: state.context.error, // Error message (if any)
  queuedChunks,               // Number of buffered chunks
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
};
```

---

### **4. [`app/components/client/machines/recorderMachine.ts`](app/components/client/machines/recorderMachine.ts ) - XState Machine**

**Purpose:** Centralized state management for recording lifecycle

**State Diagram:**
```
         ┌──────────────┐
         │    START     │
         └──────┬───────┘
                │
         ┌──────▼──────────┐
         │     IDLE        │ ◄────────────────────────────┐
         └──────┬──────────┘                              │
                │                                         │
         START  │                                    START│
                ▼                                         │
         ┌──────────────────────────┐                    │
         │     RECORDING            │                    │
         │   (user speaking)        │                    │
         └──┬───────┬───────┬───────┘                    │
            │       │       │                            │
        PAUSE│       │       │ SERVER_      │ STOP      │
             │       │       │DISCONNECT    │           │
             ▼       ▼       ▼              │           │
         ┌─────────────┐  ┌─────────────┐   │          │
         │   PAUSED    │  │ RECONNECTING│   │          │
         └──────┬──────┘  └─────┬───────┘   │          │
            RESUME│              │           │          │
                  │              │ SERVER_   │          │
                  │              │CONNECTED  │          │
                  └──────┬───────┘           │          │
                         │                   │          │
                         │                   ▼          │
                         │            ┌──────────────┐  │
                         │            │  PROCESSING  │  │
                         │            │ (Gemini API) │  │
                         │            └──────┬───────┘  │
                         │                   │          │
                         │            COMPLETE│         │
                         │                   ▼          │
                         │            ┌──────────────┐  │
                         │            │   SUCCESS    │──┴─ START (new)
                         │            │ (got summary)│
                         │            └──────────────┘
                         │
                    STOP │
                         ▼
                  ┌──────────────┐
                  │    ERROR     │
                  │ (mic denied) │
                  └──────┬───────┘
                         │
                    START│ (retry)
                         └──────────────────────────────→ IDLE
```

**Machine Definition:**
```typescript
import { createMachine } from 'xstate';

export type RecorderContext = {
  sessionId: string | null;
  error: string | null;
  queuedChunks: number;
};

export type RecorderEvent =
  | { type: 'START'; sessionId: string }
  | { type: 'STOP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SERVER_CONNECTED' }
  | { type: 'SERVER_DISCONNECTED' }
  | { type: 'ERROR'; error: string }
  | { type: 'QUEUE_UPDATED'; count: number }
  | { type: 'COMPLETE' };

export const recorderMachine = createMachine({
  id: 'recorder',
  initial: 'idle',
  context: {
    sessionId: null,
    error: null,
    queuedChunks: 0,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'recording',
          actions: assign({ sessionId: (_, event) => event.sessionId }),
        },
      },
    },
    
    recording: {
      on: {
        PAUSE: 'paused',
        STOP: 'processing',
        SERVER_DISCONNECTED: 'reconnecting',
        ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error }),
        },
        QUEUE_UPDATED: {
          actions: assign({ queuedChunks: (_, event) => event.count }),
        },
      },
    },
    
    paused: {
      on: {
        RESUME: 'recording',
        STOP: 'processing',
        ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error }),
        },
      },
    },
    
    reconnecting: {
      on: {
        SERVER_CONNECTED: 'recording',
        STOP: 'processing',
        QUEUE_UPDATED: {
          actions: assign({ queuedChunks: (_, event) => event.count }),
        },
      },
    },
    
    processing: {
      on: {
        COMPLETE: 'success',
        ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error }),
        },
      },
    },
    
    success: {
      on: {
        START: {
          target: 'recording',
          actions: assign({ 
            sessionId: (_, event) => event.sessionId,
            error: () => null, // Clear previous errors
          }),
        },
      },
    },
    
    error: {
      on: {
        START: {
          target: 'recording',
          actions: assign({
            sessionId: (_, event) => event.sessionId,
            error: () => null, // Clear error
          }),
        },
      },
    },
  },
});
```

**How It Works:**
1. User clicks "Start" → `'idle'` → `'recording'`
2. User clicks "Pause" → `'recording'` → `'paused'`
3. User clicks "Stop" → (any state) → `'processing'`
4. Server sends summary → `'processing'` → `'success'`
5. User clicks "New Recording" → `'success'` → `'recording'`

If network drops while recording:
- `useAudioStream` calls `send({ type: 'SERVER_DISCONNECTED' })`
- State → `'reconnecting'`
- Chunks buffer locally
- When reconnected: `send({ type: 'SERVER_CONNECTED' })`
- State → `'recording'`
- Buffered chunks flush automatically

---

### **5. [`server/server.ts`](server/server.ts ) - Backend Server**

**Purpose:** Accept audio chunks via Socket.IO, process with Gemini API, return transcription

**Server Setup:**
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Active sessions tracked by sessionId
const activeSessions = new Map();

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

#### **Event 1: start-session**
```typescript
io.on('connection', (socket) => {
  
  socket.on('start-session', async ({ sessionId, isResume, userId }) => {
    console.log(`🎙️ Session started: ${sessionId} (resume: ${isResume})`);
    
    try {
      // 1. Create database record
      if (!isResume && userId) {
        const recording = await prisma.recording.create({
          data: {
            sessionId,
            userId,
            filePath: `server/temp/${sessionId}.webm`,
            status: 'RECORDING',
          }
        });
        console.log(`💾 Created recording: ${recording.id}`);
      }
      
      // 2. Create file stream
      const tempDir = path.join(process.cwd(), 'server/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, `${sessionId}.webm`);
      const fileStream = fs.createWriteStream(filePath, {
        flags: isResume ? 'a' : 'w', // Append if resume, write if new
      });
      
      // 3. Store session info
      activeSessions.set(sessionId, {
        fileStream,
        socketId: socket.id,
        filePath,
        gracePeriodTimer: null,
        chunkBuffer: [],
        lastTranscriptionTime: Date.now(),
        isProcessing: false,
      });
      
      // 4. Update database
      await prisma.recording.update({
        where: { sessionId },
        data: { status: 'RECORDING' }
      });
      
      socket.emit('session-started', { sessionId });
      
    } catch (error) {
      console.error('Error starting session:', error);
      socket.emit('error', { message: 'Failed to start session' });
    }
  });
});
```

#### **Event 2: audio-chunk**
```typescript
socket.on('audio-chunk', async (chunk) => {
  const sessionId = /* get from context */;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    console.warn(`⚠️ Session not found: ${sessionId}`);
    return;
  }
  
  try {
    // 1. Write chunk to file immediately
    session.fileStream.write(chunk);
    console.log(`📝 Wrote chunk: ${chunk.size} bytes`);
    
    // 2. Buffer for live transcription
    session.chunkBuffer.push(Buffer.from(chunk));
    
    // 3. Every 5 seconds, send buffered audio to Gemini
    const now = Date.now();
    if (now - session.lastTranscriptionTime >= 5000) {
      session.lastTranscriptionTime = now;
      
      if (session.chunkBuffer.length > 0) {
        // Process asynchronously (don't block socket)
        processLiveChunk(sessionId, session, socket);
      }
    }
    
  } catch (error) {
    console.error('Error handling chunk:', error);
    socket.emit('error', { message: 'Failed to process audio chunk' });
  }
});

async function processLiveChunk(sessionId, session, socket) {
  try {
    // 1. Combine buffered chunks
    const audioBuffer = Buffer.concat(session.chunkBuffer);
    const tempChunkPath = `server/temp/${sessionId}-chunk-${Date.now()}.webm`;
    
    fs.writeFileSync(tempChunkPath, audioBuffer);
    
    // 2. Upload to Gemini
    const uploadResult = await fileManager.uploadFile(tempChunkPath);
    console.log(`📤 Uploaded to Gemini: ${uploadResult.file.uri}`);
    
    // 3. Get transcription
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: 'audio/webm',
          fileUri: uploadResult.file.uri,
        }
      },
      { text: 'Transcribe this audio chunk concisely.' }
    ]);
    
    const liveText = result.response.text();
    console.log(`📝 Live transcript: ${liveText.substring(0, 50)}...`);
    
    // 4. Send to client
    socket.emit('live-transcript', { sessionId, text: liveText });
    
    // 5. Update database
    await prisma.recording.update({
      where: { sessionId },
      data: {
        liveTranscript: (previousTranscript || '') + ' ' + liveText,
        chunkCount: { increment: 1 }
      }
    });
    
    // 6. Clean up temp chunk
    fs.unlinkSync(tempChunkPath);
    session.chunkBuffer = [];
    
  } catch (error) {
    console.error('Live transcription error:', error);
    // Don't fail the session, just skip this chunk
  }
}
```

#### **Event 3: stop-session**
```typescript
socket.on('stop-session', async () => {
  const sessionId = /* get from context */;
  const session = activeSessions.get(sessionId);
  
  if (!session) return;
  
  try {
    // 1. Close file stream
    session.fileStream.end();
    console.log(`📁 Closed file: ${session.filePath}`);
    
    // 2. Mark as processing
    await prisma.recording.update({
      where: { sessionId },
      data: {
        status: 'PROCESSING',
        endedAt: new Date(),
      }
    });
    
    // 3. Process with Gemini (with retries)
    let success = false;
    let attempt = 0;
    let finalSummary = '';
    
    while (attempt < 3 && !success) {
      attempt++;
      try {
        // Upload full file
        const uploadResult = await fileManager.uploadFile(session.filePath);
        console.log(`🚀 Attempt ${attempt}: Uploading to Gemini`);
        
        // Get transcription + summary
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: 'audio/webm',
              fileUri: uploadResult.file.uri,
            }
          },
          {
            text: `You are an expert meeting transcriber. Analyze this audio and provide:

1. **Full Transcription** (speaker tags like [Speaker 1], [Speaker 2])
2. **Key Points** (3-5 bullet points)
3. **Action Items** (who, what, deadline)
4. **Decisions Made** (agreements reached)

Use Markdown formatting with clear headers (##).`
          }
        ]);
        
        finalSummary = result.response.text();
        console.log(`✅ Transcription complete (${finalSummary.length} chars)`);
        
        // 4. Save to database
        await prisma.recording.update({
          where: { sessionId },
          data: {
            status: 'COMPLETED',
            transcript: finalSummary,
            summary: finalSummary,
            processedAt: new Date(),
            errorMessage: null,
          }
        });
        
        // 5. Send to client
        socket.emit('processing-complete', {
          sessionId,
          summary: finalSummary
        });
        
        // 6. Clean up temp file
        fs.unlinkSync(session.filePath);
        
        success = true;
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          // Exponential backoff: 2s, 4s, 8s
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        } else {
          // All retries exhausted
          throw error;
        }
      }
    }
    
    if (!success) {
      throw new Error('Failed to process audio after 3 attempts');
    }
    
  } catch (error) {
    console.error('Error stopping session:', error);
    
    // Mark as failed in database
    await prisma.recording.update({
      where: { sessionId },
      data: {
        status: 'FAILED',
        errorMessage: error.message
      }
    });
    
    // Notify client
    socket.emit('error', { message: 'Failed to process recording' });
    
  } finally {
    // Clean up
    activeSessions.delete(sessionId);
  }
});
```

#### **Event 4: disconnect** (grace period for reconnection)
```typescript
socket.on('disconnect', () => {
  const sessionId = /* get from context */;
  const session = activeSessions.get(sessionId);
  
  if (session) {
    console.log(`⚠️ Client disconnected: ${sessionId}`);
    
    // Start 30-second grace period
    session.gracePeriodTimer = setTimeout(() => {
      console.log(`🧹 Grace period expired: ${sessionId}`);
      
      // Close file and cleanup
      session.fileStream.end();
      activeSessions.delete(sessionId);
    }, 30000);
  }
});

socket.on('reconnect', () => {
  const sessionId = /* get from context */;
  const session = activeSessions.get(sessionId);
  
  if (session && session.gracePeriodTimer) {
    console.log(`✅ Client reconnected: ${sessionId}`);
    
    // Cancel grace period timer
    clearTimeout(session.gracePeriodTimer);
    session.gracePeriodTimer = null;
    
    // File continues to receive chunks
  }
});
```

---

### **6. [`prisma/schema.prisma`](prisma/schema.prisma ) - Database Schema**

**Purpose:** Define data models for user management and recording persistence

#### **User Model**
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified Boolean?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  sessions      Session[]
  accounts      Account[]
  recordings    Recording[]  // ← User's recordings
}
```

**Fields:**
- `id` - Unique identifier (CUID format)
- `name` - Full name (optional)
- `email` - Email address (unique, used for sign in)
- `emailVerified` - Email confirmation status
- `image` - Profile picture URL (optional)
- `createdAt` - Account creation time
- `updatedAt` - Last updated time

#### **Recording Model** (NEW)
```prisma
model Recording {
  id            String   @id @default(cuid())
  sessionId     String   @unique
  userId        String
  
  // File Information
  filePath      String?               // Path to .webm file
  fileSize      Int?                  // Size in bytes
  duration      Int?                  // Duration in seconds
  mimeType      String   @default("audio/webm")
  
  // Transcription Results
  transcript    String?  @db.Text     // Full transcription from Gemini
  summary       String?  @db.Text     // AI summary (with key points, action items)
  liveTranscript String? @db.Text     // Accumulated live transcription chunks
  
  // Status Tracking
  status        RecordingStatus @default(RECORDING)
  
  // Timestamps
  startedAt     DateTime @default(now())
  endedAt       DateTime?              // When user stopped recording
  processedAt   DateTime?              // When Gemini finished processing
  
  // Metadata
  errorMessage  String?  @db.Text     // Error details if failed
  geminiTokensUsed Int?               // Tokens used by Gemini (for cost tracking)
  processingTimeMs Int?               // Time to generate summary
  chunkCount    Int      @default(0)  // Number of audio chunks processed
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])        // Fast lookup by user
  @@index([sessionId])     // Fast lookup by session
  @@index([status])        // Fast lookup by status
  @@map("recording")
}

enum RecordingStatus {
  RECORDING    // Currently recording
  PROCESSING   // Uploading to Gemini
  COMPLETED    // Successfully transcribed
  FAILED       // Error occurred
  PAUSED       // User paused (optional)
}
```

**Query Examples:**
```typescript
// Get all recordings for a user
const userRecordings = await prisma.recording.findMany({
  where: { userId: session.user.id },
  orderBy: { createdAt: 'desc' }
});

// Get latest completed recording
const lastRecording = await prisma.recording.findFirst({
  where: { userId, status: 'COMPLETED' },
  orderBy: { processedAt: 'desc' }
});

// Get all failed recordings (for debugging)
const failedRecordings = await prisma.recording.findMany({
  where: { status: 'FAILED' },
  include: { user: true }
});
```

---

## 🔄 Complete User Flow

### **Scenario 1: Normal Recording** ✅

```
USER                              CLIENT                        SERVER
  │                                 │                              │
  ├─ Opens app                      │                              │
  │                           useSession check                     │
  │                                 │◄─────── Get session ────────►│ Better Auth
  │                                 │                              │
  │◄─── Sign in form shows ────────│
  │
  ├─ Enters email/password
  │
  ├─ Clicks "Sign In"               │                              │
  │                           handleAuth                           │
  │                                 │◄─ signIn.email() ──────────►│ Better Auth
  │                                 │                              │
  │◄─── Session created ────────────│                              │
  │
  │◄─── AudioRecorder shows ────────│                              │
  │                                 │ useEffect: Socket init       │
  │                                 │ (autoConnect: false)         │
  │
  ├─ Clicks "Start Recording"
  │                           startRecording()
  │                                 │
  │                           1. socket.connect()
  │                                 │───── Connection ────────────►│ Socket.IO
  │                                 │                              │
  │                           2. getUserMedia()
  │                                 │
  │                           (Mic permission prompt)
  │
  ├─ Approves microphone access
  │
  │                           3. Start MediaRecorder
  │                           4. emit('start-session')
  │                                 │─ {sessionId, isResume, userId} ──►│
  │                                 │                              │
  │                                 │◄─ session-started ─────────│
  │
  ├─ Starts speaking
  │
  │                           5. ondataavailable fires
  │                              every 1000ms
  │                                 │
  │                           emit('audio-chunk')
  │                                 │───────────────────────────────►│ Write to file
  │                                 │                              │ Buffer for live TX
  │
  │  [Repeat every 1000ms for duration]                             │
  │
  │                           Every 5 seconds:
  │                           • Buffer chunks
  │                           • Upload to Gemini
  │                                 │                              │
  │                                 │◄─ live-transcript ─────────│
  │                                 │  (e.g., "Hello, this is...")│
  │
  │◄─── Live transcript shows ─────│
  │
  ├─ Clicks "Stop"
  │
  │                           stopRecording()
  │                                 │
  │                           • Stop MediaRecorder
  │                           • Stop microphone
  │                           • Flush remaining chunks
  │                           • emit('stop-session')
  │                                 │─────────────────────────────►│ Close file
  │                                 │                              │ Update status: PROCESSING
  │                                 │                              │
  │                                 │                              │ Upload full .webm to Gemini
  │                                 │                              │ Generate final summary
  │                                 │                              │
  │                                 │                              │ [Processing time: 30-60s]
  │                                 │                              │
  │                                 │◄─ processing-complete ─────│
  │                                 │  {summary: "...full text..."}│
  │
  │◄─── AI Summary displays ───────│
  │
  ├─ Reads summary
  │
  ├─ Clicks "Copy Summary"
  │
  │◄─── Copied to clipboard ───────│
  │
  └─ Done!
```

### **Scenario 2: Network Disconnection** 🌐

```
USER                              CLIENT                        SERVER
  │ [Recording in progress]
  │
  │  [WiFi drops]
  │
  │                           socket.on('disconnect')
  │                                 │
  │                           Chunk buffering starts
  │                           State: 'reconnecting'
  │
  │◄─── Yellow banner shows ───────│
  │     "Connection Unstable"
  │     "Buffering 3 chunks..."
  │
  │  [User continues speaking]
  │
  │                           MediaRecorder continues
  │                           Chunks buffer in memory
  │
  │  [WiFi reconnects]
  │
  │                           socket.on('connect')
  │                                 │
  │                           Flush buffered chunks
  │                                 │───────────────────────────────►│ Write all chunks
  │                                 │                              │
  │                           State: 'recording'
  │
  │◄─── Yellow banner disappears ─│
  │
  │  [Continue recording normally]
  │
  └─ No data lost!
```

### **Scenario 3: Tab Refresh During Recording** 🔄

```
USER                              CLIENT                        SERVER
  │ [Recording in progress]
  │
  │ localStorage.setItem('wasRecording', 'true')
  │ localStorage.setItem('currentSessionId', 'session-123')
  │
  ├─ Accidentally refreshes tab
  │
  │                           Page reload
  │                           Usefulness check
  │                                 │
  │                           useEffect detects:
  │                           • wasRecording = true
  │                           • sessionId saved
  │                           • User logged in
  │                                 │
  │                           Wait 1500ms, then:
  │                           startRecording()
  │                                 │
  │                           socket.connect()
  │                                 │───────────────────────────────►│
  │                                 │                              │
  │                           emit('start-session', {isResume: true})
  │                                 │──── Same sessionId ─────────►│ Append to existing file
  │                                 │                              │
  │◄─── Recording resumes ─────────│                              │
  │                                 │                              │
  │  [Old chunks + new chunks]
  │                                 │  ✅ Continuous recording!
  │
  └─ Session preserved!
```

---

## 🛠️ Environment Configuration

### **Client `.env` (Next.js - Port 3000)**
```bash
# Authentication
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API & Socket
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### **Server `.env` (Node.js - Port 4000)**
```bash
# Port
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/audio_app

# Gemini API
GEMINI_API_KEY=your_api_key_here

# CORS
CLIENT_URL=http://localhost:3000
```

---

## 🚀 Running the Application

### **Terminal 1: Start Backend Server**
```bash
npm run dev
# Runs: tsx server/server.ts
# Starts on http://localhost:4000
```

### **Terminal 2: Start Frontend**
```bash
npm run dev:next
# Runs: next dev
# Starts on http://localhost:3000
```

### **Open Browser**
```
http://localhost:3000
```

---

## 📊 Current Issues & Solutions

### **Issue 1: Socket Connects Too Early** ❌
**Problem:** Socket was connecting on component mount, causing infinite polling requests.

**Solution:** 
- Set `autoConnect: false` in socket options
- Manually call `socket.connect()` in `startRecording()`
- Only connect when user actually starts recording

### **Issue 2: Infinite Auto-Resume Loop** ❌
**Problem:** `useEffect` dependencies on `state.value` caused infinite re-triggering.

**Solution:**
- Changed dependencies to only `[session?.user?.id]`
- Clear `wasRecording` flag immediately after reading
- Add state check `state.value === 'idle'` before resuming

### **Issue 3: Socket Disconnects Immediately After Connect** ❌
**Problem:** Socket connects but then immediately disconnects, causing chunks to queue infinitely.

**Solution:**
- Wait for actual connection confirmation with promise
- Timeout after 5 seconds if connection fails
- Add error handling for connection errors

---

## 📝 Summary

This is a production-ready audio transcription app with:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14 + React 18 | UI and state management |
| Real-time | Socket.IO | Bidirectional audio streaming |
| Audio | MediaRecorder API | Browser microphone access |
| State | XState 5.24 | Reliable state transitions |
| AI | Google Gemini 2.0 | Transcription and summarization |
| Database | PostgreSQL + Prisma | Data persistence |
| Auth | Better Auth | User authentication |
| Styling | Tailwind CSS | UI design |

**Key Strengths:**
- ✅ Real-time transcription during recording
- ✅ Automatic reconnection with chunk buffering
- ✅ Session persistence across tab refreshes
- ✅ AI-powered meeting summaries
- ✅ User authentication and multi-user support
- ✅ Robust error handling and recovery

---

**Last Updated:** November 26, 2025
