"use client";

import { useAudioStream } from "./hooks/useAudioStream";
import ReactMarkdown from 'react-markdown'; 

export default function AudioRecorder() {
  const { 
    status, 
    error, 
    queuedChunks,
    summary,
    startRecording, 
    stopRecording, 
    pauseRecording, 
    resumeRecording 
  } = useAudioStream();

  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isReconnecting = status === 'reconnecting';
  const isError = status === 'error';
  const isProcessing = status === 'processing';
  const isSuccess = status === 'success';

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md">
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          isRecording ? 'bg-red-500 animate-pulse' : 
          isReconnecting ? 'bg-yellow-500 animate-pulse' : 
          isProcessing ? 'bg-purple-500 animate-pulse' :
          isSuccess ? 'bg-green-500' :
          isError ? 'bg-red-600' :
          isPaused ? 'bg-blue-400' :
          'bg-gray-500'
        }`} />
        <span className="text-gray-200 font-mono uppercase tracking-wider text-sm">
          {status.toString()}
        </span>
      </div>
      
      {/* Buffering Indicator */}
      {isReconnecting && queuedChunks > 0 && (
        <div className="flex items-center gap-2 text-yellow-400 text-xs">
          <span>📦</span>
          <span>Buffering {queuedChunks} chunk{queuedChunks !== 1 ? 's' : ''}...</span>
        </div>
      )}
      
      {/* Error Message */}
      {isError && error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 max-w-sm">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-red-400 font-semibold text-sm mb-1">Error</p>
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Visualizer Placeholder */}
      <div className="h-16 flex items-center gap-1">
         {isRecording && [1,2,3,4,5].map(i => (
             <div key={i} className="w-1 bg-blue-500 h-8 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
         ))}
      </div>

      {/* Processing Spinner */}
      {isProcessing && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-purple-400 text-sm font-medium">⏳ Processing with AI...</p>
          <p className="text-purple-300/70 text-xs">Transcribing and generating summary</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4">
        {(status === 'idle' || isError || isSuccess) && (
          <button 
            onClick={startRecording}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {isError ? 'Try Again' : isSuccess ? 'New Recording' : 'Start Recording'}
          </button>
        )}

        {(isRecording || isPaused || isReconnecting) && (
          <>
            {isPaused ? (
              <button 
                onClick={resumeRecording}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-all"
              >
                Resume
              </button>
            ) : (
              <button 
                onClick={pauseRecording}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isReconnecting}
              >
                Pause
              </button>
            )}

            <button 
              onClick={stopRecording}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-all"
            >
              Stop
            </button>
          </>
        )}
      </div>
      
      {isReconnecting && (
         <div className="text-center">
           <p className="text-yellow-400 text-sm font-medium">⚠️ Connection lost</p>
           <p className="text-yellow-300/70 text-xs mt-1">Reconnecting... Audio is being buffered</p>
         </div>
      )}

      {/* AI Summary Display */}
      {summary && isSuccess && (
        <div className="w-full mt-4 p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-xl shadow-inner">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
            <span className="text-2xl">✨</span>
            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              AI Summary
            </h3>
          </div>
          
          {/* ✅ FIX: Manually styled components to guarantee correct look */}
          <div className="text-sm">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-6 mb-3 border-b border-gray-700 pb-1" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold text-purple-300 mt-5 mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-md font-bold text-blue-300 mt-4 mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-outside space-y-1 text-gray-300 ml-5 mb-4" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-outside space-y-1 text-gray-300 ml-5 mb-4" {...props} />,
                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                p: ({node, ...props}) => <p className="text-gray-300 mb-3 leading-relaxed" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-400 my-4" {...props} />,
              }}
            >
                {summary}
            </ReactMarkdown>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(summary);
              alert('Summary copied to clipboard!');
            }}
            className="mt-6 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-all w-full font-medium shadow-lg shadow-purple-900/40"
          >
            📋 Copy Summary
          </button>
        </div>
      )}
    </div>
  );
}