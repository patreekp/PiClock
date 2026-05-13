import React, { useState, useEffect } from 'react';
import { useTodoStore } from './useTodoStore';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from 'lucide-react';

const TodosPage = () => {
  const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo } = useTodoStore();
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleAdd = () => {
    if (!newTodo.trim()) return;
    addTodo(newTodo);
    setNewTodo('');
  };

  return (
    <div className="h-full p-8 flex flex-col select-none">
      <h2 className="text-4xl font-bold mb-8 uppercase tracking-tighter">Cose da fare</h2>
      
      <div className="flex gap-2 mb-8">
        <Input 
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Aggiungi un compito..."
          className="bg-transparent border-current rounded-none h-14 text-xl placeholder:opacity-30"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} variant="outline" className="h-14 w-14 p-0 border-current rounded-none hover:bg-current hover:text-background transition-colors">
          <Plus size={28} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {todos.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 mt-[-40px]">
            <p className="text-2xl uppercase tracking-widest italic">Nessun impegno</p>
          </div>
        )}
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center justify-between border-b border-current/10 pb-4 group">
            <div className="flex items-center gap-6 flex-1 py-2" onClick={() => toggleTodo(todo.id, todo.text, !!todo.done)}>
              <Checkbox checked={!!todo.done} className="h-8 w-8 border-current rounded-none data-[state=checked]:bg-current data-[state=checked]:text-background" />
              <span className={`text-2xl transition-all ${todo.done ? 'line-through opacity-30' : ''}`}>
                {todo.text}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                deleteTodo(todo.id);
              }}
              className="opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
            >
              <Trash2 size={24} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodosPage;
