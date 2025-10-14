import type React from 'react';
import type { Suggestion } from '../types';

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onDiscuss: (suggestion: Suggestion) => void;
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
}

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
  suggestions,
  onDiscuss,
  onApply,
  onDismiss,
}) => {
  if (suggestions.length === 0) {
    return (
      <div className="empty-state">
        <p>まだ提案はありません</p>
        <p>ファイルを編集すると、AI提案が表示されます</p>
      </div>
    );
  }

  return (
    <div className="suggestions-container">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={`suggestion priority-${suggestion.priority}`}
        >
          <div className="suggestion-header">
            <div className="suggestion-title">{suggestion.title}</div>
            <div className="suggestion-category">{suggestion.category}</div>
          </div>
          <div className="suggestion-description">{suggestion.description}</div>

          {suggestion.codeExample && (
            <div className="code-example">
              <div className="code-label">変更前:</div>
              <div className="code-before">
                <pre>{suggestion.codeExample.before}</pre>
              </div>
              <div className="code-label">変更後:</div>
              <div className="code-after">
                <pre>{suggestion.codeExample.after}</pre>
              </div>
            </div>
          )}

          <div className="suggestion-actions">
            <button
              className="btn discuss-btn"
              onClick={() => onDiscuss(suggestion)}
            >
              💬 議論する
            </button>
            {suggestion.codeExample && (
              <button
                className="btn btn-primary"
                onClick={() => onApply(suggestion.id)}
              >
                適用
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => onDismiss(suggestion.id)}
            >
              却下
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
