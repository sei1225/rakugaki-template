/**
 * 基本的な型定義とインターフェース
 */

import * as vscode from 'vscode';

// 提案カテゴリ
export type SuggestionCategory = '記法改善' | 'パフォーマンス' | '設計改善';

// 提案優先度
export type SuggestionPriority = 'high' | 'medium' | 'low';

// エージェント種別
export type AgentType = 'claude-chat' | 'copilot-chat' | 'local-analysis';

// コードコンテキスト
export interface CodeContext {
  document: vscode.TextDocument;
  fileName: string;
  language: string;
  code: string;
  changeText?: string;
  changeRange?: vscode.Range;
  timestamp: number;
}

// ワークスペース豊富化コンテキスト
export interface WorkspaceEnrichedContext extends CodeContext {
  relatedFiles: string[];
  projectStructure: ProjectStructure;
  dependencies: string[];
  codePatterns: CodePattern[];
  designPrinciples: string[];
}

// プロジェクト構造情報
export interface ProjectStructure {
  type: 'typescript' | 'javascript' | 'react' | 'vue' | 'node' | 'unknown';
  rootPath: string;
  configFiles: string[];
  srcDirs: string[];
  testDirs: string[];
}

// コードパターン
export interface CodePattern {
  pattern: string;
  description: string;
  frequency: number;
}

// 提案情報
export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  codeExample?: {
    before: string;
    after: string;
  };
  reasoning: string;
  relatedFiles?: string[];
  projectImpact?: string;
  agent: AgentType;
  timestamp: number;

  // 位置情報
  sourceLocation?: {
    filePath: string;
    startLine: number;
    endLine: number;
    startCharacter: number;
    endCharacter: number;
    originalText: string; // 提案生成時の元テキスト
  };
}

// エージェント情報
export interface AgentInfo {
  type: AgentType;
  name: string;
  version?: string;
  isAvailable: boolean;
  capabilities: string[];
}

// エージェントプロバイダーインターフェース
export interface IAgentProvider {
  getAgentInfo(): AgentInfo;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  generateSuggestion(context: WorkspaceEnrichedContext): Promise<Suggestion>;
}

// 設定インターフェース
export interface RakugakiConfiguration {
  enabledCategories: SuggestionCategory[];
  primaryAgent: AgentType | 'auto';
  analysisDepth: 'light' | 'normal' | 'deep';
  suggestionDelay: number;
  enablePatternLearning: boolean;
}