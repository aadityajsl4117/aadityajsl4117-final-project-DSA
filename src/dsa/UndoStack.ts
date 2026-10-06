import { UndoAction } from '../types';

export class UndoStack {
  private stack: UndoAction[] = [];
  
  push(action: UndoAction): void {
    this.stack.push(action);
  }

  pop(): UndoAction | null {
    return this.stack.pop() || null;
  }

  peek(): UndoAction | null {
    if (this.isEmpty()) return null;
    return this.stack[this.stack.length - 1];
  }

  get size(): number {
    return this.stack.length;
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  clear(): void {
    this.stack = [];
  }

  toArray(): UndoAction[] {
    return [...this.stack].reverse();
  }
}
