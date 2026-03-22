import React, { useState, ChangeEvent, useRef } from 'react';
import { Character } from '../types';
import { generateComplexText, generateImage, editImageWithText, generateSpeech } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { GEMINI_TTS_VOICES } from '../constants';
import { Bot, Image as ImageIcon, Wand2, Save, X, Upload, Play } from 'lucide-react';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface AvatarGeneratorViewProps {
  onCharacterSaved: (character: Character) => void;
  characterToEdit: Character | null;
  onCancel: () => void;
}

const AvatarGeneratorView: React.FC<AvatarGeneratorViewProps> = ({ onCharacterSaved, characterToEdit, onCancel }) => {
  const isEditMode = !!characterToEdit;
  
  const [name, setName] = useState(characterToEdit?.name || '');
  const [idea, setIdea] = useState('');
  const [persona, setPersona] = useState(characterToEdit?.persona || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(characterToEdit?.avatarUrl || null);
  const [inspirationImage, setInspirationImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [voice, setVoice] = useState(characterToEdit?.voice || GEMINI_TTS_VOICES[0]);
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  const handlePreviewVoice = async () => {
    setIsPlayingVoice(true);
    try {
      const phrase = `Hello, I am ${name || 'your AI companion'}.`;
      const audioData = await generateSpeech(phrase, voice);
      if (audioData) {
        await playAudio(audioData);
      }
    } catch (error) {
      console.error("Error previewing voice:", error);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const mimeType = file.type;
        const base64 = base64String.split(',')[1];
        setInspirationImage({ base64, mimeType });
         // Show preview of uploaded image
        setAvatarUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratePersona = async () => {
    if (!idea) return;
    setIsLoadingPersona(true);
    setPersona('');
    const prompt = `Create a detailed, engaging, and unique character persona for an AI. The user's idea is: "${idea}".
      The persona should be written in the second person, as if you are giving instructions to the AI (e.g., "You are...").
      Include personality traits, a backstory, speaking style, and motivations. Keep it concise, around 3-4 sentences.
    `;
    try {
      const result = await generateComplexText(prompt);
      setPersona(result);
    } catch (error) {
      console.error("Error generating persona:", error);
      setPersona("Failed to generate persona. Please try again.");
    } finally {
      setIsLoadingPersona(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!persona) return;
    setIsLoadingAvatar(true);
    setAvatarUrl(null);

    try {
      let result: string | null = null;
      if (inspirationImage) {
        const prompt = `Transform this image to match the following persona: "${persona}"`;
        result = await editImageWithText(inspirationImage.base64, inspirationImage.mimeType, prompt);
      } else {
        const prompt = `Create a visually stunning avatar based on this persona. Digital art, portrait, vibrant, detailed, cinematic lighting. Persona: "${persona}"`;
        result = await generateImage(prompt);
      }
      setAvatarUrl(result);
    } catch (error) {
      console.error("Error generating avatar:", error);
    } finally {
      setIsLoadingAvatar(false);
    }
  };

  const handleSave = () => {
    if (!name || !persona || !avatarUrl || !voice) {
      alert("Please complete all fields before saving.");
      return;
    }
    const newCharacter: Character = {
      id: characterToEdit?.id || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      persona,
      avatarUrl,
      voice,
    };
    onCharacterSaved(newCharacter);
  };

  const isSaveDisabled = !name || !persona || !avatarUrl || !voice || isLoadingAvatar || isLoadingPersona;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400 tracking-wider">
        {isEditMode ? 'Edit Character' : 'AI Avatar Studio'}
      </h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Character Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Captain Eva" className="w-full p-2 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-indigo-500"/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Persona Idea</label>
            <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="e.g., A sarcastic spaceship pilot who loves cats." className="w-full h-24 p-2 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-indigo-500 resize-none"/>
            <button onClick={handleGeneratePersona} disabled={isLoadingPersona || !idea} className="w-full mt-2 flex items-center justify-center gap-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold disabled:bg-gray-600 transition-colors">
              {isLoadingPersona ? <LoadingSpinner /> : <><Wand2 size={18} /> Generate Persona</>}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Persona (Editable)</label>
            <textarea value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Persona will appear here..." className="w-full h-32 p-2 bg-gray-900/50 rounded-lg border border-white/10 resize-none focus:ring-2 focus:ring-indigo-500"/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Voice</label>
            <div className="flex gap-2">
              <select value={voice} onChange={e => setVoice(e.target.value)} className="flex-1 p-2 bg-gray-900/50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500">
                {GEMINI_TTS_VOICES.map(v => <option key={v} value={v} className="bg-gray-800 text-white">{v}</option>)}
              </select>
              <button 
                onClick={handlePreviewVoice} 
                disabled={isPlayingVoice}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold disabled:bg-gray-600 transition-colors flex items-center justify-center"
                title="Preview Voice"
              >
                {isPlayingVoice ? <LoadingSpinner size="sm" /> : <Play size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
           <div className="w-full aspect-square bg-black/20 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-gray-600 relative overflow-hidden">
            {isLoadingAvatar ? <LoadingSpinner /> : avatarUrl ? <img src={avatarUrl} alt="Generated Avatar" className="w-full h-full object-cover rounded-lg"/> : <ImageIcon size={64} className="text-gray-500"/>}
          </div>
          <div className="w-full space-y-2">
            <div>
              <label htmlFor="image-upload" className="w-full cursor-pointer flex items-center justify-center gap-2 p-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors">
                <Upload size={18} /> Upload Inspiration
              </label>
              <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
             <button onClick={handleGenerateAvatar} disabled={isLoadingAvatar || !persona} className="w-full flex items-center justify-center gap-2 p-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-bold disabled:bg-gray-600 transition-colors">
              {isLoadingAvatar ? <LoadingSpinner /> : <><Bot size={18} /> {inspirationImage ? 'Generate from Image' : 'Generate from Persona'}</>}
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex gap-4">
        <button onClick={onCancel} className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors">
          <X size={20} /> Cancel
        </button>
        <button onClick={handleSave} disabled={isSaveDisabled} className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
          <Save size={20} /> {isEditMode ? 'Save Changes' : 'Save & Start Chat'}
        </button>
      </div>
    </div>
  );
};

export default AvatarGeneratorView;