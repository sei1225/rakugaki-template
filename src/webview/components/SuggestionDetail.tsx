import type React from 'react';
import appStyles from '../App.module.css';
import btnStyles from '../common.module.css';
import type { Suggestion } from '../types';
import styles from './SuggestionDetail.module.css';

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
  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return styles.priorityHigh;
      case 'medium':
        return styles.priorityMedium;
      case 'low':
        return styles.priorityLow;
      default:
        return '';
    }
  };

  return (
    <div>
      <div className={appStyles.header}>
        <button type="button" className={appStyles.backBtn} onClick={onBack}>
          ← 戻る
        </button>
        <h3>提案について議論</h3>
      </div>

      <div className={styles.detail}>
        <div className={getPriorityClass(suggestion.priority)}>
          <div className={styles.header}>
            <div className={styles.title}>{suggestion.title}</div>
            <div className={styles.category}>{suggestion.category}</div>
          </div>
          <div className={styles.description}>{suggestion.description}</div>

          {suggestion.codeExample && (
            <div className={styles.codeExample}>
              <div className={styles.codeLabel}>変更前:</div>
              <div className={styles.codeBefore}>
                <pre className={styles.pre}>
                  {suggestion.codeExample.before}
                </pre>
              </div>
              <div className={styles.codeLabel}>変更後:</div>
              <div className={styles.codeAfter}>
                <pre className={styles.pre}>{suggestion.codeExample.after}</pre>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            {suggestion.codeExample && (
              <button
                type="button"
                className={`${btnStyles.btn} ${btnStyles.btnPrimary}`}
                onClick={() => onApply(suggestion.id)}
              >
                適用
              </button>
            )}
            <button
              type="button"
              className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
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
