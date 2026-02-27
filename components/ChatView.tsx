import React, { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Character, ChatMessage } from '../types';
import { generateSpeech } from '../services/geminiService';
import Message from './Message';
import LoadingSpinner from './LoadingSpinner';
import { Chat } from '@google/genai';
import { createChat } from '../services/geminiService';
import { Send, Volume2, X, Users, Edit2 } from 'lucide-react';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface ChatViewProps {
  characters: Character[];
  selectedCharacter: Character;
  setSelectedCharacter: (character: Character) => void;
  onEditCharacter: (character: Character) => void;
  chatLog: ChatMessage[];
  setChatLog: (log: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  sharedKnowledge: string;
}

const ChatView: React.FC<ChatViewProps> = ({ characters, selectedCharacter, setSelectedCharacter, onEditCharacter, chatLog, setChatLog, sharedKnowledge }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [showCharacterList, setShowCharacterList] = useState(false);

  useEffect(() => {
    chatRef.current = createChat(selectedCharacter.persona, sharedKnowledge);
  }, [selectedCharacter, sharedKnowledge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

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
    } catch (error) {
        console.error("Error playing audio:", error);
    }
  };

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: Date.now(),
    };
    setChatLog(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) return;
      const response = await chatRef.current.sendMessage({ message: input });
      const aiText = response.text;

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: selectedCharacter.id,
        character: selectedCharacter,
        timestamp: Date.now(),
      };
      setChatLog(prev => [...prev, aiMessage]);

      const audioData = await generateSpeech(aiText, selectedCharacter.voice);
      if (audioData) {
        await playAudio(audioData);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting. Please try again.",
        sender: selectedCharacter.id,
        character: selectedCharacter,
        timestamp: Date.now(),
      };
      setChatLog(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full max-w-7xl mx-auto">
      {/* Character List Sidebar */}
      <div className={`absolute sm:static top-0 left-0 h-full z-20 bg-black/20 backdrop-blur-lg border-r border-white/10 transition-transform duration-300 ease-in-out ${showCharacterList ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0 w-80 sm:w-1/4 p-4 flex flex-col rounded-l-2xl`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold tracking-wider">Characters</h2>
          <button onClick={() => setShowCharacterList(false)} className="sm:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <ul className="space-y-2 overflow-y-auto pr-2">
          {characters.map(char => (
            <li key={char.id} className="group relative">
              <button
                onClick={() => setSelectedCharacter(char)}
                className={`w-full text-left p-3 rounded-xl flex items-center gap-4 transition-all duration-200 ${selectedCharacter.id === char.id ? 'bg-indigo-500/80 shadow-lg' : 'hover:bg-white/10'}`}
              >
                <img src={char.avatarUrl} alt={char.name} className={`w-12 h-12 rounded-full object-cover transition-all duration-200 ${selectedCharacter.id === char.id ? 'ring-2 ring-teal-400' : ''}`} />
                <span className="truncate font-medium">{char.name}</span>
              </button>
              <button
                onClick={() => onEditCharacter(char)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-500"
                aria-label={`Edit ${char.name}`}
              >
                <Edit2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-black/20 backdrop-blur-lg rounded-r-2xl border border-white/10 shadow-2xl h-full">
         <div className="flex items-center p-4 border-b border-white/10">
            <button onClick={() => setShowCharacterList(true)} className="sm:hidden mr-4 text-gray-400 hover:text-white">
                <Users size={24} />
            </button>
            <img src={selectedCharacter.avatarUrl} alt={selectedCharacter.name} className="w-14 h-14 rounded-full object-cover mr-4 ring-2 ring-indigo-500/50" />
            <div>
              <h2 className="text-xl font-bold">{selectedCharacter.name}</h2>
              <p className="text-sm text-gray-400 truncate">{selectedCharacter.persona.split('.')[0]}</p>
            </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {chatLog.map(msg => (
            <Message key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start items-center p-4">
              <LoadingSpinner />
              <span className="ml-2 text-gray-400">Maggie is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center bg-gray-900/50 rounded-xl p-1 border border-white/10">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder={`Message ${selectedCharacter.name}...`}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-400 px-3 py-2"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || input.trim() === ''}
              className="ml-2 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;