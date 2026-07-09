import { useState, useEffect } from 'react';
import { ClusterMap } from './components/ClusterMap';
import { ControlPanel } from './components/ControlPanel';
import type { ServerInfo, ActiveTool, NodeStatus } from './types';
import { Terminal, ShieldCheck, RefreshCw } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

// Define a safe boilerplate system baseline map to render during initial boot latency
const INITIAL_SERVERS: ServerInfo[] = [
  { name: 'db-shard0-master', role: 'master', shard: 0, status: 'running', health: 100, port: 5430 },
  { name: 'db-shard0-slave', role: 'slave', shard: 0, status: 'running', health: 100, port: 5431 },
  { name: 'db-shard1-master', role: 'master', shard: 1, status: 'running', health: 100, port: 5432 },
  { name: 'db-shard1-slave', role: 'slave', shard: 1, status: 'running', health: 100, port: 5433 },
];

export default function App() {
  const [servers, setServers] = useState<ServerInfo[]>(INITIAL_SERVERS);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [logs, setLogs] = useState<string[]>(['[SYSTEM INITIALIZED] Standing by for telemetry input streams...']);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 14)]);
  };

  // Telemetry Loop: Polls Nginx Gateway to refresh live Docker container state signatures
  const fetchClusterStatus = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/chaos/status`);
      if (res.data && res.data.status === 'success') {
        const liveStates = res.data.cluster_state;
        
        setServers((prevServers) =>
          prevServers.map((server) => {
            const dockerStatus: NodeStatus = liveStates[server.name] || 'offline';
            return {
              ...server,
              status: dockerStatus,
              health: dockerStatus === 'running' ? 100 : 0,
            };
          })
        );
      }
    } catch (err) {
      console.error('Telemetry stream network interrupt:', err);
    }
  };

  useEffect(() => {
    fetchClusterStatus();
    const heartbeat = setInterval(fetchClusterStatus, 2500);
    return () => clearInterval(heartbeat);
  }, []);

  // Action: Equip Hammer and crash a node via FastAPI Docker proxy socket paths
  const handleKillNode = async (containerName: string) => {
    addLog(`[HAMMER SMACK] Detonating cluster payload target: ${containerName}`);
    try {
      const res = await axios.post(`${BACKEND_URL}/chaos/kill/${containerName}`);
      addLog(`[BACKEND RESPONSE] ${res.data.message}`);
      await fetchClusterStatus();
    } catch (err: any) {
      addLog(`[CRITICAL ERROR] Failed to deliver structural impact to ${containerName}: ${err.message}`);
    }
  };

  // Action: Equip Wrench and revive a node after synchronization bar completes loading
  const handleReviveNode = async (containerName: string) => {
    addLog(`[WRENCH REVIVE] Dispatching startup pulse sequence to: ${containerName}`);
    try {
      const res = await axios.post(`${BACKEND_URL}/chaos/revive/${containerName}`);
      addLog(`[BACKEND RESPONSE] ${res.data.message}`);
      await fetchClusterStatus();
    } catch (err: any) {
      addLog(`[CRITICAL ERROR] Failed to restore service to container ${containerName}: ${err.message}`);
    }
  };

  // Action: Submit a Task payload data form string directly to our smart router pools
  const handleAddTask = async (taskId: number, title: string) => {
    addLog(`[QUERY SUBMIT] Writing task entry ${taskId} ("${title}"). Calculating shard hash topology...`);
    try {
      const res = await axios.post(`${BACKEND_URL}/tasks?task_id=${taskId}&title=${encodeURIComponent(title)}`);
      addLog(`[TRANSACTION COMPLETED] Shard Assigned: ${res.data.targeted_node.toUpperCase()} (Node: ${res.data.handled_by})`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message;
      addLog(`[TRANSACTION ROLLBACK] Query rejected: ${errorMsg}`);
    }
  };

  return (
    <div className="min-h-screen w-screen p-4 sm:p-8 flex flex-col gap-6 max-w-7xl mx-auto selection:bg-slate-700/50">
      
      {/* GLOBAL HUD DISPLAY HEADER */}
      <header className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <ShieldCheck size={28} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-slate-100 uppercase">
              Chaos Engine Sandbox
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Topology: Application-Level Sharding & Replication Controller
            </p>
          </div>
        </div>
        
        {/* Active Tool HUD status indicator layout */}
        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Weapon:</span>
          <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
            activeTool === 'select' ? 'text-slate-300 bg-slate-800' :
            activeTool === 'hammer' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
            'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20'
          }`}>
            {activeTool}
          </span>
          <button 
            onClick={fetchClusterStatus} 
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            title="Force telemetry sync fetch"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* INTERACTIVE CONTROLLER ARSENAL PANEL */}
      <ControlPanel
        activeTool={activeTool}
        onChangeTool={setActiveTool}
        onAddTask={handleAddTask}
      />

      {/* MAP GRID CANVAS GRID COMPONENT */}
      <ClusterMap
        servers={servers}
        activeTool={activeTool}
        onKillNode={handleKillNode}
        onReviveNode={handleReviveNode}
      />

      {/* SCIFI ARCADE REAL-TIME TELEMETRY LOG BLOCK */}
      <section className="w-full bg-slate-950 rounded-3xl border border-slate-800 p-5 font-mono flex flex-col gap-3 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 border-b border-slate-900 pb-2">
          <Terminal size={14} className="text-indigo-400" />
          <span>REAL-TIME SANDBOX LOG STREAM</span>
        </div>
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto text-xs text-slate-400 scrollbar-thin scrollbar-thumb-slate-800">
          {logs.map((log, index) => (
            <div 
              key={index} 
              className={`leading-relaxed whitespace-pre-wrap transition-opacity duration-300 ${
                index === 0 ? 'text-indigo-300 font-bold' : 'opacity-50'
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}