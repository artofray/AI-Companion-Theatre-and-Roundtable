import React, { useState, useMemo } from 'react';
import { AppView, Character, OasisState } from './types';
import { useOasisState } from './hooks/useOasisState';
import Header from './components/Header';
import LiveInteractionView from './components/LiveInteractionView';
import ChatView from './components/ChatView';
import TheatreView from './components/TheatreView';
import RoundtableView from './components/RoundtableView';
import AvatarGeneratorView from './components/AvatarGeneratorView';
import VideoGeneratorView from './components/VideoGeneratorView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Roundtable);
  const { oasisState, setOasisState } = useOasisState();
  
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(oasisState.characters[0]?.id);
  const [characterToEdit, setCharacterToEdit] = useState<Character | null>(null);

  const selectedCharacter = useMemo(() => 
    oasisState.characters.find(c => c.id === selectedCharacterId) || oasisState.characters[0],
    [selectedCharacterId, oasisState.characters]
  );
  
  const handleSaveCharacter = (character: Character) => {
    setOasisState(prev => {
      const isEditing = prev.characters.some(c => c.id === character.id);
      const newCharacters = isEditing 
        ? prev.characters.map(c => c.id === character.id ? character : c)
        : [...prev.characters, character];
      return { ...prev, characters: newCharacters };
    });
    setCharacterToEdit(null);
    setCurrentView(AppView.Chat);
    setSelectedCharacterId(character.id);
  };

  const handleEditCharacter = (character: Character) => {
    setCharacterToEdit(character);
    setCurrentView(AppView.Avatar);
  };

  const handleNavigation = (view: AppView) => {
    if (view !== AppView.Avatar) {
      setCharacterToEdit(null);
    }
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.Live:
        return <LiveInteractionView />;
      case AppView.Chat:
        return <ChatView 
                  characters={oasisState.characters} 
                  selectedCharacter={selectedCharacter} 
                  setSelectedCharacter={(char) => setSelectedCharacterId(char.id)} 
                  onEditCharacter={handleEditCharacter}
                  chatLog={oasisState.chatLogs[selectedCharacter.id] || []}
                  setChatLog={(log) => setOasisState(prev => ({...prev, chatLogs: {...prev.chatLogs, [selectedCharacter.id]: log}}))}
                  sharedKnowledge={oasisState.sharedKnowledge}
                />;
      case AppView.Theatre:
        return <TheatreView 
                  characters={oasisState.characters} 
                  log={oasisState.theatreLog}
                  setLog={(log) => setOasisState(prev => ({...prev, theatreLog: log}))}
                  scenario={oasisState.theatreScenario}
                  setScenario={(s) => setOasisState(prev => ({...prev, theatreScenario: s}))}
                  backgroundUrl={oasisState.theatreBackgroundUrl}
                  setBackgroundUrl={(url) => setOasisState(prev => ({...prev, theatreBackgroundUrl: url}))}
                  backgroundPrompt={oasisState.theatreBackgroundPrompt}
                  setBackgroundPrompt={(p) => setOasisState(prev => ({...prev, theatreBackgroundPrompt: p}))}
                  sharedKnowledge={oasisState.sharedKnowledge}
                />;
      case AppView.Roundtable:
        return <RoundtableView 
                  characters={oasisState.characters} 
                  log={oasisState.roundtableLog}
                  setLog={(log) => setOasisState(prev => ({...prev, roundtableLog: log}))}
                  topic={oasisState.roundtableTopic}
                  setTopic={(t) => setOasisState(prev => ({...prev, roundtableTopic: t}))}
                  selectedActorIds={oasisState.roundtableSelectedActorIds}
                  setSelectedActorIds={(ids) => setOasisState(prev => ({...prev, roundtableSelectedActorIds: ids}))}
                  sharedKnowledge={oasisState.sharedKnowledge}
                  setSharedKnowledge={(k) => setOasisState(prev => ({...prev, sharedKnowledge: k}))}
                />;
      case AppView.Avatar:
        return <AvatarGeneratorView 
                  onCharacterSaved={handleSaveCharacter} 
                  characterToEdit={characterToEdit}
                  onCancel={() => {
                    setCharacterToEdit(null);
                    setCurrentView(AppView.Chat);
                  }}
                />;
      case AppView.Video:
        return <VideoGeneratorView />;
      default:
        return <LiveInteractionView />;
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      <Header currentView={currentView} setCurrentView={handleNavigation} />
      <main className="flex-grow overflow-auto">
        <div className="w-full h-full">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;