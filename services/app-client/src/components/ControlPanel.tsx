import React, { useState } from 'react';
import { MousePointer, Hammer, Wrench, PlusCircle } from 'lucide-react';
import type { ActiveTool } from '../types';

interface ControlPanelProps {
  activeTool: ActiveTool;
  onChangeTool: (tool: ActiveTool) => void;
  onAddTask: (taskId: number, title: string) => Promise<void>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  activeTool,
  onChangeTool,
  onAddTask,
}) => {
  const [inputTaskId, setInputTaskId] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(inputTaskId);
    if (isNaN(id) || !inputTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddTask(id, inputTitle);
      setInputTaskId('');
      setInputTitle('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/60 p-5 rounded-3xl border border-slate-800 backdrop-blur-md">
      
      {/* TOOL ARSENAL SELECTION BLOCK */}
      <div className="lg:col-span-5 flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest font-bold text-slate-500 font-mono">
          Equip Chaos Arsenal
        </label>
        <div className="grid grid-cols-3 gap-3 h-full items-center">
          
          <button
            onClick={() => onChangeTool('select')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
              activeTool === 'select'
                ? 'bg-slate-700 border-slate-500 text-white shadow-inner'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <MousePointer size={16} />
            Inspect
          </button>

          <button
            onClick={() => onChangeTool('hammer')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
              activeTool === 'hammer'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-amber-500 hover:bg-slate-800'
            }`}
          >
            <Hammer size={16} />
            Hammer
          </button>

          <button
            onClick={() => onChangeTool('wrench')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
              activeTool === 'wrench'
                ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
            }`}
          >
            <Wrench size={16} />
            Revive
          </button>

        </div>
      </div>

      {/* REPLICATED TRANSACTION TRANSMITTER FORM */}
      <div className="lg:col-span-7 flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest font-bold text-slate-500 font-mono">
          Execute Sharded Write Transaction
        </label>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end h-full">
          
          <div className="flex-1 w-full flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-mono">TASK_ID (Shard Key)</span>
            <input
              type="number"
              value={inputTaskId}
              onChange={(e) => setInputTaskId(e.target.value)}
              placeholder="e.g., 42"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
              required
            />
          </div>

          <div className="flex-[2] w-full flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-mono">TASK TITLE (Data String)</span>
            <input
              type="text"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              placeholder="Deploy code to production..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/20 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap h-[42px]"
          >
            <PlusCircle size={16} />
            Submit Query
          </button>

        </form>
      </div>

    </div>
  );
};