import { useEffect } from 'react';
import type { VSCodeMessage } from '../types';

/**
 * VSCodeからの特定のメッセージコマンドを受信して処理するカスタムフック
 *
 * @param command - 監視するメッセージコマンド名
 * @param handler - メッセージを受信したときに呼び出されるハンドラー関数
 *
 * @example
 * ```tsx
 * // 提案リストの更新を監視
 * useVSCodeMessage('updateSuggestions', (message) => {
 *   setSuggestions(message.suggestions);
 * });
 *
 * // ディスカッションレスポンスを監視
 * useVSCodeMessage('discussionResponse', (message) => {
 *   handleResponse(message.response, message.agent, message.suggestionId);
 * });
 * ```
 */
export const useVSCodeMessage = <T extends VSCodeMessage = VSCodeMessage>(
  command: string,
  handler: (message: T) => void,
) => {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as VSCodeMessage;

      if (message.command === command) {
        handler(message as T);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [command, handler]);
};
