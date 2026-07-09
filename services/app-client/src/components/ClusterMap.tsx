import React from 'react';
import { ServerNode } from './ServerNode';
import type { ServerInfo, ActiveTool } from '../types';
import { Layers } from 'lucide-react';

interface ClusterMapProps {
  servers: ServerInfo[];
  activeTool: ActiveTool;
  onKillNode: (name: string) => void;
  onReviveNode: (name: string) => void;
}

export const ClusterMap: React.FC<ClusterMapProps> = ({
  servers,
  activeTool,
  onKillNode,
  onReviveNode,
}) => {
  // Separate our cluster array into distinct shard zones logically
  const shard0Nodes = servers.filter((s) => s.shard === 0);
  const shard1Nodes = servers.filter((s) => s.shard === 1);

  return (
    <div className="w-full flex flex-col gap-6 p-6 bg-slate-950/40 rounded-3xl border border-slate-800/60 backdrop-blur-sm">
      
      {/* Infrastructure Map Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Layers size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-wide text-slate-200">Distributed Cluster Topology</h2>
          <p className="text-xs text-slate-500">Mathematical Modulo Sharding {"($\\text{task_id} \\pmod 2$)"} + Continuous Primary-Secondary WAL Streaming</p>
        </div>
      </div>

      {/* Shard Partition Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        
        {/* Decorative central partition divider line mimicking a gaming map boundary */}
        <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-slate-800 to-transparent transform -translate-x-1/2 pointer-events-none" />

        {/* ================= SHARD 0 ZONE ================= */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Shard Partition 0
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Handles Even IDs (0, 2, 4...)</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
            {shard0Nodes.map((server) => (
              <ServerNode
                key={server.name}
                server={server}
                activeTool={activeTool}
                onKill={onKillNode}
                onRevive={onReviveNode}
              />
            ))}
          </div>
        </div>

        {/* ================= SHARD 1 ZONE ================= */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-400/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              Shard Partition 1
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Handles Odd IDs (1, 3, 5...)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
            {shard1Nodes.map((server) => (
              <ServerNode
                key={server.name}
                server={server}
                activeTool={activeTool}
                onKill={onKillNode}
                onRevive={onReviveNode}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};