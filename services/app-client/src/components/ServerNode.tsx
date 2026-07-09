import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hammer, Wrench, Database, ShieldAlert } from 'lucide-react';
import type { ServerInfo, ActiveTool, ExplosionParticle } from '../types.ts';

interface ServerNodeProps {
  server: ServerInfo;
  activeTool: ActiveTool;
  onKill: (name: string) => void;
  onRevive: (name: string) => void;
}

export const ServerNode: React.FC<ServerNodeProps> = ({
  server,
  activeTool,
  onKill,
  onRevive,
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [particles, setParticles] = useState<ExplosionParticle[]>([]);
  const [isReviving, setIsReviving] = useState(false);
  const [reviveProgress, setReviveProgress] = useState(0);

  const isAlive = server.status === 'running';

  // Trigger particle explosion layout
  const triggerExplosion = () => {
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 160,
      y: (Math.random() - 0.5) * 160,
    }));
    setParticles(newParticles);
    // Cleanup particles after animation completes
    setTimeout(() => setParticles([]), 800);
  };

  const handleNodeClick = () => {
    if (activeTool === 'hammer' && isAlive) {
      setIsShaking(true);
      triggerExplosion();
      onKill(server.name);
      setTimeout(() => setIsShaking(false), 500);
    } else if (activeTool === 'wrench' && !isAlive && !isReviving) {
      setIsReviving(true);
      setReviveProgress(0);
      
      // Simulate a multi-second health bar fill animation
      const interval = setInterval(() => {
        setReviveProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsReviving(false);
            onRevive(server.name);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }
  };

  return (
    <motion.div
      onClick={handleNodeClick}
      animate={isShaking ? { x: [-5, 5, -5, 5, 0], y: [-3, 3, -3, 3, 0] } : {}}
      transition={{ duration: 0.4 }}
      className={`relative p-5 rounded-2xl border bg-slate-900/90 flex flex-col items-center justify-between cursor-pointer transition-all selection:bg-transparent duration-300 ${
        isAlive 
          ? 'border-emerald-500/40 hover:border-emerald-400 glow-green' 
          : 'border-rose-500/40 hover:border-rose-400 glow-red animate-pulse'
      }`}
    >
      {/* Target Crosshair overlay when wielding tools */}
      {activeTool !== 'select' && isAlive && (
        <div className="absolute inset-0 bg-red-500/5 rounded-2xl border border-dashed border-red-500/20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <Hammer className="text-red-500/30 w-12 h-12 rotate-45" />
        </div>
      )}

      {/* Explosion Particles */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ scale: 1, x: 0, y: 0, opacity: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b] pointer-events-none z-50"
          />
        ))}
      </AnimatePresence>

      {/* Node Meta Badge Header */}
      <div className="w-full flex justify-between items-center mb-3">
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Shard {server.shard}
        </span>
        <span className={`text-[10px] uppercase tracking-wider font-bold ${isAlive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {server.role}
        </span>
      </div>

      {/* Main Server Graphic Icon */}
      <div className="relative my-4">
        <Database className={`w-16 h-16 transition-colors duration-300 ${isAlive ? 'text-emerald-400' : 'text-rose-500'}`} />
        {!isAlive && (
          <ShieldAlert className="absolute -top-2 -right-2 text-rose-400 w-6 h-6 animate-bounce" />
        )}
      </div>

      {/* Title & Network Config */}
      <div className="text-center mb-4">
        <h3 className="font-bold text-sm tracking-wide text-slate-200">{server.name}</h3>
        <p className="text-slate-500 text-[11px]">Port: {server.port}</p>
      </div>

      {/* Interactive Health / Revive Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 p-0.5 overflow-hidden">
        {isReviving ? (
          <div 
            style={{ width: `${reviveProgress}%` }}
            className="h-full bg-cyan-500 rounded-full transition-all duration-200 shadow-[0_0_8px_#06b6d4]"
          />
        ) : (
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: isAlive ? '100%' : '0%' }}
            transition={{ duration: 0.3 }}
            className={`h-full rounded-full ${isAlive ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-600'}`}
          />
        )}
      </div>

      {/* Action Overlay State Hint Text */}
      <div className="mt-2 text-[10px] text-slate-500">
        {!isAlive && !isReviving && activeTool === 'wrench' && (
          <span className="text-cyan-400 flex items-center gap-1"><Wrench size={10} /> Click to Revive</span>
        )}
        {isAlive && activeTool === 'hammer' && (
          <span className="text-amber-500 flex items-center gap-1"><Hammer size={10} /> Click to Destroy</span>
        )}
        {isReviving && <span className="text-cyan-400 animate-pulse">Syncing WAL Logs...</span>}
      </div>
    </motion.div>
  );
};