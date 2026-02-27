import React, { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { Character, ChatMessage } from '../types';
import { generateComplexText, generateSpeech, generateImage } from '../services/geminiService';
import Message from './Message';
import LoadingSpinner from './LoadingSpinner';
import { Play, Square, Users, Wand2, Image as ImageIcon } from 'lucide-react';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface TheatreViewProps {
  characters: Character[];
  log: ChatMessage[];
  setLog: (log: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  scenario: string;
  setScenario: (s: string) => void;
  backgroundUrl: string | null;
  setBackgroundUrl: (url: string | null) => void;
  backgroundPrompt: string;
  setBackgroundPrompt: (p: string) => void;
  sharedKnowledge: string;
}

const TheatreView: React.FC<TheatreViewProps> = ({ 
  characters, 
  log, 
  setLog, 
  scenario, 
  setScenario,
  backgroundUrl,
  setBackgroundUrl,
  backgroundPrompt,
  setBackgroundPrompt,
  sharedKnowledge
}) => {
  const [selectedActors, setSelectedActors] = useState<Character[]>([]);
  const [isPerforming, setIsPerforming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  const isPerformingRef = useRef(isPerforming);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    isPerformingRef.current = isPerforming;
  }, [isPerforming]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const toggleActor = (actor: Character) => {
    if (isPerforming) return;
    setSelectedActors(prev =>
      prev.find(a => a.id === actor.id)
        ? prev.filter(a => a.id !== actor.id)
        : [...prev, actor].slice(0, 8) // Max 8 actors
    );
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

  const handleGenerateBackground = async () => {
    if (!backgroundPrompt.trim()) return;
    setIsGeneratingBg(true);
    try {
      const imageUrl = await generateImage(`Cinematic, photorealistic scene for a play. ${backgroundPrompt}`, '16:9');
      setBackgroundUrl(imageUrl);
    } catch (error) {
      console.error("Error generating background:", error);
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const startPerformance = () => {
    if (selectedActors.length < 2 || !scenario.trim()) {
      alert("Please select at least 2 actors and provide a scenario.");
      return;
    }
    setLog([]);
    setIsPerforming(true);
    isPerformingRef.current = true;
    performNextTurn(0, []);
  };

  const stopPerformance = () => {
    setIsPerforming(false);
    isPerformingRef.current = false;
    setIsLoading(false);
  };

  const performNextTurn = async (turnIndex: number, history: ChatMessage[]) => {
    if (!isPerformingRef.current) return;

    setIsLoading(true);
    const currentActor = selectedActors[turnIndex % selectedActors.length];
    
    const historyText = history.map(m => `${m.character?.name}: ${m.text}`).join('\n');
    const actorList = selectedActors.map(a => a.name).join(', ');

    const prompt = `
      You are in a play with these characters: ${actorList}.
      The scene is: "${backgroundPrompt || 'an empty stage'}".
      The scenario is: "${scenario}".
      The story so far:
      ${historyText}

      You are ${currentActor.name}. Your persona is: "${currentActor.persona}".
      Continue the scene with ONE response from your character's perspective. Do not write for other characters. Your response should be creative and move the story forward.
    `;

    try {
      const responseText = await generateComplexText(prompt, sharedKnowledge);
      const newMessages: ChatMessage[] = responseText.split('\n').filter(Boolean).map((text, i) => ({
        id: `${Date.now()}-${turnIndex}-${i}`,
        text,
        sender: currentActor.id,
        character: currentActor,
        timestamp: Date.now()
      }));

      for (const msg of newMessages) {
        if (!isPerformingRef.current) break;
        setLog(prev => [...prev, msg]);
        const audioData = await generateSpeech(msg.text, currentActor.voice);
        if (audioData) {
          await playAudio(audioData);
        }
      }

      if (isPerformingRef.current) {
        setTimeout(() => performNextTurn(turnIndex + 1, [...history, ...newMessages]), 1000);
      }
    } catch (error) {
      console.error("Error in performance:", error);
      stopPerformance();
    } finally {
      if (isPerformingRef.current) {
         setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full max-w-7xl mx-auto gap-6 p-4 md:p-6">
      {/* Control Panel */}
      <div className="md:w-1/3 flex flex-col gap-4 p-6 bg-slate-800/50 border border-slate-700 rounded-2xl shadow-2xl">
        <div>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Users size={24} /> Select Actors (up to 8)</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {characters.map(char => (
              <button key={char.id} onClick={() => toggleActor(char)} className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 ${selectedActors.find(a => a.id === char.id) ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-700 hover:bg-slate-600'} ${isPerforming ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <img src={char.avatarUrl} alt={char.name} className="w-12 h-12 rounded-full object-cover" />
                <span className="text-xs mt-1 text-center truncate">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Wand2 size={24} /> Set the Scenario</h2>
          <textarea
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            placeholder="e.g., A tense negotiation on a space station."
            className="w-full h-24 p-2 bg-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 border-slate-700 resize-none"
            disabled={isPerforming}
          />
        </div>
         <div>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ImageIcon size={24} /> Set the Stage</h2>
           <div className="flex gap-2">
            <input
              value={backgroundPrompt}
              onChange={e => setBackgroundPrompt(e.target.value)}
              placeholder="e.g., a futuristic cityscape at night"
              className="flex-1 p-2 bg-slate-900 rounded-lg border-slate-700 focus:ring-2 focus:ring-indigo-500"
              disabled={isPerforming || isGeneratingBg}
            />
            <button onClick={handleGenerateBackground} disabled={isPerforming || isGeneratingBg || !backgroundPrompt.trim()} className="p-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-bold disabled:bg-slate-600 transition-colors">
              {isGeneratingBg ? <LoadingSpinner/> : 'Set'}
            </button>
          </div>
        </div>
        <div className="mt-auto pt-4">
          {!isPerforming ? (
            <button
              onClick={startPerformance}
              disabled={selectedActors.length < 2 || !scenario.trim()}
              className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              <Play size={20} /> Start Performance
            </button>
          ) : (
            <button
              onClick={stopPerformance}
              className="w-full flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition-colors shadow-lg"
            >
              <Square size={20} /> Stop Performance
            </button>
          )}
        </div>
      </div>

      {/* Stage Area */}
      <div className="flex-1 flex flex-col bg-slate-900/50 rounded-2xl shadow-2xl h-full overflow-hidden border border-slate-700" 
            style={{
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}>
        <div className="bg-slate-800/30 backdrop-blur-sm">
         <h2 className="text-2xl font-bold p-4 border-b border-slate-700 text-center tracking-wider">Live Theatre</h2>
        </div>
        <div className="flex-1 p-4 overflow-y-auto bg-black/30">
          {log.length === 0 && !isPerforming && (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p>The stage is empty. Set up a scene to begin.</p>
            </div>
          )}
          {log.map(msg => <Message key={msg.id} message={msg} />)}
          {isLoading && (
            <div className="flex justify-start items-center p-4">
               <LoadingSpinner />
               <span className="ml-2 text-slate-300">A character is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default TheatreView;