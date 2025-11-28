# 🔄 Audio Recording Flow - Visual Guide

## Normal Recording Flow (Happy Path)

```
USER                    CLIENT                      SERVER
 │                         │                            │
 │  Click "Start"          │                            │
 │────────────────────────>│                            │
 │                         │                            │
 │                         │  getUserMedia()            │
 │                         │  (Ask mic permission)      │
 │                         │                            │
 │  [Allow]                │                            │
 │────────────────────────>│                            │
 │                         │                            │
 │                         │  sessionId = "session-123" │
 │                         │  START event               │
 │                         │  XState: idle → recording  │
 │                         │                            │
 │                         │  start-session             │
 │                         │───────────────────────────>│
 │                         │                            │ Create file stream
 │                         │                            │ "session-123.webm"
 │                         │                            │
 │  🎤 Speaking...         │                            │
 │                         │  MediaRecorder chunks      │
 │                         │  (every 1 second)          │
 │                         │                            │
 │                         │  audio-chunk #1            │
 │                         │───────────────────────────>│ Write to file
 │                         │  audio-chunk #2            │
 │                         │───────────────────────────>│ Write to file
 │                         │  audio-chunk #3            │
 │                         │───────────────────────────>│ Write to file
 │                         │                            │
 │  Click "Stop"           │                            │
 │────────────────────────>│                            │
 │                         │  STOP event                │
 │                         │  XState: recording → proc. │
 │                         │                            │
 │                         │  stop-session              │
 │                         │───────────────────────────>│ Close file
 │                         │                            │ "session-123.webm" saved
 │                         │  processing-complete       │
 │                         │<───────────────────────────│
```

---

## Reconnection Flow (Network Glitch)

```
USER                    CLIENT                      SERVER
 │                         │                            │
 │  Recording...           │  audio-chunk #1            │
 │                         │───────────────────────────>│ Write ✅
 │                         │                            │
 │                         │  audio-chunk #2            │
 │                         │───────────────────────────>│ Write ✅
 │                         │                            │
 │                         │ ⚠️ NETWORK DISCONNECT      │
 │                         │xxxxxxxxxxxxxxxxxxxxxxxxx   │
 │                         │                            │
 │                         │  SERVER_DISCONNECTED event │
 │                         │  XState: recording → recon.│
 │                         │                            │
 │  🎤 Still speaking...   │  audio-chunk #3            │
 │                         │  → chunkQueue.push(#3)  📦 │
 │                         │                            │
 │                         │  audio-chunk #4            │
 │                         │  → chunkQueue.push(#4)  📦 │
 │                         │                            │
 │  UI shows:              │  QUEUE_UPDATED event       │
 │  "📦 Buffering 2 chunks"│  context.queuedChunks = 2  │
 │                         │                            │
 │                         │ ✅ NETWORK RESTORED        │
 │                         │<═══════════════════════════>│
 │                         │  connect event             │
 │                         │  SERVER_CONNECTED event    │
 │                         │  XState: recon. → recording│
 │                         │                            │
 │                         │  🚀 Flush queue:           │
 │                         │  audio-chunk #3            │
 │                         │───────────────────────────>│ Write ✅
 │                         │  audio-chunk #4            │
 │                         │───────────────────────────>│ Write ✅
 │                         │                            │
 │  UI shows:              │  QUEUE_UPDATED event       │
 │  "RECORDING"            │  context.queuedChunks = 0  │
 │                         │                            │
 │                         │  audio-chunk #5            │
 │                         │───────────────────────────>│ Write ✅
```

**Result:** No data lost! Chunks #3 and #4 were safely buffered.

---

## Tab Refresh Flow (Session Resumption)

```
USER                    CLIENT                      SERVER
 │                         │                            │
 │  Recording...           │  audio-chunk #1            │
 │                         │───────────────────────────>│ Write to session-123.webm
 │                         │  audio-chunk #2            │
 │                         │───────────────────────────>│ Write to session-123.webm
 │                         │                            │
 │  Press F5 (Refresh) 🔄  │                            │
 │────────────────────────>│  disconnect event          │
 │                         │                            │
 │                         │                  ⏱️ Start 30s timer
 │                         │                  "Grace period for session-123"
 │  Page Reloading...      │                            │
 │                         │                            │
 │  [5 seconds later]      │                            │
 │  Page Loaded ✅         │                            │
 │                         │  connect event             │
 │                         │<═══════════════════════════>│
 │                         │                            │
 │                         │  localStorage.getItem()    │
 │                         │  → "session-123" exists    │
 │                         │                            │
 │  Click "Start"          │  isResume = true           │
 │────────────────────────>│  start-session             │
 │                         │  { sessionId: "session-123"│
 │                         │    isResume: true }        │
 │                         │───────────────────────────>│
 │                         │                            │ ✅ Cancel timer
 │                         │                            │ ✅ Keep same file open
 │                         │                            │ "session-123.webm" (append)
 │  🎤 Speaking again...   │  audio-chunk #3            │
 │                         │───────────────────────────>│ Write to SAME file ✅
 │                         │  audio-chunk #4            │
 │                         │───────────────────────────>│ Write to SAME file ✅
```

**Result:** Single continuous file with all audio before AND after refresh!

---

## Grace Period Expiration (User Never Returns)

```
USER                    CLIENT                      SERVER
 │                         │                            │
 │  Recording...           │  audio-chunk #1            │
 │                         │───────────────────────────>│ Write to session-123.webm
 │                         │                            │
 │  Close Tab ❌           │  disconnect event          │
 │                         │                            │
 │                         │                  ⏱️ Start 30s timer
 │                         │                  "Grace period for session-123"
 │  [User leaves]          │                            │
 │                         │                            │
 │  ... 30 seconds ...     │                            │
 │                         │                            │
 │                         │                  ⏰ Timer expires
 │                         │                  fileStream.end()
 │                         │                  ✅ session-123.webm saved
 │                         │                  activeSessions.delete("session-123")
```

**Result:** File is safely saved even though user never returned.

---

## Error Flow (Mic Permission Denied)

```
USER                    CLIENT                      SERVER
 │                         │                            │
 │  Click "Start"          │                            │
 │────────────────────────>│  getUserMedia()            │
 │                         │                            │
 │  [Block] ❌             │                            │
 │────────────────────────>│  catch (NotAllowedError)   │
 │                         │                            │
 │                         │  ERROR event               │
 │                         │  XState: idle → error      │
 │                         │  context.error = "Mic perm.│
 │                         │   denied..."               │
 │                         │                            │
 │  UI shows:              │                            │
 │  ⚠️ Error box           │                            │
 │  "Microphone permission │                            │
 │   denied. Please allow..│                            │
 │  [Try Again] button     │                            │
 │                         │                            │
 │  Click "Try Again"      │  START event               │
 │────────────────────────>│  XState: error → idle      │
 │                         │  context.error = null      │
 │                         │  getUserMedia() (retry)    │
```

**Result:** User gets clear feedback and can retry after fixing permissions.

---

## XState State Diagram

```
                    ┌──────────────────────────────────┐
                    │         IDLE                     │
                    │  (Waiting for user to start)     │
                    └──────────────────────────────────┘
                                 │
                                 │ START event
                                 ▼
                    ┌──────────────────────────────────┐
                    │       RECORDING                  │
           ┌───────>│  (MediaRecorder active,          │<────────┐
           │        │   sending chunks)                │         │
           │        └──────────────────────────────────┘         │
           │             │        │        │                     │
           │ RESUME      │ PAUSE  │ DISCONNECT  │ ERROR         │
           │             ▼        │        ▼                     │
           │   ┌─────────────┐   │   ┌─────────────────┐       │
           │   │   PAUSED    │   │   │  RECONNECTING   │       │
           └───│ (Buffering) │   │   │  (Buffering +   │       │
               └─────────────┘   │   │   waiting)      │       │
                    │             │   └─────────────────┘       │
                    │ STOP        │          │                  │
                    │             │          │ CONNECTED        │
                    │             │          └──────────────────┘
                    │             │
                    │             │ STOP
                    ▼             ▼
           ┌──────────────────────────────────┐
           │      PROCESSING                  │
           │  (Uploading, waiting for AI)     │
           └──────────────────────────────────┘
                    │
                    │ START (new recording)
                    ▼
              Back to IDLE

           ┌──────────────────────────────────┐
           │         ERROR                    │
           │  (Mic denied, device issue)      │
           └──────────────────────────────────┘
                    │
                    │ START (retry)
                    ▼
              Back to IDLE
```

---

## Data Flow Summary

### Client-Side Storage:
```javascript
localStorage: {
  "currentSessionId": "session-1234567890"  // Persists across refreshes
}

chunkQueue: [
  Blob(chunk1),  // Buffered during disconnect
  Blob(chunk2),
  Blob(chunk3)
]

XState Context: {
  sessionId: "session-1234567890",
  error: null,
  queuedChunks: 3  // Shown to user in UI
}
```

### Server-Side Storage:
```javascript
activeSessions: Map {
  "session-1234567890" => {
    fileStream: WriteStream(./temp/session-1234567890.webm),
    socketId: "abc123",
    gracePeriodTimer: setTimeout(...) | null
  }
}

File System:
./temp/
  └── session-1234567890.webm  (file being written)
```

---

## Key Takeaways

1. **Chunks are buffered client-side** during disconnections
2. **Sessions persist across refreshes** via localStorage
3. **Server waits 30 seconds** before closing files
4. **XState manages all state transitions** cleanly
5. **UI gives real-time feedback** on buffering and errors

This architecture ensures **zero data loss** in real-world scenarios! 🎉
