import type React from 'react';
import styles from './App.module.css';
import { DiscussionChat } from './components/DiscussionChat';
import { SuggestionDetail } from './components/SuggestionDetail';
import { SuggestionsList } from './components/SuggestionsList';
import { useVSCodeMessage } from './hooks/useVSCodeMessage';
import { useAppStore } from './store/useAppStore';
import type { DiscussionMessage } from './types';

export const App: React.FC = () => {
  // Zustand store - state
  const view = useAppStore((state) => state.view);
  const currentSuggestion = useAppStore((state) => state.currentSuggestion);

  // Zustand store - actions
  const setSuggestions = useAppStore((state) => state.setSuggestions);
  const setIsTyping = useAppStore((state) => state.setIsTyping);
  const addDiscussionMessage = useAppStore(
    (state) => state.addDiscussionMessage,
  );

  // VSCode message handlers
  const handleDiscussionResponse = (
    response: string,
    agent: string,
    suggestionId: string,
  ) => {
    setIsTyping(false);

    const agentNames: Record<string, string> = {
      'claude-chat': 'Claude',
      'copilot-chat': 'Copilot',
      'local-analysis': 'ローカル分析',
      auto: 'AI エージェント',
    };

    const agentMessage: DiscussionMessage = {
      type: 'agent',
      sender: agentNames[agent] || 'AI エージェント',
      content: response,
      timestamp: new Date().toLocaleTimeString(),
    };

    addDiscussionMessage(suggestionId, agentMessage);
  };

  const handleDiscussionError = (error: string, suggestionId: string) => {
    setIsTyping(false);

    const errorMessage: DiscussionMessage = {
      type: 'agent',
      sender: 'システム',
      content: `エラーが発生しました: ${error}`,
      timestamp: new Date().toLocaleTimeString(),
    };

    addDiscussionMessage(suggestionId, errorMessage);
  };

  // VSCode message listeners
  useVSCodeMessage('updateSuggestions', (message) => {
    setSuggestions(message.suggestions);
  });

  useVSCodeMessage('discussionResponse', (message) => {
    handleDiscussionResponse(
      message.response,
      message.agent,
      message.suggestionId,
    );
  });

  useVSCodeMessage('discussionError', (message) => {
    handleDiscussionError(message.error, message.suggestionId);
  });

  return (
    <div className={styles.app}>
      {view === 'list' ? (
        <div>
          <div className={styles.header}>
            <h3>AI提案</h3>
            <div className={styles.agentStatus}>エージェント接続中...</div>
          </div>
          <SuggestionsList />
        </div>
      ) : (
        currentSuggestion && (
          <div>
            <SuggestionDetail />
            <DiscussionChat />
          </div>
        )
      )}
    </div>
  );
};
