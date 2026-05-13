import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from 'lucide-react';

const TodosPage = () => {
  const [todos, setTodos] = useState<{id: number, text: string, done: boolean}[]>([]);
  const [newTodo, setNewTodo] = useState('');

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo, done: false }]);
    setNewTodo('');
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="h-full p-8 flex flex-col">
      <h2 className="text-4xl font-bold mb-8 uppercase tracking-tighter">Cose da fare</h2>
      
      <div className="flex gap-2 mb-8">
        <Input 
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Aggiungi un compito..."
          className="bg-transparent border-current rounded-none h-12 text-lg"
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
        />
        <Button onClick={addTodo} variant="outline" className="h-12 w-12 p-0 border-current rounded-none">
          <Plus size={24} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {todos.length === 0 && (
          <p className="text-center opacity-40 mt-12 italic">Nessun impegno per oggi.</p>
        )}
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center justify-between border-b border-current/20 pb-4">
            <div className="flex items-center gap-4 flex-1" onClick={() => toggleTodo(todo.id)}>
              <Checkbox checked={todo.done} className="h-6 w-6 border-current" />
              <span className={`text-xl ${todo.done ? 'line-through opacity-40' : ''}`}>
                {todo.text}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => deleteTodo(todo.id)}
              className="opacity-40 hover:opacity-100"
            >
              <Trash2 size={20} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodosPage;