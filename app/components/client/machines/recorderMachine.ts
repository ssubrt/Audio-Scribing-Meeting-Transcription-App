import { setup, assign } from 'xstate';

// ✅ IMPROVEMENT: Added queuedChunks count to track buffered audio during reconnects
export type RecorderContext = {
  sessionId: string | null;
  error: string | null;
  queuedChunks: number; // NEW: Track how many chunks are buffered
};

// ✅ IMPROVEMENT: Added ERROR event to handle mic permission denials and other failures
export type RecorderEvent =
  | { type: 'START'; sessionId: string }
  | { type: 'STOP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SERVER_CONNECTED' }
  | { type: 'SERVER_DISCONNECTED' }
  | { type: 'ERROR'; error: string }        // NEW: For handling errors
  | { type: 'QUEUE_UPDATED'; count: number } // NEW: Update buffered chunk count
  | { type: 'COMPLETE' }; // NEW: Indicate processing complete

export const recorderMachine = setup({
  types: {
    context: {} as RecorderContext,
    events: {} as RecorderEvent,
  },
  actions: {
    setSessionId: assign({
      sessionId: ({ event }) => (event.type === 'START' ? event.sessionId : null),
    }),
    clearSession: assign({ 
      sessionId: null,
      error: null,        
      queuedChunks: 0,   
    }),
    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.error : 'Unknown error'),
    }),
    updateQueueCount: assign({
      queuedChunks: ({ event }) => (event.type === 'QUEUE_UPDATED' ? event.count : 0),
    }),
  },
}).createMachine({
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
          actions: 'setSessionId',
        },
      },
    },
    recording: {
      on: {
        STOP: { target: 'processing' },
        PAUSE: { target: 'paused' },
        SERVER_DISCONNECTED: { target: 'reconnecting' },
        ERROR: { target: 'error', actions: 'setError' },
        QUEUE_UPDATED: { actions: 'updateQueueCount' },
      },
    },
    paused: {
      on: {
        RESUME: { target: 'recording' },
        STOP: { target: 'processing' },
        SERVER_DISCONNECTED: { target: 'reconnecting' },
        ERROR: { target: 'error', actions: 'setError' },
      },
    },
    reconnecting: {
      on: {
        SERVER_CONNECTED: { target: 'recording' },
        STOP: { target: 'processing' },
        QUEUE_UPDATED: { actions: 'updateQueueCount' },
      },
    },
    error: {
      on: {
        START: { 
          target: 'idle',
          actions: 'clearSession', 
        },
      },
    },
    processing: {
      on: {
        // You can now restart from here if needed
        START: { 
          target: 'recording',
          actions: 'setSessionId',
        },
        COMPLETE: { target: 'success' }, // 👈 This matches the new state below
      },
      // Note: We don't 'clearSession' on exit here anymore, 
      // because we want the UI to remember the Session ID to display the summary
    },
    // 👇 ADD THIS NEW STATE
    success: {
      on: {
        START: { 
          target: 'recording', 
          actions: ['clearSession', 'setSessionId'] 
        }
      }
    }
  },
});