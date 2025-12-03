export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  priority: Priority;
  createdAt: number;
  subtasks?: Task[]; // Support for hierarchy
}

export enum Sender {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system' // For tool execution logs
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  isToolLog?: boolean; // If true, display differently (e.g., "Added task: Buy Milk")
}

// Helper to generate IDs
export const generateId = (): string => Math.random().toString(36).substring(2, 9);