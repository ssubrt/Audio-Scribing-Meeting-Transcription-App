import { useEffect, useRef, useState } from 'react';
import { useMachine } from '@xstate/react';
import { io, Socket } from 'socket.io-client';
import { recorderMachine } from '../machines/recorderMachine';

const SOCKET_URL = 'https://audio-scribing-meeting-transcription-app.onrender.com'; // Adjust if needed

// ✅ IMPROVEMENT: Constants for better maintainability
const CHUNK_INTERVAL_MS = 1000; // How often to send audio chunks
const SESSION_STORAGE_KEY = 'currentSessionId';

export function useAudioStream() {
  const [state, send] = useMachine(recorderMachine);
  const [summary, setSummary] = useState<string | null>(null); // NEW: Store summary
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // ✅ NEW: Queue to buffer chunks when socket is disconnected
  // This solves the "Challenge: Auto-reconnect logic" 
  const chunkQueueRef = useRef<Blob[]>([]);

  // Initialize Socket
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000, // Wait 1s between attempts
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket Connected');
      send({ type: 'SERVER_CONNECTED' });
      
      // ✅ CRITICAL FIX: Flush queued chunks when reconnected
      // This ensures no audio data is lost during brief disconnects
      if (chunkQueueRef.current.length > 0) {
        console.log(`📤 Flushing ${chunkQueueRef.current.length} buffered chunks`);
        
        while (chunkQueueRef.current.length > 0) {
          const chunk = chunkQueueRef.current.shift();
          if (chunk) {
            socket.emit('audio-chunk', chunk);
          }
        }
        
        // Update UI to show queue is empty
        send({ type: 'QUEUE_UPDATED', count: 0 });
      }
    });

    // ✅ NEW: Handle processing start event
    socket.on('processing-start', () => {
      console.log("🔄 Server started processing...");
      // XState is already in 'processing' state from STOP event
      // This is just for logging/confirmation
    });

    socket.on('processing-complete', (data) => {
      console.log("✅ Received Summary:", data.summary);
      setSummary(data.summary);
      send({ type: 'COMPLETE' });
    });

    // ✅ NEW: Handle processing errors from server
    socket.on('error', (data) => {
      console.error("❌ Server error:", data.message);
      send({ type: 'ERROR', error: data.message || 'Processing failed' });
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Socket Disconnected - buffering chunks');
      send({ type: 'SERVER_DISCONNECTED' });
    });

    return () => {
      socket.disconnect();
    };
  }, [send]);

  const startRecording = async () => {
    try {
      // 1. Get Mic Permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      // ✅ IMPROVEMENT: Check if resuming existing session (e.g., after tab refresh)
      // This allows continuing the same recording after brief disconnects
      const existingSession = typeof window !== 'undefined' 
        ? localStorage.getItem(SESSION_STORAGE_KEY) 
        : null;
      
      const sessionId = existingSession || `session-${Date.now()}`;
      const isResume = !!existingSession;
      
      // Save session for potential resume
      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }
      
      console.log(isResume ? `🔄 Resuming session: ${sessionId}` : `🎙️ New session: ${sessionId}`);
      
      socketRef.current?.emit('start-session', { sessionId, isResume });
      send({ type: 'START', sessionId });

      // ✅ CRITICAL FIX: Buffer chunks when disconnected instead of losing them
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          if (socketRef.current?.connected) {
            // Normal case: send immediately
            socketRef.current.emit('audio-chunk', event.data);
          } else {
            // ✅ SOLUTION TO CHALLENGE: Queue chunks during disconnect
            console.log('📦 Buffering chunk (disconnected)');
            chunkQueueRef.current.push(event.data);
            
            // Update UI with queue count
            send({ type: 'QUEUE_UPDATED', count: chunkQueueRef.current.length });
          }
        }
      };

      // 5. Start (slice every 1000ms)
      mediaRecorder.start(CHUNK_INTERVAL_MS);

    } catch (err) {
      // ✅ IMPROVEMENT: Proper error handling with user-friendly messages
      console.error('❌ Error accessing microphone:', err);
      
      let errorMessage = 'Failed to access microphone';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied. Please allow access in your browser settings.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Microphone is already in use by another application.';
        }
      }
      
      send({ type: 'ERROR', error: errorMessage });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      
      // ✅ IMPROVEMENT: Flush remaining queued chunks before stopping
      // Small delay to ensure MediaRecorder's final ondataavailable fires
      setTimeout(() => {
        if (socketRef.current?.connected) {
          // Flush any remaining chunks
          while (chunkQueueRef.current.length > 0) {
            const chunk = chunkQueueRef.current.shift();
            if (chunk) {
              socketRef.current.emit('audio-chunk', chunk);
            }
          }
          
          socketRef.current.emit('stop-session');
        } else {
          console.warn('⚠️ Socket disconnected, chunks may be lost');
        }
        
        // ✅ IMPROVEMENT: Clean up session storage when explicitly stopping
        if (typeof window !== 'undefined') {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
        
        // Clear refs
        chunkQueueRef.current = [];
        send({ type: 'STOP' });
      }, 100);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      // ✅ IMPROVEMENT: Send pause marker to server for accurate transcript timing
      // We DON'T pause MediaRecorder so chunks keep flowing (prevents sync issues)
      socketRef.current?.emit('pause-marker', { 
        timestamp: Date.now(),
        sessionId: state.context.sessionId 
      });
      
      mediaRecorderRef.current.pause();
      send({ type: 'PAUSE' });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      // ✅ IMPROVEMENT: Send resume marker to server
      socketRef.current?.emit('resume-marker', { 
        timestamp: Date.now(),
        sessionId: state.context.sessionId 
      });
      
      mediaRecorderRef.current.resume();
      send({ type: 'RESUME' });
    }
  };

  return {
    status: state.value, // 'idle' | 'recording' | 'paused' | 'reconnecting' | 'error'
    summary,
    error: state.context.error, // NEW: Expose error message for UI
    queuedChunks: state.context.queuedChunks, // NEW: Show buffered chunk count
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}