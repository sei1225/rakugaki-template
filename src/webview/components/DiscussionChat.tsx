import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { DiscussionMessage, Suggestion } from '../types';

interface DiscussionChatProps {
  suggestion: Suggestion;
  messages: DiscussionMessage[];
  isTyping: boolean;
  onSendMessage: (message: string, agent: string) => void;
}

export const DiscussionChat: React.FC<DiscussionChatProps> = ({
  suggestion,
  messages,
  isTyping,
  onSendMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue, selectedAgent);
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
      why: `なぜ「${suggestion.title}」という改善が必要なのですか？現在のコードの何が問題なのでしょうか？`,
      how: `「${suggestion.title}」はどのように実装すればよいですか？具体的な手順を教えてください。`,
      risk: `「${suggestion.title}」を適用することによるリスクや副作用はありますか？`,
      alternative: `「${suggestion.title}」以外に、他にどのような改善方法がありますか？`,
    };

    const question = questions[type];
    if (question) {
      setInputValue(question);
    }
  };

  return (
    <div className="discussion-section">
      <h4>この提案について議論</h4>

      <div className="quick-questions">
        <button
          className="quick-question-btn"
          onClick={() => askQuickQuestion('why')}
        >
          💡 なぜこの改善が必要？
        </button>
        <button
          className="quick-question-btn"
          onClick={() => askQuickQuestion('how')}
        >
          🔧 どうやって実装する？
        </button>
        <button
          className="quick-question-btn"
          onClick={() => askQuickQuestion('risk')}
        >
          ⚠️ リスクはある？
        </button>
        <button
          className="quick-question-btn"
          onClick={() => askQuickQuestion('alternative')}
        >
          🔄 他の方法は？
        </button>
      </div>

      <div className="discussion-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`discussion-message ${msg.type}`}>
            <div className="sender">{msg.sender}</div>
            <div className="content">{msg.content}</div>
            <div className="timestamp">{msg.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isTyping && (
        <div className="typing-indicator">AIが回答を生成中です...</div>
      )}

      <div className="discussion-input-container">
        <textarea
          className="discussion-input"
          placeholder="この提案について質問や議論したいことを入力してください..."
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="input-actions">
          <select
            className="agent-selector-small"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="auto">自動選択</option>
            <option value="claude-chat">Claude</option>
            <option value="copilot-chat">Copilot</option>
          </select>
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            {isTyping ? (
              <>
                <span className="loading-spinner"></span>
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
