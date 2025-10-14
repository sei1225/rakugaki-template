export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  agent: string;
  reasoning?: string;
  codeExample?: {
    before: string;
    after: string;
  };
  sourceLocation?: {
    filePath: string;
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    originalText: string;
  };
}

export interface DiscussionMessage {
  type: 'user' | 'agent';
  sender: string;
  content: string;
  timestamp: string;
}

export interface VSCodeMessage {
  command: string;
  [key: string]: any;
}
