import React, { useState, useRef, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { Character, ChatMessage } from '../types';
import { generateComplexText, generateSpeech } from '../services/geminiService';
import Message from './Message';
import LoadingSpinner from './LoadingSpinner';
import { Send, Sparkles, Users, FileUp, Play, Pause, X } from 'lucide-react';
import { decode, decodeAudioData } from '../utils/audioUtils';

// Add declaration for the pdf.js library loaded from CDN
declare const pdfjsLib: any;

interface RoundtableViewProps {
  characters: Character[];
  log: ChatMessage[];
  setLog: (log: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  topic: string;
  setTopic: (t: string) => void;
  selectedActorIds: string[];
  setSelectedActorIds: (ids: string[]) => void;
  sharedKnowledge: string;
  setSharedKnowledge: (k: string) => void;
}

const RoundtableView: React.FC<RoundtableViewProps> = ({ 
  characters, 
  log, 
  setLog, 
  topic, 
  setTopic,
  selectedActorIds,
  setSelectedActorIds,
  sharedKnowledge,
  setSharedKnowledge
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAiRunningRef = useRef(isAiRunning);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { isAiRunningRef.current = isAiRunning }, [isAiRunning]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log]);

  const selectedActors = useMemo(() => 
    characters.filter(c => selectedActorIds.includes(c.id)),
    [characters, selectedActorIds]
  );
  
  const toggleActor = (actorId: string) => {
    const newSelection = selectedActorIds.includes(actorId)
      ? selectedActorIds.filter(id => id !== actorId)
      : [...selectedActorIds, actorId];
    setSelectedActorIds(newSelection);
  };
  
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setSharedKnowledge(text);
          setIsUploading(false);
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf') {
        if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
          alert('PDF processing library is still loading. Please try uploading again in a moment.');
          setIsUploading(false);
          return;
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n\n';
            }
            setSharedKnowledge(fullText);
          } catch (pdfError) {
            console.error("Error parsing PDF content:", pdfError);
            alert("Failed to read the PDF. It might be corrupted or protected.");
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert("Unsupported file type. Please upload a .txt, .md, or .pdf file.");
        setIsUploading(false);
      }
    } catch (error) {
        console.error("File upload error:", error);
        alert("An unexpected error occurred during file upload.");
        setIsUploading(false);
    }
    
    if(event.target) event.target.value = '';
  };

  const playAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    const audioContext = audioContextRef.current;
    try {
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
        return new Promise(resolve => source.onended = resolve);
    } catch (error) {
        console.error("Error playing audio:", error);
    }
  };

  const performNextAiTurn = useCallback(async () => {
    if (!isAiRunningRef.current || isLoading || selectedActors.length < 1) {
      setIsAiRunning(false);
      return;
    };

    setIsLoading(true);

    try {
      const historyText = log.map(m => `${m.sender === 'user' ? 'Human' : m.character?.name}: ${m.text}`).join('\n');
      const characterList = selectedActors.map(c => `${c.name} (${c.persona.split('.')[0]})`).join(', ');
      
      const prompt = `
        You are an AI moderator for a roundtable discussion.
        The topic is "${topic || 'open discussion'}".
        The participants are: ${characterList}.

        This is the conversation history:
        ${historyText}

        Based on the history and the topic, decide which AI character should speak next to provide the most interesting, relevant, and in-character response.
        The character you choose should continue the conversation naturally.
        Generate ONLY that character's response. Do not add any extra text, moderation, or commentary.

        Format your entire output as:
        CHARACTER_NAME: The character's response.
      `;
      
      const responseText = await generateComplexText(prompt, sharedKnowledge);
      const [characterName, ...textParts] = responseText.split(':');
      const text = textParts.join(':').trim();
      const respondingCharacter = characters.find(c => c.name.toLowerCase() === characterName.trim().toLowerCase());

      if (respondingCharacter && text) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: text,
          sender: respondingCharacter.id,
          character: respondingCharacter,
          timestamp: Date.now(),
        };
        setLog(prev => [...prev, aiMessage]);
        
        const audioData = await generateSpeech(text, respondingCharacter.voice);
        if (audioData) {
          await playAudio(audioData);
        }

      } else {
         console.warn("Could not parse AI response or find character:", responseText);
      }
    } catch (error) {
      console.error("Error during roundtable turn:", error);
    } finally {
      setIsLoading(false);
      if (isAiRunningRef.current) {
        setTimeout(performNextAiTurn, Math.random() * 2000 + 1000); // Wait 1-3 seconds before next turn
      }
    }
  }, [characters, log, selectedActors, setLog, sharedKnowledge, topic, isLoading]);

  useEffect(() => {
    if (isAiRunning && !isLoading) {
      performNextAiTurn();
    }
  }, [isAiRunning, isLoading, performNextAiTurn]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: Date.now(),
    };
    
    setLog(prev => [...prev, userMessage]);
    setInput('');
    
    if (isAiRunning) {
      // AI will automatically pick up the next turn
    } else {
      // Trigger one AI turn
      setIsAiRunning(true);
      // Wait a bit and stop
      setTimeout(() => setIsAiRunning(false), 100);
    }
  };

  return (
    <div className="flex h-full bg-slate-900">
      {/* Sidebar for settings */}
      <div className="w-80 border-r border-slate-800 bg-slate-950 p-4 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Roundtable Setup
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Discussion Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., The ethics of AI..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Participants</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {characters.map(char => (
                  <label key={char.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedActorIds.includes(char.id)}
                      onChange={() => toggleActor(char.id)}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-950 bg-slate-900"
                    />
                    <div className="flex items-center gap-2">
                      {char.avatarUrl ? (
                        <img src={char.avatarUrl} alt={char.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-medium">
                          {char.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm text-slate-300">{char.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Shared Knowledge Base</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-800 disabled:opacity-50"
                >
                  {isUploading ? <LoadingSpinner size="sm" /> : <FileUp className="w-4 h-4" />}
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </button>
                {sharedKnowledge && (
                  <button
                    onClick={() => setSharedKnowledge('')}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
                    title="Clear knowledge base"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {sharedKnowledge && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Knowledge base active
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-800">
          <button
            onClick={() => setIsAiRunning(!isAiRunning)}
            disabled={selectedActors.length === 0 || isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
              isAiRunning
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isAiRunning ? (
              <>
                <Pause className="w-5 h-5" /> Stop Discussion
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> Start Discussion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {log.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center">
                <Users className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-center max-w-sm">
                Set a topic, select participants, and start the discussion to watch the AI characters interact.
              </p>
            </div>
          ) : (
            log.map((msg) => (
              <Message key={msg.id} message={msg} />
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-900 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-800 flex items-center gap-3">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-slate-400">AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-950 border-t border-slate-900">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Join the discussion..."
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-4 pr-12 py-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-sm"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundtableView;
