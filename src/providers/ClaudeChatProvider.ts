import * as vscode from 'vscode';
import { IAgentProvider, AgentInfo, Suggestion, WorkspaceEnrichedContext, AgentType } from '../types';

/**
 * Claude Chat Extension統合プロバイダー
 */
export class ClaudeChatProvider implements IAgentProvider {
  private claudeExtension: vscode.Extension<any> | undefined;
  private isInitialized = false;

  getAgentInfo(): AgentInfo {
    return {
      type: 'claude-chat',
      name: 'Claude Chat Extension',
      version: this.claudeExtension?.packageJSON?.version,
      isAvailable: this.isInitialized && !!this.claudeExtension?.isActive,
      capabilities: [
        'プロジェクト全体理解',
        '依存関係解析',
        '既存パターン学習',
        '日本語対応',
        'VSCode統合認証'
      ]
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.claudeExtension = vscode.extensions.getExtension('anthropic.claude-dev');
      return !!this.claudeExtension?.isActive;
    } catch (error) {
      console.warn('Claude Chat Extension availability check failed:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    try {
      this.claudeExtension = vscode.extensions.getExtension('anthropic.claude-dev');

      if (!this.claudeExtension) {
        throw new Error('Claude Chat Extension not found');
      }

      if (!this.claudeExtension.isActive) {
        await this.claudeExtension.activate();
      }

      this.isInitialized = true;
      console.log('Claude Chat Extension統合完了');
    } catch (error) {
      console.error('Claude Chat Extension initialization failed:', error);
      throw error;
    }
  }

  async generateSuggestion(context: WorkspaceEnrichedContext): Promise<Suggestion> {
    if (!this.isInitialized || !this.claudeExtension?.isActive) {
      throw new Error('Claude Chat Extension not available');
    }

    try {
      const prompt = this.buildWorkspaceContextPrompt(context);

      // Claude Chat Extension APIを使用（実際のAPIは仕様に依存）
      // 注意: 実際のClaude Chat Extension APIは公開されていない可能性があります
      // ここでは概念的な実装を示します
      const response = await this.callClaudeExtensionAPI(prompt, context);

      return this.parseClaudeResponse(response, context);
    } catch (error) {
      console.error('Claude Chat suggestion generation failed:', error);
      throw error;
    }
  }

  private buildWorkspaceContextPrompt(context: WorkspaceEnrichedContext): string {
    return `@workspace このコード変更について、プロジェクト全体を考慮した品質改善提案をお願いします。

【変更情報】
ファイル: ${context.fileName}
言語: ${context.language}
プロジェクトタイプ: ${context.projectStructure.type}

変更内容:
\`\`\`${context.language}
${context.changeText || context.code.split('\\n').slice(-10).join('\\n')}
\`\`\`

【プロジェクトコンテキスト】
- 関連ファイル: ${context.relatedFiles.slice(0, 5).join(', ')}
- 依存関係: ${context.dependencies.slice(0, 5).join(', ')}
- 設計パターン: ${context.designPrinciples.slice(0, 3).join(', ')}

【分析要求】
1. **記法改善**: プロジェクトの既存パターンに合わせた記法改善
2. **パフォーマンス**: 関連ファイルも考慮した最適化提案
3. **設計改善**: アーキテクチャとの整合性を重視した改善案

【出力形式】
JSON形式で以下の構造で回答してください：
{
  "category": "記法改善|パフォーマンス|設計改善",
  "priority": "high|medium|low",
  "title": "提案タイトル",
  "description": "プロジェクト全体を考慮した詳細説明",
  "codeExample": {
    "before": "改善前のコード",
    "after": "改善後のコード"
  },
  "reasoning": "既存パターンとの整合性を含む提案理由",
  "relatedFiles": ["影響を受ける関連ファイル"],
  "projectImpact": "プロジェクト全体への影響度"
}`;
  }

  private async callClaudeExtensionAPI(prompt: string, context: WorkspaceEnrichedContext): Promise<string> {
    // 注意: 実際のClaude Chat Extension APIは非公開の可能性があります
    // ここでは概念的な実装を示します

    try {
      // Extension APIが利用可能な場合の実装例
      if (this.claudeExtension?.exports?.sendMessage) {
        const response = await this.claudeExtension.exports.sendMessage({
          message: prompt,
          includeWorkspaceContext: true,
          activeFile: context.document.uri,
          analysisMode: 'quality-improvement'
        });
        return response;
      }

      // フォールバック: コマンド実行によるアプローチ
      await vscode.commands.executeCommand('claude.sendMessage', prompt);

      // 実際の実装では、適切なレスポンス取得方法を使用
      return JSON.stringify({
        category: "記法改善",
        priority: "medium",
        title: "Claude統合テスト提案",
        description: "Claude Chat Extension統合のテスト実装です。実際のAPIアクセスが必要です。",
        reasoning: "Claude Chat Extension APIの詳細仕様確認が必要",
        projectImpact: "実装レベル"
      });

    } catch (error) {
      console.warn('Claude Extension API call failed, using fallback:', error);

      // フォールバック実装
      return JSON.stringify({
        category: "設計改善",
        priority: "low",
        title: "Claude統合準備中",
        description: "Claude Chat Extension API統合の準備段階です。",
        reasoning: "API仕様の詳細確認後に完全実装を行います",
        projectImpact: "準備段階"
      });
    }
  }

  private parseClaudeResponse(response: string, context: WorkspaceEnrichedContext): Suggestion {
    try {
      const parsed = JSON.parse(response);

      return {
        id: `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: parsed.category || '記法改善',
        priority: parsed.priority || 'medium',
        title: parsed.title || 'Claude提案',
        description: parsed.description || '',
        codeExample: parsed.codeExample,
        reasoning: parsed.reasoning || '',
        relatedFiles: parsed.relatedFiles || [],
        projectImpact: parsed.projectImpact,
        agent: 'claude-chat',
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Failed to parse Claude response, creating fallback suggestion:', error);

      return {
        id: `claude-fallback-${Date.now()}`,
        category: '設計改善',
        priority: 'low',
        title: 'Claude統合テスト',
        description: 'Claude Chat Extension統合のテスト段階です。',
        reasoning: 'API統合の検証中',
        agent: 'claude-chat',
        timestamp: Date.now()
      };
    }
  }
}