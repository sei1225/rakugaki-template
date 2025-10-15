import type React from 'react';
import btnStyles from '../common.module.css';
import { useVSCodeActions } from '../hooks/useVSCodeActions';
import { useAppStore } from '../store/useAppStore';
import styles from './SuggestionsList.module.css';

export const SuggestionsList: React.FC = () => {
  // Zustand storeから直接取得
  const suggestions = useAppStore((state) => state.suggestions);
  const handleDiscuss = useAppStore((state) => state.handleDiscuss);

  // VSCode通信アクション
  const { handleApply, handleDismiss } = useVSCodeActions();
  if (suggestions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>まだ提案はありません</p>
        <p>ファイルを編集すると、AI提案が表示されます</p>
      </div>
    );
  }

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
    <div className={styles.container}>
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={`${styles.suggestion} ${getPriorityClass(suggestion.priority)}`}
        >
          <div className={styles.header}>
            <div className={styles.title}>{suggestion.title}</div>
            <div className={styles.category}>{suggestion.category}</div>
          </div>
          <div className={styles.description}>{suggestion.description}</div>

          {suggestion.codeExample && (
            <div className={styles.codeExample}>
              <div className={styles.codeLabel}>変更前:</div>
              <div className={styles.codeBefore}>
                <pre>{suggestion.codeExample.before}</pre>
              </div>
              <div className={styles.codeLabel}>変更後:</div>
              <div className={styles.codeAfter}>
                <pre>{suggestion.codeExample.after}</pre>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={`${btnStyles.btn} ${btnStyles.btnDiscuss}`}
              onClick={() => handleDiscuss(suggestion)}
            >
              💬 議論する
            </button>
            {suggestion.codeExample && (
              <button
                type="button"
                className={`${btnStyles.btn} ${btnStyles.btnPrimary}`}
                onClick={() => handleApply(suggestion.id)}
              >
                適用
              </button>
            )}
            <button
              type="button"
              className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
              onClick={() => handleDismiss(suggestion.id)}
            >
              却下
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
