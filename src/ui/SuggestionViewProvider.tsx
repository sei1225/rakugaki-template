import * as vscode from 'vscode';
import type { AgentManager } from '../core/AgentManager';
import type { Suggestion } from '../types';

/**
 * AI提案を表示するReactベースのWebViewProvider
 */
export class SuggestionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rakugaki.suggestionView';

  private _view?: vscode.WebviewView;
  private _suggestions: Suggestion[] = [];
  private _agentManager?: AgentManager;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    agentManager?: AgentManager,
  ) {
    this._agentManager = agentManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'out')],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // WebViewからのメッセージを受信
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'applySuggestion':
            this._applySuggestion(message.suggestionId);
            break;
          case 'dismissSuggestion':
            this._dismissSuggestion(message.suggestionId);
            break;
          case 'sendDiscussionMessage':
            this._handleDiscussionMessage(
              message.message,
              message.agent,
              message.suggestionId,
              message.suggestion,
              message.history,
            );
            break;
        }
      },
      undefined,
      [],
    );
  }

  /**
   * 新しい提案を追加
   */
  public addSuggestions(suggestions: Suggestion[]) {
    this._suggestions.push(...suggestions);
    this._updateWebview();
  }

  /**
   * 提案をクリア
   */
  public clearSuggestions() {
    this._suggestions = [];
    this._updateWebview();
  }

  /**
   * WebViewの内容を更新
   */
  private _updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateSuggestions',
        suggestions: this._suggestions,
      });
    }
  }

  /**
   * 提案を適用
   */
  private async _applySuggestion(suggestionId: string) {
    const suggestion = this._suggestions.find((s) => s.id === suggestionId);
    if (!suggestion || !suggestion.codeExample) {
      vscode.window.showWarningMessage('提案にコード例がありません');
      return;
    }

    try {
      if (suggestion.sourceLocation) {
        const success = await this._applyWithLocationInfo(suggestion);
        if (success) {
          this._dismissSuggestion(suggestionId);
          vscode.window.showInformationMessage('提案を適用しました');
          return;
        }
      }

      await this._applyToActiveEditor(suggestion);
      this._dismissSuggestion(suggestionId);
      vscode.window.showInformationMessage('提案を適用しました');
    } catch (error) {
      console.error('提案適用に失敗:', error);
      vscode.window.showErrorMessage('提案の適用に失敗しました');
    }
  }

  /**
   * 位置情報を使用した正確な提案適用
   */
  private async _applyWithLocationInfo(
    suggestion: Suggestion,
  ): Promise<boolean> {
    if (!suggestion.sourceLocation || !suggestion.codeExample) {
      return false;
    }

    const location = suggestion.sourceLocation;
    const fileUri = vscode.Uri.file(location.filePath);

    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document);

      const currentRange = new vscode.Range(
        location.startLine,
        location.startCharacter,
        location.endLine,
        location.endCharacter,
      );

      const currentText = document.getText(currentRange);

      if (this._isTextSimilar(currentText, location.originalText)) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(fileUri, currentRange, suggestion.codeExample.after);
        await vscode.workspace.applyEdit(edit);

        const newEndLine =
          location.startLine +
          suggestion.codeExample.after.split('\n').length -
          1;
        const newEndCharacter =
          suggestion.codeExample.after.split('\n').pop()?.length || 0;
        const newRange = new vscode.Range(
          location.startLine,
          location.startCharacter,
          newEndLine,
          newEndCharacter,
        );
        editor.selection = new vscode.Selection(newRange.start, newRange.end);

        return true;
      } else {
        const foundRange = this._findTextInDocument(
          document,
          suggestion.codeExample.before,
        );
        if (foundRange) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(fileUri, foundRange, suggestion.codeExample.after);
          await vscode.workspace.applyEdit(edit);
          editor.selection = new vscode.Selection(
            foundRange.start,
            foundRange.end,
          );
          return true;
        }
      }
    } catch (error) {
      console.error('位置情報を使用した適用に失敗:', error);
    }

    return false;
  }

  /**
   * アクティブエディターへの従来の適用方式
   */
  private async _applyToActiveEditor(suggestion: Suggestion) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !suggestion.codeExample) {
      throw new Error('アクティブなエディターがありません');
    }

    const edit = new vscode.WorkspaceEdit();
    const selection = editor.selection;

    if (suggestion.codeExample.before) {
      let targetRange: vscode.Range;

      if (!selection.isEmpty) {
        targetRange = selection;
      } else {
        const foundRange = this._findTextInDocument(
          editor.document,
          suggestion.codeExample.before,
        );
        if (foundRange) {
          targetRange = foundRange;
        } else {
          throw new Error('適用する対象のコードが見つかりません');
        }
      }

      edit.replace(
        editor.document.uri,
        targetRange,
        suggestion.codeExample.after,
      );
    } else {
      edit.insert(
        editor.document.uri,
        selection.start,
        suggestion.codeExample.after,
      );
    }

    await vscode.workspace.applyEdit(edit);
  }

  /**
   * 文書内でテキストを検索
   */
  private _findTextInDocument(
    document: vscode.TextDocument,
    searchText: string,
  ): vscode.Range | null {
    const text = document.getText();
    const normalizedSearch = searchText.trim();

    const index = text.indexOf(normalizedSearch);
    if (index !== -1) {
      const startPos = document.positionAt(index);
      const endPos = document.positionAt(index + normalizedSearch.length);
      return new vscode.Range(startPos, endPos);
    }

    const lines = text.split('\n');
    const searchLines = normalizedSearch.split('\n');

    for (let i = 0; i <= lines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (lines[i + j]?.trim() !== searchLines[j]?.trim()) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const startPos = new vscode.Position(i, 0);
        const endPos = new vscode.Position(
          i + searchLines.length - 1,
          lines[i + searchLines.length - 1]?.length || 0,
        );
        return new vscode.Range(startPos, endPos);
      }
    }

    return null;
  }

  /**
   * テキストの類似性をチェック
   */
  private _isTextSimilar(text1: string, text2: string): boolean {
    const normalize = (text: string) =>
      text.replace(/\s+/g, ' ').trim().toLowerCase();
    return normalize(text1) === normalize(text2);
  }

  /**
   * 提案を却下
   */
  private _dismissSuggestion(suggestionId: string) {
    this._suggestions = this._suggestions.filter((s) => s.id !== suggestionId);
    this._updateWebview();
  }

  /**
   * 議論メッセージを処理
   */
  private async _handleDiscussionMessage(
    message: string,
    agentType: string,
    suggestionId: string,
    suggestion: any,
    history: any[],
  ) {
    if (!this._agentManager) {
      this._sendDiscussionError('AIエージェントが利用できません', suggestionId);
      return;
    }

    try {
      const context = await this._buildDiscussionContext(
        message,
        suggestion,
        history,
      );
      const selectedAgent = this._selectChatAgent(agentType);

      if (!selectedAgent) {
        this._sendDiscussionError(
          '選択されたエージェントが利用できません',
          suggestionId,
        );
        return;
      }

      const response = await this._generateDiscussionResponse(
        selectedAgent,
        context,
      );
      this._sendDiscussionResponse(response, agentType, suggestionId);
    } catch (error) {
      console.error('Discussion message handling failed:', error);
      this._sendDiscussionError(
        '議論処理中にエラーが発生しました',
        suggestionId,
      );
    }
  }

  /**
   * 議論コンテキストを構築
   */
  private async _buildDiscussionContext(
    message: string,
    suggestion: any,
    history: any[],
  ) {
    const activeEditor = vscode.window.activeTextEditor;
    let fileContext = '';

    if (activeEditor) {
      const document = activeEditor.document;
      const selection = activeEditor.selection;

      fileContext = `
現在のファイル: ${document.fileName}
言語: ${document.languageId}
${!selection.isEmpty ? `選択範囲: ${document.getText(selection)}` : ''}
      `.trim();
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceContext = workspaceFolder
      ? `ワークスペース: ${workspaceFolder.name}`
      : '';

    const discussionHistory = history
      .map((h) => `${h.sender}: ${h.content}`)
      .join('\n');

    return {
      message,
      suggestion: {
        title: suggestion.title,
        category: suggestion.category,
        description: suggestion.description,
        codeExample: suggestion.codeExample,
        reasoning: suggestion.reasoning,
        sourceLocation: suggestion.sourceLocation,
      },
      fileContext,
      workspaceContext,
      discussionHistory,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * チャット用エージェントを選択
   */
  private _selectChatAgent(agentType: string) {
    if (!this._agentManager) return null;

    const availableAgents = this._agentManager.getAvailableAgents();

    if (agentType === 'auto') {
      return availableAgents.find((agent) => agent.isAvailable);
    } else {
      return availableAgents.find(
        (agent) => agent.type === agentType && agent.isAvailable,
      );
    }
  }

  /**
   * 議論応答を生成
   */
  private async _generateDiscussionResponse(
    agent: any,
    context: any,
  ): Promise<string> {
    const prompt = this._buildDiscussionPrompt(context);

    if (agent.type === 'claude-chat') {
      return await this._generateClaudeChatResponse(prompt);
    } else if (agent.type === 'copilot-chat') {
      return await this._generateCopilotChatResponse(prompt);
    } else {
      return await this._generateLocalDiscussionResponse(context);
    }
  }

  /**
   * 議論プロンプトを構築
   */
  private _buildDiscussionPrompt(context: any): string {
    return `あなたはコード品質改善のAIアシスタントです。特定の提案について、ユーザーと詳細に議論してください。

【提案情報】
タイトル: ${context.suggestion.title}
カテゴリー: ${context.suggestion.category}
説明: ${context.suggestion.description}
理由: ${context.suggestion.reasoning}

${
  context.suggestion.codeExample
    ? `
【コード例】
変更前:
${context.suggestion.codeExample.before}

変更後:
${context.suggestion.codeExample.after}
`
    : ''
}

【ユーザーの質問】
${context.message}

【コンテキスト】
${context.fileContext}
${context.workspaceContext}

【議論履歴】
${context.discussionHistory}

この提案について、具体的で建設的な回答を日本語で提供してください。実装方法、リスク、代替案、理由などについて詳しく説明してください。`;
  }

  /**
   * Claude Chat 応答生成
   */
  private async _generateClaudeChatResponse(prompt: string): Promise<string> {
    try {
      // TODO: 実際のClaude Chat Extension APIの呼び出し
      return 'Claude Chatからの応答です。現在のコードについて何かご質問があれば、お聞かせください。';
    } catch (error) {
      throw new Error('Claude Chatとの通信に失敗しました');
    }
  }

  /**
   * Copilot Chat 応答生成
   */
  private async _generateCopilotChatResponse(prompt: string): Promise<string> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
      });

      if (models.length === 0) {
        throw new Error('Copilot Chat モデルが利用できません');
      }

      const model = models[0];
      const chatResponse = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(prompt)],
        {},
        new vscode.CancellationTokenSource().token,
      );

      let fullResponse = '';
      for await (const fragment of chatResponse.text) {
        fullResponse += fragment;
      }

      return fullResponse || 'Copilotからの応答を取得できませんでした。';
    } catch (error) {
      throw new Error('Copilot Chatとの通信に失敗しました');
    }
  }

  /**
   * ローカル議論応答生成
   */
  private async _generateLocalDiscussionResponse(
    context: any,
  ): Promise<string> {
    const suggestion = context.suggestion;
    const message = context.message.toLowerCase();

    if (message.includes('なぜ') || message.includes('理由')) {
      return `「${suggestion.title}」が必要な理由：

${suggestion.reasoning}

この改善により、コードの${suggestion.category === '記法改善' ? '読みやすさ' : suggestion.category === 'パフォーマンス' ? '実行効率' : '設計品質'}が向上します。`;
    }

    if (message.includes('どうやって') || message.includes('実装')) {
      return `「${suggestion.title}」の実装方法：

${
  suggestion.codeExample
    ? `
1. 現在のコード：
\`\`\`
${suggestion.codeExample.before}
\`\`\`

2. 改善後のコード：
\`\`\`
${suggestion.codeExample.after}
\`\`\`

このように変更することで改善できます。`
    : '具体的なコード例が利用できませんが、' +
      suggestion.description +
      'を参考に実装してください。'
}`;
    }

    if (message.includes('リスク') || message.includes('問題')) {
      return `「${suggestion.title}」のリスク分析：

- ${suggestion.category}に関する変更のため、既存の動作に影響する可能性は低いです
- テストが十分にある場合は安全に適用できます
- 段階的に適用することを推奨します

何か具体的な懸念点がございましたら、詳しくお聞かせください。`;
    }

    if (message.includes('他の') || message.includes('代替')) {
      return `「${suggestion.title}」の代替案：

現在の提案以外にも、以下のような方法が考えられます：
- より段階的なアプローチ
- 異なる技術やパターンの採用
- 設定による調整

具体的にどのような代替案について知りたいか、詳しく教えてください。`;
    }

    return `「${suggestion.title}」について詳しく説明いたします。

${suggestion.description}

この提案について、実装方法、理由、リスク、代替案など、どの点について詳しく知りたいでしょうか？`;
  }

  /**
   * 議論応答をWebViewに送信
   */
  private _sendDiscussionResponse(
    response: string,
    agentType: string,
    suggestionId: string,
  ) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'discussionResponse',
        response: response,
        agent: agentType,
        suggestionId: suggestionId,
      });
    }
  }

  /**
   * 議論エラーをWebViewに送信
   */
  private _sendDiscussionError(error: string, suggestionId: string) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'discussionError',
        error: error,
        suggestionId: suggestionId,
      });
    }
  }

  /**
   * WebViewのHTML内容を生成（React版）
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js'),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>AI提案</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
        }

        .app {
            width: 100%;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 16px;
        }

        .header h3 {
            margin: 0;
            color: var(--vscode-foreground);
        }

        .agent-status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .suggestions-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .suggestion {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            background-color: var(--vscode-editor-background);
        }

        .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .suggestion-title {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .suggestion-category {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 2px;
            font-size: 12px;
        }

        .suggestion-description {
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .code-example {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            margin: 8px 0;
        }

        .code-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }

        .code-before, .code-after {
            margin: 4px 0;
        }

        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .suggestion-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }

        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .discuss-btn {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
        }

        .btn:hover {
            opacity: 0.8;
        }

        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 32px 16px;
        }

        .priority-high { border-left: 4px solid var(--vscode-errorForeground); }
        .priority-medium { border-left: 4px solid var(--vscode-warningForeground); }
        .priority-low { border-left: 4px solid var(--vscode-textLink-foreground); }

        .back-btn {
            background: none;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 14px;
            padding: 4px 8px;
        }

        .back-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 2px;
        }

        .suggestion-detail {
            margin-bottom: 24px;
        }

        .discussion-section {
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 16px;
        }

        .discussion-section h4 {
            margin: 0 0 16px 0;
            color: var(--vscode-foreground);
        }

        .quick-questions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
        }

        .quick-question-btn {
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .quick-question-btn:hover {
            opacity: 0.8;
        }

        .discussion-messages {
            max-height: 300px;
            overflow-y: auto;
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 8px;
            background-color: var(--vscode-editor-background);
        }

        .discussion-message {
            margin-bottom: 16px;
            padding: 8px;
            border-radius: 4px;
        }

        .discussion-message.user {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            margin-left: 20%;
            text-align: right;
        }

        .discussion-message.agent {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            margin-right: 20%;
        }

        .discussion-message .sender {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
            opacity: 0.8;
        }

        .discussion-message .content {
            line-height: 1.4;
            white-space: pre-wrap;
        }

        .discussion-message .timestamp {
            font-size: 10px;
            opacity: 0.6;
            margin-top: 4px;
        }

        .typing-indicator {
            padding: 8px;
            font-style: italic;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            display: none;
        }

        .discussion-input-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .discussion-input {
            padding: 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            resize: vertical;
            min-height: 60px;
            font-family: var(--vscode-font-family);
        }

        .discussion-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .input-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }

        .agent-selector-small {
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 12px;
        }

        .send-btn {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }

        .send-btn:hover {
            opacity: 0.8;
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .loading-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid var(--vscode-button-foreground);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spinner-rotation 0.6s linear infinite;
            margin-right: 6px;
            vertical-align: middle;
        }

        @keyframes spinner-rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
