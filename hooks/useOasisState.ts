import { useState, useEffect } from 'react';
import { OasisState, Character } from '../types';
import { INITIAL_CHARACTERS } from '../constants';

const OASIS_STATE_KEY = 'oasis-state';

function getInitialState(): OasisState {
  let savedStateJson: string | null = null;
  if (typeof window !== 'undefined') {
    savedStateJson = localStorage.getItem(OASIS_STATE_KEY);
  }
  
  const defaultState: OasisState = {
    characters: INITIAL_CHARACTERS,
    chatLogs: {},
    theatreLog: [],
    theatreScenario: '',
    theatreBackgroundPrompt: '',
    theatreBackgroundUrl: null,
    theatreSelectedActorIds: [],
    roundtableLog: [],
    roundtableTopic: '',
    roundtableSelectedActorIds: INITIAL_CHARACTERS.slice(0, 3).map(c => c.id),
    sharedKnowledge: '',
  };

  if (savedStateJson) {
    try {
      const savedState = JSON.parse(savedStateJson) as Partial<OasisState>;
      
      // Intelligent character merging
      const savedCharacters = savedState.characters || [];
      const savedCharIds = new Set(savedCharacters.map(c => c.id));
      const newCharacters = [...savedCharacters];
      
      INITIAL_CHARACTERS.forEach(initialChar => {
        if (!savedCharIds.has(initialChar.id)) {
          newCharacters.push(initialChar);
        }
      });
      
      return { ...defaultState, ...savedState, characters: newCharacters };
    } catch (e) {
      console.error("Failed to parse Oasis state from localStorage", e);
      return defaultState;
    }
  }
  
  return defaultState;
}

export const useOasisState = () => {
  const [oasisState, setOasisState] = useState<OasisState>(getInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(OASIS_STATE_KEY, JSON.stringify(oasisState));
    } catch (e) {
      console.error("Failed to set Oasis state in localStorage", e);
    }
  }, [oasisState]);

  return { oasisState, setOasisState };
};