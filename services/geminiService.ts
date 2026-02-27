import { GoogleGenAI, GenerateContentResponse, Chat, Modality, Type, LiveSession, LiveServerMessage } from "@google/genai";

// FIX: Removed conflicting global declaration for window.aistudio.
// The TypeScript compiler error indicates this is declared elsewhere, causing a conflict.

const getAiClient = (): GoogleGenAI => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- CHAT & TEXT ---

export const createChat = (persona: string, sharedKnowledge?: string): Chat => {
  const ai = getAiClient();
  const knowledgeInstruction = sharedKnowledge ? `You have access to the following shared knowledge document. You can reference it when relevant:\n<knowledge>\n${sharedKnowledge}\n</knowledge>\n\n` : '';
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `${knowledgeInstruction}${persona}`,
    },
  });
};

export const generateSimpleText = async (prompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating simple text:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
};


export const generateComplexText = async (prompt: string, sharedKnowledge?: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const knowledgeInstruction = sharedKnowledge ? `You have access to the following shared knowledge document. You can reference it when relevant:\n<knowledge>\n${sharedKnowledge}\n</knowledge>\n\n` : '';
    const fullPrompt = `${knowledgeInstruction}${prompt}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: fullPrompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating complex text:", error);
    return "An error occurred. I might need a moment to think.";
  }
};

// --- TEXT-TO-SPEECH (TTS) ---

export const generateSpeech = async (text: string, voice: string): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

// --- IMAGE GENERATION ---

export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' = '1:1'): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: aspectRatio,
      },
    });
    const base64ImageBytes = response.generatedImages[0]?.image?.imageBytes;
    return base64ImageBytes ? `data:image/png;base64,${base64ImageBytes}` : null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const editImageWithText = async (base64Data: string, mimeType: string, prompt: string): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    return null;
  }
};


// --- VIDEO GENERATION ---
export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio,
    }
  });
};

export const checkVideoOperation = async (operation: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await ai.operations.getVideosOperation({ operation: operation });
}

// --- LIVE INTERACTION ---

export const connectLive = async (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => Promise<void>;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}): Promise<LiveSession> => {
    const ai = getAiClient();
    return await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: 'You are a helpful and friendly AI companion. Keep your responses concise and conversational.',
        },
    });
};