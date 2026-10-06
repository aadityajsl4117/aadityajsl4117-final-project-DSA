import { LibraryState } from '../types';

const STORAGE_KEY = 'lumina_library_state';

export class StorageService {
  static save(state: LibraryState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving library state:', error);
    }
  }

  static load(): LibraryState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as LibraryState;
      }
    } catch (error) {
      console.error('Error loading library state:', error);
    }
    return null;
  }

  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  static export(): string {
    const state = this.load();
    return JSON.stringify(state, null, 2);
  }

  static import(json: string): LibraryState {
    const state = JSON.parse(json) as LibraryState;
    this.save(state);
    return state;
  }
}
