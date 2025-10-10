import * as vscode from 'vscode';
import { IAgentProvider, AgentInfo, Suggestion, WorkspaceEnrichedContext, SuggestionCategory } from '../types';

/**
 * ローカル分析フォールバックプロバイダー
 * AIエージェントが利用できない場合のフォールバック機能
 */
export class LocalAnalysisProvider implements IAgentProvider {
  private isInitialized = false;

  getAgentInfo(): AgentInfo {
    return {
      type: 'local-analysis',
      name: 'ローカル分析エンジン',
      version: '1.0.0',
      isAvailable: this.isInitialized,
      capabilities: [
        'ルールベース分析',
        'パターンマッチング',
        'オフライン動作',
        '即座の応答',
        'プライバシー保護'
      ]
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // ローカル分析は常に利用可能
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    console.log('ローカル分析エンジン初期化完了');
  }

  async generateSuggestion(context: WorkspaceEnrichedContext): Promise<Suggestion> {
    if (!this.isInitialized) {
      throw new Error('Local analysis provider not initialized');
    }

    try {
      // 複数の分析手法から最も適切な提案を選択
      const suggestions = [
        this.analyzeCodeSyntax(context),
        this.analyzePerformance(context),
        this.analyzeDesignPatterns(context)
      ].filter((suggestion): suggestion is Suggestion => suggestion !== null);

      // 提案がある場合は最も優先度の高い提案を返す
      if (suggestions.length > 0) {
        return suggestions.reduce((best, current) =>
          this.comparePriority(current.priority, best.priority) > 0 ? current : best
        );
      }

      // 提案がない場合はフォールバック提案を返す
      return this.createFallbackSuggestion(context);

    } catch (error) {
      console.error('Local analysis failed:', error);
      return this.createFallbackSuggestion(context);
    }
  }

  private analyzeCodeSyntax(context: WorkspaceEnrichedContext): Suggestion | null {
    const code = context.changeText || context.code;

    // TypeScript/JavaScript固有の分析
    if (context.language === 'typescript' || context.language === 'javascript') {
      // var -> const/let の提案
      if (code.includes('var ')) {
        return {
          id: `local-syntax-${Date.now()}`,
          category: '記法改善',
          priority: 'high',
          title: 'var を const/let に変更',
          description: 'ES6+ の const または let を使用することで、スコープが明確になり、意図しない再代入を防げます。',
          codeExample: {
            before: code.split('\\n').find(line => line.includes('var ')) || 'var example = value;',
            after: code.split('\\n').find(line => line.includes('var '))?.replace('var ', 'const ') || 'const example = value;'
          },
          reasoning: 'ES6+の記法により、変数のスコープが明確になり、バグの発生を抑制できます。',
          agent: 'local-analysis',
          timestamp: Date.now()
        };
      }

      // == -> === の提案
      if (code.includes('==') && !code.includes('===')) {
        return {
          id: `local-syntax-equality-${Date.now()}`,
          category: '記法改善',
          priority: 'medium',
          title: '厳密等価演算子（===）の使用',
          description: '型変換を伴わない厳密等価演算子を使用することで、予期しない型変換によるバグを防げます。',
          reasoning: '厳密等価演算子により、型安全性が向上し、予期しない動作を防げます。',
          agent: 'local-analysis',
          timestamp: Date.now()
        };
      }
    }

    return null;
  }

  private analyzePerformance(context: WorkspaceEnrichedContext): Suggestion | null {
    const code = context.changeText || context.code;

    // console.log の本番環境への残存チェック
    if (code.includes('console.log') || code.includes('console.debug')) {
      return {
        id: `local-perf-console-${Date.now()}`,
        category: 'パフォーマンス',
        priority: 'medium',
        title: 'console.log の削除または条件付き実行',
        description: '本番環境でのconsole.logは性能に影響を与える可能性があります。開発環境でのみ実行するか、削除を検討してください。',
        codeExample: {
          before: 'console.log("debug info");',
          after: 'if (process.env.NODE_ENV === "development") {\\n  console.log("debug info");\\n}'
        },
        reasoning: '本番環境でのログ出力は性能に影響し、セキュリティリスクにもなる可能性があります。',
        agent: 'local-analysis',
        timestamp: Date.now()
      };
    }

    // React/Vue特有の分析
    if (context.language === 'typescriptreact' || context.language === 'javascriptreact') {
      if (code.includes('useEffect') && !code.includes('[]')) {
        return {
          id: `local-perf-useeffect-${Date.now()}`,
          category: 'パフォーマンス',
          priority: 'high',
          title: 'useEffect の依存配列を確認',
          description: 'useEffectの依存配列が適切に設定されていない可能性があります。無限ループや不要な再実行を防ぐため、依存配列を確認してください。',
          reasoning: '適切な依存配列により、不要な副作用の実行を防ぎ、性能を向上させることができます。',
          agent: 'local-analysis',
          timestamp: Date.now()
        };
      }
    }

    return null;
  }

  private analyzeDesignPatterns(context: WorkspaceEnrichedContext): Suggestion | null {
    const code = context.changeText || context.code;

    // 長い関数の検出
    const lines = code.split('\\n');
    if (lines.length > 50) {
      return {
        id: `local-design-function-length-${Date.now()}`,
        category: '設計改善',
        priority: 'medium',
        title: '関数の分割を検討',
        description: `この関数は${lines.length}行あります。単一責任の原則に従い、より小さな関数に分割することを検討してください。`,
        reasoning: '関数を小さく保つことで、テストしやすく、理解しやすく、保守しやすいコードになります。',
        agent: 'local-analysis',
        timestamp: Date.now()
      };
    }

    // ネストの深さチェック
    const maxNest = this.calculateMaxNesting(code);
    if (maxNest > 4) {
      return {
        id: `local-design-nesting-${Date.now()}`,
        category: '設計改善',
        priority: 'medium',
        title: '条件分岐のネストを減らす',
        description: `ネストが${maxNest}層と深くなっています。早期リターンやガード句を使用してネストを減らすことを検討してください。`,
        reasoning: 'ネストを浅くすることで、コードの可読性と保守性が向上します。',
        agent: 'local-analysis',
        timestamp: Date.now()
      };
    }

    return null;
  }

  private calculateMaxNesting(code: string): number {
    let maxNest = 0;
    let currentNest = 0;

    for (const char of code) {
      if (char === '{') {
        currentNest++;
        maxNest = Math.max(maxNest, currentNest);
      } else if (char === '}') {
        currentNest--;
      }
    }

    return maxNest;
  }

  private comparePriority(priority1: string, priority2: string): number {
    const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
    return (priorityMap[priority1 as keyof typeof priorityMap] || 0) -
           (priorityMap[priority2 as keyof typeof priorityMap] || 0);
  }

  private createFallbackSuggestion(context: WorkspaceEnrichedContext): Suggestion {
    return {
      id: `local-fallback-${Date.now()}`,
      category: '記法改善',
      priority: 'low',
      title: 'コード品質チェック実行中',
      description: 'ローカル分析エンジンによるコード品質チェックを実行しました。具体的な改善提案は見つかりませんでした。',
      reasoning: 'AIエージェントが利用できない場合のフォールバック分析を実行',
      agent: 'local-analysis',
      timestamp: Date.now()
    };
  }
}