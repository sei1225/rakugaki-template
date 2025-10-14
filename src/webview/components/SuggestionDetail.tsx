import type React from 'react';
import type { Suggestion } from '../types';

interface SuggestionDetailProps {
  suggestion: Suggestion;
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onBack: () => void;
}

export const SuggestionDetail: React.FC<SuggestionDetailProps> = ({
  suggestion,
  onApply,
  onDismiss,
  onBack,
}) => {
  return (
    <div>
      <div className="header">
        <button className="back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h3>提案について議論</h3>
      </div>

      <div className="suggestion-detail">
        <div className={`suggestion priority-${suggestion.priority}`}>
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
      </div>
    </div>
  );
};
