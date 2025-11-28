'use client';

import { useState } from 'react';
import { useSession, signIn, signUp, signOut } from './lib/auth-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  User, 
  Mail, 
  Lock, 
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import AudioRecorder from './components/client/AudioRecorder';

export default function Home() {
  const { data: session, isPending } = useSession();
  
  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Validation State
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; name?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isSignUp && !name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async () => {
    setErrors({}); 
    
    if (!validateForm()) return; 

    setIsLoadingAuth(true);
    try {
      if (isSignUp) {
        await signUp.email({ email, password, name });
      } else {
        await signIn.email({ email, password });
      }
    } catch (error) {
      console.error('Auth error:', error);
     
    } finally {
      setIsLoadingAuth(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-purple-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#030712] text-slate-200 font-sans selection:bg-purple-500/30">
      
      {/* Animated Background Gradient Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-[96px] opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-[96px] opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-[96px] opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-purple-400 tracking-tight">
            AI Audio <span className="italic font-serif text-purple-400">Transcription</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Real-time audio recording with AI-powered transcription and summarization.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
          
          {/* Left Column: Authentication */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-8 flex flex-col relative overflow-hidden group bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                <Lock className="w-32 h-32" />
             </div>

            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-purple-400" />
              Authentication
            </h2>
            
            {session ? (
              <div className="flex flex-col h-full justify-center space-y-6 z-10">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-inner"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                      {session.user?.name?.charAt(0) || session.user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-lg">{session.user?.name || 'User'}</p>
                      <p className="text-sm text-slate-400">{session.user?.email}</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-500 break-all bg-black/30 p-2 rounded border border-white/5">
                    ID: {session.user?.id}
                  </div>
                </motion.div>
                
                <button
                  onClick={() => signOut()}
                  className="w-full py-3 px-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
                <AudioRecorder />
              </div>
            ) : (
              <div className="space-y-5 z-10">
                <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setErrors({});
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${!isSignUp ? 'bg-gray-700 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setIsSignUp(true);
                      setErrors({});
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isSignUp ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Sign Up
                  </button>
                </div>

                <AnimatePresence mode='wait'>
                  <motion.div
                    key={isSignUp ? 'signup' : 'signin'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {isSignUp && (
                      <div className="space-y-1">
                        <div className="relative group">
                          <User className={`absolute left-3 top-3 w-5 h-5 transition-colors duration-300 ${errors.name ? 'text-red-400' : 'text-slate-500 group-focus-within:text-purple-400'}`} />
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if(errors.name) setErrors({...errors, name: undefined});
                            }}
                            className={`w-full bg-black/40 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all duration-300
                              ${errors.name 
                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                                : 'border-white/10 focus:border-purple-500 focus:ring-purple-500'
                              }`}
                          />
                          {!errors.name && name.length > 0 && <CheckCircle2 className="absolute right-3 top-3 w-5 h-5 text-green-500/50" />}
                        </div>
                        {errors.name && (
                          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-red-400 text-xs pl-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.name}
                          </motion.p>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <div className="relative group">
                        <Mail className={`absolute left-3 top-3 w-5 h-5 transition-colors duration-300 ${errors.email ? 'text-red-400' : 'text-slate-500 group-focus-within:text-purple-400'}`} />
                        <input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if(errors.email) setErrors({...errors, email: undefined});
                          }}
                          className={`w-full bg-black/40 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all duration-300
                            ${errors.email 
                              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                              : 'border-white/10 focus:border-purple-500 focus:ring-purple-500'
                            }`}
                        />
                        {errors.email && <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-500/50" />}
                      </div>
                      {errors.email && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-red-400 text-xs pl-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.email}
                        </motion.p>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="relative group">
                        <Lock className={`absolute left-3 top-3 w-5 h-5 transition-colors duration-300 ${errors.password ? 'text-red-400' : 'text-slate-500 group-focus-within:text-purple-400'}`} />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if(errors.password) setErrors({...errors, password: undefined});
                          }}
                          className={`w-full bg-black/40 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all duration-300
                            ${errors.password 
                              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                              : 'border-white/10 focus:border-purple-500 focus:ring-purple-500'
                            }`}
                        />
                        {errors.password && <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-500/50" />}
                      </div>
                      {errors.password && (
                         <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-red-400 text-xs pl-1 flex items-center gap-1">
                           <AlertCircle className="w-3 h-3" /> {errors.password}
                         </motion.p>
                      )}
                    </div>

                    <button
                      onClick={handleAuth}
                      disabled={isLoadingAuth}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoadingAuth ? <Loader2 className="w-5 h-5 animate-spin"/> : (isSignUp ? 'Create Account' : 'Welcome Back')}
                    </button>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}