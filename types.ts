export enum AppView {
  Live = 'Live',
  Chat = 'Chat',
  Theatre = 'Theatre',
  Roundtable = 'Roundtable',
  Avatar = 'Avatar',
  Video = 'Video'
}

export interface Character {
  id: string;
  name: string;
  avatarUrl: string; // can be a URL or base64 data URI
  persona: string;
  voice: string; // e.g., 'Kore', 'Puck', 'Zephyr'
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | string; // 'user' or character.id
  character?: Character;
  timestamp: number;
}

export interface OasisState {
  characters: Character[];
  chatLogs: { [characterId: string]: ChatMessage[] };
  theatreLog: ChatMessage[];
  theatreScenario: string;
  theatreBackgroundPrompt: string;
  theatreBackgroundUrl: string | null;
  theatreSelectedActorIds: string[];
  roundtableLog: ChatMessage[];
  roundtableTopic: string;
  roundtableSelectedActorIds: string[];
  sharedKnowledge: string;
}