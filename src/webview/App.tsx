import type React from 'react';
import { useEffect, useState } from 'react';
import styles from './App.module.css';
import { DiscussionChat } from './components/DiscussionChat';
import { SuggestionDetail } from './components/SuggestionDetail';
import { SuggestionsList } from './components/SuggestionsList';
import type { DiscussionMessage, Suggestion, VSCodeMessage } from './types';

// VSCode API型定義
declare const acquireVsCodeApi: () => {
  postMessage: (message: VSCodeMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

type View = 'list' | 'detail';

export const App: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<Suggestion | null>(
    null,
  );
  const [discussionHistory, setDiscussionHistory] = useState<
    Record<string, DiscussionMessage[]>
  >({});
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as VSCodeMessage;

      switch (message.command) {
        case 'updateSuggestions':
          setSuggestions(message.suggestions);
          break;

        case 'discussionResponse':
          handleDiscussionResponse(
            message.response,
            message.agent,
            message.suggestionId,
          );
          break;

        case 'discussionError':
          handleDiscussionError(message.error, message.suggestionId);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDiscuss = (suggestion: Suggestion) => {
    setCurrentSuggestion(suggestion);
    setView('detail');

    // 初回メッセージを追加
    if (!discussionHistory[suggestion.id]) {
      const initialMessage: DiscussionMessage = {
        type: 'agent',
        sender: 'AI エージェント',
        content: `「${suggestion.title}」について、お気軽にご質問ください！実装方法、理由、リスク、代替案など、どんなことでも議論しましょう。`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setDiscussionHistory((prev) => ({
        ...prev,
        [suggestion.id]: [initialMessage],
      }));
    }
  };

  const handleApply = (suggestionId: string) => {
    vscode.postMessage({
      command: 'applySuggestion',
      suggestionId,
    });
  };

  const handleDismiss = (suggestionId: string) => {
    vscode.postMessage({
      command: 'dismissSuggestion',
      suggestionId,
    });
    if (view === 'detail' && currentSuggestion?.id === suggestionId) {
      setView('list');
      setCurrentSuggestion(null);
    }
  };

  const handleSendMessage = (message: string, agent: string) => {
    if (!currentSuggestion) return;

    // ユーザーメッセージを追加
    const userMessage: DiscussionMessage = {
      type: 'user',
      sender: 'あなた',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
    };

    setDiscussionHistory((prev) => ({
      ...prev,
      [currentSuggestion.id]: [
        ...(prev[currentSuggestion.id] || []),
        userMessage,
      ],
    }));

    setIsTyping(true);

    // VSCodeにメッセージ送信
    vscode.postMessage({
      command: 'sendDiscussionMessage',
      message,
      agent,
      suggestionId: currentSuggestion.id,
      suggestion: currentSuggestion,
      history: discussionHistory[currentSuggestion.id] || [],
    });
  };

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

    setDiscussionHistory((prev) => ({
      ...prev,
      [suggestionId]: [...(prev[suggestionId] || []), agentMessage],
    }));
  };

  const handleDiscussionError = (error: string, suggestionId: string) => {
    setIsTyping(false);

    const errorMessage: DiscussionMessage = {
      type: 'agent',
      sender: 'システム',
      content: `エラーが発生しました: ${error}`,
      timestamp: new Date().toLocaleTimeString(),
    };

    setDiscussionHistory((prev) => ({
      ...prev,
      [suggestionId]: [...(prev[suggestionId] || []), errorMessage],
    }));
  };

  const handleBack = () => {
    setView('list');
    setCurrentSuggestion(null);
  };

  return (
    <div className={styles.app}>
      {view === 'list' ? (
        <div>
          <div className={styles.header}>
            <h3>AI提案</h3>
            <div className={styles.agentStatus}>エージェント接続中...</div>
          </div>
          <SuggestionsList
            suggestions={suggestions}
            onDiscuss={handleDiscuss}
            onApply={handleApply}
            onDismiss={handleDismiss}
          />
        </div>
      ) : (
        currentSuggestion && (
          <div>
            <SuggestionDetail
              suggestion={currentSuggestion}
              onApply={handleApply}
              onDismiss={handleDismiss}
              onBack={handleBack}
            />
            <DiscussionChat
              suggestion={currentSuggestion}
              messages={discussionHistory[currentSuggestion.id] || []}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
            />
          </div>
        )
      )}
    </div>
  );
};
