import * as vscode from 'vscode';
import { IAgentProvider, AgentInfo, Suggestion, WorkspaceEnrichedContext, AgentType } from '../types';

/**
 * GitHub Copilot Chat API統合プロバイダー
 */
export class CopilotChatProvider implements IAgentProvider {
  private preferredFamily = 'gpt-4o';
  private isInitialized = false;
  private availableModels: vscode.LanguageModelChat[] = [];

  getAgentInfo(): AgentInfo {
    return {
      type: 'copilot-chat',
      name: 'GitHub Copilot Chat',
      version: this.availableModels[0]?.version,
      isAvailable: this.isInitialized && this.availableModels.length > 0,
      capabilities: [
        'リアルタイムコンテキスト',
        'ストリーミングレスポンス',
        'GitHub統合',
        'VSCode Language Model API',
        'ワークスペース全体認識'
      ]
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: this.preferredFamily
      });
      this.availableModels = models;
      return models.length > 0;
    } catch (error) {
      console.warn('Copilot Chat API availability check failed:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: this.preferredFamily
      });

      if (models.length === 0) {
        throw new Error('Copilot models not available');
      }

      this.availableModels = models;
      this.isInitialized = true;
      console.log('Copilot Chat API統合完了');
    } catch (error) {
      console.error('Copilot Chat API initialization failed:', error);
      throw error;
    }
  }

  async generateSuggestion(context: WorkspaceEnrichedContext): Promise<Suggestion> {
    if (!this.isInitialized || this.availableModels.length === 0) {
      throw new Error('Copilot Chat API not available');
    }

    try {
      const model = this.availableModels[0];
      const prompt = this.buildWorkspaceAnalysisPrompt(context);

      const chatResponse = await model.sendRequest([
        vscode.LanguageModelChatMessage.User(prompt)
      ], {}, new vscode.CancellationTokenSource().token);

      return await this.parseStreamingResponse(chatResponse, context);
    } catch (error) {
      console.error('Copilot suggestion generation failed:', error);
      throw error;
    }
  }

  private buildWorkspaceAnalysisPrompt(context: WorkspaceEnrichedContext): string {
    return `@workspace このコード変更について、プロジェクト全体のコンテキストを考慮した品質改善提案をお願いします。

【変更詳細】
ファイル: ${context.fileName}
言語: ${context.language}
プロジェクトタイプ: ${context.projectStructure.type}

変更内容:
\`\`\`${context.language}
${context.changeText || context.code.split('\\n').slice(-10).join('\\n')}
\`\`\`

【プロジェクトコンテキスト】
- 関連ファイル: ${context.relatedFiles.slice(0, 5).join(', ')}
- 主要依存関係: ${context.dependencies.slice(0, 5).join(', ')}
- コードパターン: ${context.codePatterns.slice(0, 3).map(p => p.pattern).join(', ')}

【分析観点】
1. **記法改善**: プロジェクトの既存コーディングスタイルとの整合性
2. **パフォーマンス**: 関連するコンポーネントやモジュールを考慮した最適化
3. **設計改善**: プロジェクトアーキテクチャに沿った設計改善

【要求事項】
- ワークスペース全体のコンテキストを活用してください
- 既存のプロジェクト構造やパターンとの整合性を重視してください
- 関連ファイルへの影響も考慮してください

JSON形式で以下の構造で回答してください：
{
  "category": "記法改善|パフォーマンス|設計改善",
  "priority": "high|medium|low",
  "title": "提案タイトル",
  "description": "ワークスペース全体を考慮した詳細説明",
  "codeExample": {
    "before": "改善前のコード",
    "after": "改善後のコード"
  },
  "reasoning": "プロジェクト特有の理由と期待効果",
  "workspaceImpact": "ワークスペースへの影響度と関連ファイル"
}`;
  }

  private async parseStreamingResponse(
    chatResponse: vscode.LanguageModelChatResponse,
    context: WorkspaceEnrichedContext
  ): Promise<Suggestion> {
    let fullResponse = '';

    try {
      for await (const fragment of chatResponse.text) {
        fullResponse += fragment;
      }

      // JSON形式のレスポンスをパース
      const parsed = this.extractJsonFromResponse(fullResponse);

      return {
        id: `copilot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: parsed.category || '記法改善',
        priority: parsed.priority || 'medium',
        title: parsed.title || 'Copilot提案',
        description: parsed.description || '',
        codeExample: parsed.codeExample,
        reasoning: parsed.reasoning || '',
        relatedFiles: this.extractRelatedFiles(parsed.workspaceImpact || ''),
        projectImpact: parsed.workspaceImpact,
        agent: 'copilot-chat',
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Failed to parse Copilot response, creating fallback suggestion:', error);

      return {
        id: `copilot-fallback-${Date.now()}`,
        category: 'パフォーマンス',
        priority: 'medium',
        title: 'Copilot提案（解析中）',
        description: 'Copilot Chat APIからの提案を解析中です。',
        reasoning: fullResponse.slice(0, 200) + '...',
        agent: 'copilot-chat',
        timestamp: Date.now()
      };
    }
  }

  private extractJsonFromResponse(response: string): any {
    try {
      // JSON部分を抽出する正規表現
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // JSONが見つからない場合はテキスト形式で解析
      return this.parseTextResponse(response);
    } catch (error) {
      return this.parseTextResponse(response);
    }
  }

  private parseTextResponse(response: string): any {
    // テキスト形式のレスポンスから情報を抽出
    const lines = response.split('\\n');

    return {
      category: this.extractCategory(response),
      priority: this.extractPriority(response),
      title: this.extractTitle(response),
      description: response.slice(0, 300),
      reasoning: 'Copilot Chat APIからのテキスト形式レスポンス',
      workspaceImpact: 'テキスト解析による推定'
    };
  }

  private extractCategory(text: string): string {
    if (text.includes('パフォーマンス') || text.includes('performance')) {
      return 'パフォーマンス';
    }
    if (text.includes('設計') || text.includes('design') || text.includes('architecture')) {
      return '設計改善';
    }
    return '記法改善';
  }

  private extractPriority(text: string): string {
    if (text.includes('重要') || text.includes('critical') || text.includes('high')) {
      return 'high';
    }
    if (text.includes('低') || text.includes('low') || text.includes('minor')) {
      return 'low';
    }
    return 'medium';
  }

  private extractTitle(text: string): string {
    const lines = text.split('\\n');
    for (const line of lines) {
      if (line.trim().length > 10 && line.trim().length < 100) {
        return line.trim();
      }
    }
    return 'Copilot提案';
  }

  private extractRelatedFiles(workspaceImpact: string): string[] {
    const filePattern = /([\\w\\-\\/]+\\.[a-zA-Z]+)/g;
    const matches = workspaceImpact.match(filePattern);
    return matches ? matches.slice(0, 5) : [];
  }
}