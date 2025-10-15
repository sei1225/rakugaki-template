import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useVSCodeActions } from '../hooks/useVSCodeActions';
import { useAppStore } from '../store/useAppStore';
import styles from './DiscussionChat.module.css';

export const DiscussionChat: React.FC = () => {
  // Hooks must be called before any conditional returns
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zustand storeから直接取得
  const currentSuggestion = useAppStore((state) => state.currentSuggestion);
  const discussionHistory = useAppStore((state) => state.discussionHistory);
  const isTyping = useAppStore((state) => state.isTyping);

  // VSCode通信アクション
  const { handleSendMessage } = useVSCodeActions();

  if (!currentSuggestion) return null;

  const messages = discussionHistory[currentSuggestion.id] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      handleSendMessage(inputValue, selectedAgent);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const askQuickQuestion = (type: string) => {
    const questions: Record<string, string> = {
      why: `なぜ「${currentSuggestion.title}」という改善が必要なのですか？現在のコードの何が問題なのでしょうか？`,
      how: `「${currentSuggestion.title}」はどのように実装すればよいですか？具体的な手順を教えてください。`,
      risk: `「${currentSuggestion.title}」を適用することによるリスクや副作用はありますか？`,
      alternative: `「${currentSuggestion.title}」以外に、他にどのような改善方法がありますか？`,
    };

    const question = questions[type];
    if (question) {
      setInputValue(question);
    }
  };

  return (
    <div className={styles.section}>
      <h4>この提案について議論</h4>

      <div className={styles.quickQuestions}>
        <button
          type="button"
          className={styles.quickQuestionBtn}
          onClick={() => askQuickQuestion('why')}
        >
          💡 なぜこの改善が必要？
        </button>
        <button
          type="button"
          className={styles.quickQuestionBtn}
          onClick={() => askQuickQuestion('how')}
        >
          🔧 どうやって実装する？
        </button>
        <button
          type="button"
          className={styles.quickQuestionBtn}
          onClick={() => askQuickQuestion('risk')}
        >
          ⚠️ リスクはある？
        </button>
        <button
          type="button"
          className={styles.quickQuestionBtn}
          onClick={() => askQuickQuestion('alternative')}
        >
          🔄 他の方法は？
        </button>
      </div>

      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <div
            key={`${msg.timestamp}-${index}`}
            className={`${styles.message} ${msg.type === 'user' ? styles.messageUser : styles.messageAgent}`}
          >
            <div className={styles.sender}>{msg.sender}</div>
            <div className={styles.content}>{msg.content}</div>
            <div className={styles.timestamp}>{msg.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isTyping && (
        <div className={styles.typingIndicator}>AIが回答を生成中です...</div>
      )}

      <div className={styles.inputContainer}>
        <textarea
          className={styles.input}
          placeholder="この提案について質問や議論したいことを入力してください..."
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.inputActions}>
          <select
            className={styles.agentSelector}
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="auto">自動選択</option>
            <option value="claude-chat">Claude</option>
            <option value="copilot-chat">Copilot</option>
          </select>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            {isTyping ? (
              <>
                <span className={styles.loadingSpinner}></span>
                処理中...
              </>
            ) : (
              '議論を送信'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
