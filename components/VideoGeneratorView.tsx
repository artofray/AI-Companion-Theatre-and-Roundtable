import React, { useState, useEffect, useRef } from 'react';
import { generateVideo, checkVideoOperation } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { VEO_LOADING_MESSAGES } from '../constants';
import { Clapperboard, Download, AlertTriangle } from 'lucide-react';

type AspectRatio = '16:9' | '9:16';

const VideoGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [apiKeySelected, setApiKeySelected] = useState(false);

  const loadingMessageInterval = useRef<number | null>(null);

  const checkApiKey = async () => {
    if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
      setApiKeySelected(true);
      return true;
    }
    setApiKeySelected(false);
    return false;
  };

  useEffect(() => {
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success and let the API call fail if it's not ready
      setApiKeySelected(true);
    }
  };

  useEffect(() => {
    if (isLoading) {
      setLoadingMessage(VEO_LOADING_MESSAGES[0]);
      loadingMessageInterval.current = window.setInterval(() => {
        setLoadingMessage(prev => {
          const currentIndex = VEO_LOADING_MESSAGES.indexOf(prev);
          const nextIndex = (currentIndex + 1) % VEO_LOADING_MESSAGES.length;
          return VEO_LOADING_MESSAGES[nextIndex];
        });
      }, 4000);
    } else if (loadingMessageInterval.current) {
      clearInterval(loadingMessageInterval.current);
      loadingMessageInterval.current = null;
    }

    return () => {
      if (loadingMessageInterval.current) {
        clearInterval(loadingMessageInterval.current);
      }
    };
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    if (!await checkApiKey()) {
       setError("Please select an API key to generate videos.");
       return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      let operation = await generateVideo(prompt, aspectRatio);
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await checkVideoOperation(operation);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await response.blob();
        const localUrl = URL.createObjectURL(videoBlob);
        setVideoUrl(localUrl);
      } else {
        throw new Error("Video generation completed, but no video URI was found.");
      }

    } catch (err: any) {
      console.error("Error generating video:", err);
      let errorMessage = "An unknown error occurred during video generation.";
      if (err.message && err.message.includes("Requested entity was not found")) {
        errorMessage = "API Key not found or invalid. Please select a valid key and try again.";
        setApiKeySelected(false);
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!apiKeySelected) {
      return (
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Video Generation with Veo</h1>
          <p className="mb-6 text-gray-300">Veo requires a user-selected API key to proceed. Please select an API key for a project with billing enabled.</p>
          <button onClick={handleSelectKey} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
              Select API Key
          </button>
           <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="mt-4 block text-indigo-400 hover:underline">
              Learn more about billing
          </a>
          {error && <p className="mt-4 text-red-400">{error}</p>}
        </div>
      );
    }
  
    return (
      <>
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400 tracking-wider">Veo Video Generator</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Video Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., A majestic whale swimming through the clouds at sunset"
              className="w-full h-24 p-2 bg-gray-900/50 rounded-lg border border-white/10 focus:ring-2 focus:ring-indigo-500 resize-none"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
            <div className="flex gap-4">
              {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  disabled={isLoading}
                  className={`flex-1 p-2 rounded-lg font-semibold transition-colors ${aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {ratio} ({ratio === '16:9' ? 'Landscape' : 'Portrait'})
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating...' : <><Clapperboard size={20} /> Generate Video</>}
          </button>
        </form>
  
        <div className="mt-6">
          {isLoading && (
            <div className="text-center p-4 bg-gray-900/50 rounded-lg">
              <LoadingSpinner />
              <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
              <p className="text-sm text-gray-400">Video generation can take a few minutes. Please be patient.</p>
            </div>
          )}
          {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded relative flex items-center gap-3" role="alert">
                  <AlertTriangle className="w-6 h-6" />
                  <span>{error}</span>
              </div>
          )}
          {videoUrl && (
            <div className="space-y-4">
              <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg shadow-lg" />
              <a
                href={videoUrl}
                download={`${prompt.substring(0, 20).replace(/\s+/g, '_')}.mp4`}
                className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition-colors"
              >
                <Download size={20} /> Download Video
              </a>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl">
      {renderContent()}
    </div>
  );
};

export default VideoGeneratorView;