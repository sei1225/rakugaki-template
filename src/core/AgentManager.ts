import * as vscode from 'vscode';
import { IAgentProvider, AgentInfo, Suggestion, WorkspaceEnrichedContext, CodeContext, RakugakiConfiguration } from '../types';
import { ClaudeChatProvider } from '../providers/ClaudeChatProvider';
import { CopilotChatProvider } from '../providers/CopilotChatProvider';
import { LocalAnalysisProvider } from '../providers/LocalAnalysisProvider';

/**
 * エージェント統合管理システム
 */
export class AgentManager {
  private providers = new Map<string, IAgentProvider>();
  private fallbackProvider: LocalAnalysisProvider;
  private isInitialized = false;

  constructor() {
    this.fallbackProvider = new LocalAnalysisProvider();
  }

  async initialize(): Promise<void> {
    console.log('AgentManager初期化開始...');

    try {
      // フォールバックプロバイダーは常に初期化
      await this.fallbackProvider.initialize();

      // Claude Chat Extension プロバイダー
      await this.initializeClaudeProvider();

      // Copilot Chat API プロバイダー
      await this.initializeCopilotProvider();

      this.isInitialized = true;
      console.log(`AgentManager初期化完了: ${this.providers.size}個のプロバイダー利用可能`);
    } catch (error) {
      console.error('AgentManager initialization failed:', error);
      throw error;
    }
  }

  private async initializeClaudeProvider(): Promise<void> {
    try {
      const claudeProvider = new ClaudeChatProvider();
      if (await claudeProvider.isAvailable()) {
        await claudeProvider.initialize();
        this.providers.set('claude-chat', claudeProvider);
        console.log('Claude Chat Provider 初期化完了');
      } else {
        console.log('Claude Chat Extension 利用不可');
      }
    } catch (error) {
      console.warn('Claude Chat Provider 初期化失敗:', error);
    }
  }

  private async initializeCopilotProvider(): Promise<void> {
    try {
      const copilotProvider = new CopilotChatProvider();
      if (await copilotProvider.isAvailable()) {
        await copilotProvider.initialize();
        this.providers.set('copilot-chat', copilotProvider);
        console.log('Copilot Chat Provider 初期化完了');
      } else {
        console.log('Copilot Chat API 利用不可');
      }
    } catch (error) {
      console.warn('Copilot Chat Provider 初期化失敗:', error);
    }
  }

  /**
   * 利用可能なエージェント情報を取得
   */
  getAvailableAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];

    // 各プロバイダーの情報を取得
    for (const provider of this.providers.values()) {
      agents.push(provider.getAgentInfo());
    }

    // フォールバックプロバイダーの情報も追加
    agents.push(this.fallbackProvider.getAgentInfo());

    return agents;
  }

  /**
   * 指定されたエージェントが利用可能かチェック
   */
  async isAgentAvailable(agentType: string): Promise<boolean> {
    const provider = this.providers.get(agentType);
    if (provider) {
      return await provider.isAvailable();
    }
    return agentType === 'local-analysis'; // フォールバックは常に利用可能
  }

  /**
   * 提案生成の実行
   */
  async generateSuggestions(context: WorkspaceEnrichedContext): Promise<Suggestion[]> {
    if (!this.isInitialized) {
      throw new Error('AgentManager not initialized');
    }

    const config = this.getConfiguration();
    const suggestions: Suggestion[] = [];

    try {
      // 優先エージェントの決定
      const primaryAgent = this.selectPrimaryAgent(config.primaryAgent);

      if (primaryAgent) {
        console.log(`Primary agent: ${primaryAgent}`);
        const suggestion = await this.generateSingleSuggestion(primaryAgent, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // 複数エージェントによる並列生成（設定に応じて）
      if (config.analysisDepth === 'deep') {
        const parallelSuggestions = await this.generateParallelSuggestions(context);
        suggestions.push(...parallelSuggestions);
      }

      // フォールバック処理
      if (suggestions.length === 0) {
        console.log('全エージェント失敗、フォールバックを実行');
        const fallbackSuggestion = await this.fallbackProvider.generateSuggestion(context);
        suggestions.push(fallbackSuggestion);
      }

      return this.deduplicateAndSort(suggestions);

    } catch (error) {
      console.error('Suggestion generation failed:', error);

      // 緊急フォールバック
      const fallbackSuggestion = await this.fallbackProvider.generateSuggestion(context);
      return [fallbackSuggestion];
    }
  }

  private selectPrimaryAgent(primaryAgentConfig: string): string | null {
    if (primaryAgentConfig === 'auto') {
      // 自動選択：利用可能な順番で選択
      const priority = ['claude-chat', 'copilot-chat'];
      for (const agent of priority) {
        if (this.providers.has(agent)) {
          return agent;
        }
      }
      return null;
    }

    // 指定されたエージェントが利用可能かチェック
    if (this.providers.has(primaryAgentConfig)) {
      return primaryAgentConfig;
    }

    return null;
  }

  private async generateSingleSuggestion(agentType: string, context: WorkspaceEnrichedContext): Promise<Suggestion | null> {
    try {
      const provider = this.providers.get(agentType);
      if (!provider) {
        return null;
      }

      return await provider.generateSuggestion(context);
    } catch (error) {
      console.warn(`Agent ${agentType} failed:`, error);
      return null;
    }
  }

  private async generateParallelSuggestions(context: WorkspaceEnrichedContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // 並列でエージェント実行
    const promises = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const suggestion = await provider.generateSuggestion(context);
          return { name, suggestion };
        } catch (error) {
          console.warn(`Parallel agent ${name} failed:`, error);
          return null;
        }
      }
    );

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        suggestions.push(result.value.suggestion);
      }
    });

    return suggestions;
  }

  private deduplicateAndSort(suggestions: Suggestion[]): Suggestion[] {
    // 重複除去（タイトルベース）
    const uniqueSuggestions = suggestions.filter((suggestion, index, array) =>
      array.findIndex(s => s.title === suggestion.title) === index
    );

    // 優先度とタイムスタンプでソート
    return uniqueSuggestions.sort((a, b) => {
      const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.timestamp - a.timestamp; // 新しいものを優先
    });
  }

  private getConfiguration(): RakugakiConfiguration {
    const config = vscode.workspace.getConfiguration('rakugaki');

    return {
      enabledCategories: config.get('enabledCategories', ['記法改善', 'パフォーマンス', '設計改善']),
      primaryAgent: config.get('primaryAgent', 'auto'),
      analysisDepth: config.get('analysisDepth', 'normal'),
      suggestionDelay: config.get('suggestionDelay', 500),
      enablePatternLearning: config.get('enablePatternLearning', true)
    };
  }

  /**
   * エージェント接続状況の更新
   */
  async refreshAgentConnections(): Promise<void> {
    console.log('エージェント接続状況を更新中...');

    // 既存のプロバイダーをクリア
    this.providers.clear();

    // 再初期化
    await this.initializeClaudeProvider();
    await this.initializeCopilotProvider();

    console.log(`エージェント接続更新完了: ${this.providers.size}個のプロバイダー利用可能`);
  }

  /**
   * 特定のエージェントプロバイダーを取得
   */
  getProvider(agentType: string): IAgentProvider | null {
    return this.providers.get(agentType) || null;
  }

  /**
   * フォールバックプロバイダーを取得
   */
  getFallbackProvider(): LocalAnalysisProvider {
    return this.fallbackProvider;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.providers.clear();
    this.isInitialized = false;
    console.log('AgentManager disposed');
  }
}