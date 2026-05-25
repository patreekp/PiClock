import React, { useState, useEffect } from 'react';
import { useTodoStore } from './useTodoStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from 'lucide-react';
import { ThemedButton } from '@/components/ui-themed';

const TodosPage = () => {
  const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo } = useTodoStore();
  const { t } = useTranslation();
  const [newTodo, setNewTodo] = useState('');
  useEffect(() => { fetchTodos(); }, []);
  const handleAdd = () => { if (!newTodo.trim()) return; addTodo(newTodo); setNewTodo(''); };
  return (
    <div className="h-full p-8 flex flex-col select-none">
      <h2 className="text-4xl font-bold mb-8 uppercase tracking-tighter">{t('todos.title')}</h2>
      <div className="flex gap-2 mb-8">
        <Input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder={t('todos.placeholder')}
          className="bg-transparent border-current rounded-none h-14 text-xl placeholder:opacity-30"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <ThemedButton onClick={handleAdd} className="h-14 w-14 p-0 text-xl"><Plus size={28} /></ThemedButton>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {todos.length === 0 && (
          <div className="h-full flex items-center justify-center opacity-20 mt-[-40px]">
            <p className="text-2xl uppercase tracking-widest italic">{t('todos.empty')}</p>
          </div>
        )}
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center justify-between border-b border-current/10 pb-4 group">
            <div className="flex items-center gap-6 flex-1 py-2 cursor-pointer" onClick={() => toggleTodo(todo.id, todo.text, !!todo.done)}>
              <Checkbox checked={!!todo.done} className="h-8 w-8 border-current rounded-none data-[state=checked]:bg-current data-[state=checked]:text-background" />
              <span className={`text-2xl transition-all ${todo.done ? 'line-through opacity-30' : ''}`}>{todo.text}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }} className="opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity p-2">
              <Trash2 size={24} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
export default TodosPage;