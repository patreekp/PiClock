import { create } from 'zustand';

interface Todo {
  id: number;
  text: string;
  done: number;
}

interface TodoState {
  todos: Todo[];
  fetchTodos: () => Promise<void>;
  addTodo: (text: string) => Promise<void>;
  toggleTodo: (id: number, text: string, done: boolean) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  fetchTodos: async () => {
    const res = await fetch('/api/todos');
    const data = await res.json();
    set({ todos: data });
  },
  addTodo: async (text) => {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const newTodo = await res.json();
    set({ todos: [newTodo, ...get().todos] });
  },
  toggleTodo: async (id, text, done) => {
    await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, done: !done }),
    });
    set({
      todos: get().todos.map(t => t.id === id ? { ...t, done: done ? 0 : 1 } : t)
    });
  },
  deleteTodo: async (id) => {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    set({ todos: get().todos.filter(t => t.id !== id) });
  }
}));
