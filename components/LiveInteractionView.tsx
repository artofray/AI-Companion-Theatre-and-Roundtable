import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connectLive } from '../services/geminiService';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { LiveServerMessage, LiveSession } from '@google/genai';

const LiveInteractionView: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Checking permissions...');
  const [error, setError] = useState<string | null>(null);
  const [lastUserTranscription, setLastUserTranscription] = useState('');
  const [lastModelTranscription, setLastModelTranscription] = useState('');
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionState | null>(null);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  let nextStartTime = 0;

  const handleStop = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close()).catch(e => console.error("Error closing session:", e));
      sessionPromiseRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing input audio context:", e));
      audioContextRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    const checkMicPermission = async () => {
        if (!navigator.permissions) {
            console.warn("Permissions API is not supported. Falling back to direct prompt.");
            setStatus('Ready. Press Start to request mic permission.');
            setMicPermissionStatus('prompt');
            return;
        }
        try {
            const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            setMicPermissionStatus(permission.state);
            updateStatusFromPermission(permission.state);
            permission.onchange = () => {
                setMicPermissionStatus(permission.state);
                updateStatusFromPermission(permission.state);
                if(permission.state === 'denied') {
                  handleStop();
                }
            };
        } catch (err) {
            console.error("Error querying microphone permission:", err);
            setStatus('Could not check permissions.');
            setError('There was an issue checking microphone permissions.');
        }
    };
    checkMicPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleStop]);


  const updateStatusFromPermission = (state: PermissionState) => {
    if (isListening) return;
    switch (state) {
        case 'granted':
            setStatus('Idle. Press Start to talk.');
            setError(null);
            break;
        case 'prompt':
            setStatus('Ready. Press Start to request mic permission.');
            setError(null);
            break;
        case 'denied':
            setStatus('Permission Denied');
            setError("Microphone access was denied. Please enable it in your browser's site settings to continue.");
            break;
    }
};

  const handleStart = async () => {
    setError(null);
    
    if (micPermissionStatus === 'denied') {
        setError("Microphone access was denied. Please enable it in your browser's site settings to continue.");
        setStatus('Permission Denied');
        return;
    }

    setStatus('Connecting...');
    setIsListening(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputAudioContext;
      
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      sessionPromiseRef.current = connectLive({
          onopen: () => {
              setStatus('Connected! You can start talking now.');
          },
          onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.inputTranscription) {
                setLastUserTranscription(prev => prev + message.serverContent.inputTranscription.text);
              }
              if (message.serverContent?.outputTranscription) {
                setLastModelTranscription(prev => prev + message.serverContent.outputTranscription.text);
              }
              if (message.serverContent?.turnComplete) {
                setLastUserTranscription('');
                setLastModelTranscription('');
              }
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && outputAudioContextRef.current) {
                  nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current.currentTime);
                  const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                  const source = outputAudioContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputAudioContextRef.current.destination);
                  source.start(nextStartTime);
                  nextStartTime += audioBuffer.duration;
              }
          },
          onerror: (e: ErrorEvent) => {
              console.error('Live session error:', e);
              setError(`Connection error: ${e.message}. Please try again.`);
              handleStop();
              setStatus('Error');
          },
          onclose: (e: CloseEvent) => {
              handleStop();
              updateStatusFromPermission(micPermissionStatus ?? 'prompt');
          },
      });

      const source = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionPromiseRef.current?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
          });
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);

      await sessionPromiseRef.current;
    } catch (err: any) {
      console.error('Error starting live interaction:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission was not granted. Please allow access to use this feature.');
          setMicPermissionStatus('denied');
          setStatus('Permission Denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
           setError("No microphone found. Please connect a microphone and try again.");
           setStatus('Error');
      } else {
          setError('Could not access microphone. Please check your device and try again.');
          setStatus('Error');
      }
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      handleStop();
    };
  }, [handleStop]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto">
       <div className="w-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-8">

        <h1 className="text-4xl font-bold mb-4 text-indigo-400 tracking-wider">Live Conversation</h1>
        <p className="mb-8 text-lg text-gray-300">
          Speak directly with the AI and get instant voice responses.
        </p>
        
        <div className="relative w-48 h-48 flex items-center justify-center mb-8 mx-auto">
          <div className={`absolute inset-0 rounded-full bg-indigo-500 transition-transform duration-500 ${isListening ? 'scale-100 animate-pulse' : 'scale-75'}`}></div>
          <button
            onClick={isListening ? handleStop : handleStart}
            disabled={micPermissionStatus === 'denied' && !isListening}
            className="relative z-10 w-32 h-32 bg-gray-900/50 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-gray-900/80 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isListening ? <MicOff size={48} /> : <Mic size={48} />}
          </button>
        </div>

        <div className="w-full bg-gray-900/50 p-6 rounded-lg shadow-inner border border-white/10">
          <p className="text-xl font-medium text-gray-300 mb-4">{status}</p>
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded relative flex items-center gap-3" role="alert">
              <AlertTriangle className="w-6 h-6" />
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="mt-4 text-left space-y-2 h-24 overflow-y-auto">
              <p className="text-gray-300"><span className="font-bold text-indigo-400">You:</span> {lastUserTranscription || '...'}</p>
              <p className="text-gray-300"><span className="font-bold text-teal-400">AI:</span> {lastModelTranscription || '...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInteractionView;