import { create } from 'zustand';
import type { DiscussionMessage, Suggestion } from '../types';

type View = 'list' | 'detail';

interface AppState {
  // View state
  view: View;
  setView: (view: View) => void;

  // Suggestions
  suggestions: Suggestion[];
  setSuggestions: (suggestions: Suggestion[]) => void;

  // Current suggestion
  currentSuggestion: Suggestion | null;
  setCurrentSuggestion: (suggestion: Suggestion | null) => void;

  // Discussion
  discussionHistory: Record<string, DiscussionMessage[]>;
  addDiscussionMessage: (suggestionId: string, message: DiscussionMessage) => void;
  initializeDiscussion: (suggestionId: string, initialMessage: DiscussionMessage) => void;

  // Typing state
  isTyping: boolean;
  setIsTyping: (isTyping: boolean) => void;

  // Actions
  handleDiscuss: (suggestion: Suggestion) => void;
  handleBack: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  view: 'list',
  suggestions: [],
  currentSuggestion: null,
  discussionHistory: {},
  isTyping: false,

  // Setters
  setView: (view) => set({ view }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setCurrentSuggestion: (currentSuggestion) => set({ currentSuggestion }),
  setIsTyping: (isTyping) => set({ isTyping }),

  // Discussion management
  addDiscussionMessage: (suggestionId, message) =>
    set((state) => ({
      discussionHistory: {
        ...state.discussionHistory,
        [suggestionId]: [...(state.discussionHistory[suggestionId] || []), message],
      },
    })),

  initializeDiscussion: (suggestionId, initialMessage) =>
    set((state) => {
      if (state.discussionHistory[suggestionId]) {
        return state; // Already initialized
      }
      return {
        discussionHistory: {
          ...state.discussionHistory,
          [suggestionId]: [initialMessage],
        },
      };
    }),

  // Actions
  handleDiscuss: (suggestion) => {
    set({ currentSuggestion: suggestion, view: 'detail' });

    // Initialize discussion if not exists
    const state = get();
    if (!state.discussionHistory[suggestion.id]) {
      const initialMessage: DiscussionMessage = {
        type: 'agent',
        sender: 'AI エージェント',
        content: `「${suggestion.title}」について、お気軽にご質問ください！実装方法、理由、リスク、代替案など、どんなことでも議論しましょう。`,
        timestamp: new Date().toLocaleTimeString(),
      };
      get().initializeDiscussion(suggestion.id, initialMessage);
    }
  },

  handleBack: () => set({ view: 'list', currentSuggestion: null }),
}));
