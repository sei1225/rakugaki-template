import { useAppStore } from '../store/useAppStore';
import type { VSCodeMessage } from '../types';

// VSCode API型定義
declare const acquireVsCodeApi: () => {
  postMessage: (message: VSCodeMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

/**
 * VSCodeとの通信アクションを提供するカスタムフック
 *
 * @example
 * ```tsx
 * const { handleApply, handleDismiss, handleSendMessage } = useVSCodeActions();
 *
 * <button onClick={() => handleApply(suggestionId)}>適用</button>
 * ```
 */
export const useVSCodeActions = () => {
  const setView = useAppStore((state) => state.setView);
  const setCurrentSuggestion = useAppStore((state) => state.setCurrentSuggestion);
  const addDiscussionMessage = useAppStore((state) => state.addDiscussionMessage);
  const setIsTyping = useAppStore((state) => state.setIsTyping);

  /**
   * 提案を適用する
   */
  const handleApply = (suggestionId: string) => {
    vscode.postMessage({
      command: 'applySuggestion',
      suggestionId,
    });
  };

  /**
   * 提案を却下する
   */
  const handleDismiss = (suggestionId: string) => {
    vscode.postMessage({
      command: 'dismissSuggestion',
      suggestionId,
    });

    // 詳細ビューで却下した場合はリストに戻る
    const view = useAppStore.getState().view;
    const currentSuggestion = useAppStore.getState().currentSuggestion;

    if (view === 'detail' && currentSuggestion?.id === suggestionId) {
      setView('list');
      setCurrentSuggestion(null);
    }
  };

  /**
   * ディスカッションメッセージを送信する
   */
  const handleSendMessage = (message: string, agent: string) => {
    const currentSuggestion = useAppStore.getState().currentSuggestion;
    const discussionHistory = useAppStore.getState().discussionHistory;

    if (!currentSuggestion) return;

    // ユーザーメッセージを追加
    const userMessage = {
      type: 'user' as const,
      sender: 'あなた',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
    };

    addDiscussionMessage(currentSuggestion.id, userMessage);
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

  return {
    handleApply,
    handleDismiss,
    handleSendMessage,
  };
};
