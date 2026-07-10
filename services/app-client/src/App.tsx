import { useState, useEffect } from 'react';
import type { InfraNode, PipelineConnection, ActiveTool, NodeStatus, PacketTrace } from './types';
import { PipelineCanvas } from './components/PipelineCanvas';
import axios from 'axios';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/* ====================================================================
   Infrastructure topology definition.
   Positions (x, y) are in SVG viewBox coords (760×520).
   The layout flows:  User → LB → App Servers → Redis / Sharded DBs
   ==================================================================== */

const INITIAL_NODES: InfraNode[] = [
  { id: 'lb', name: 'nginx-lb', label: 'LOAD BALANCER', type: 'load-balancer', status: 'running', health: 100, port: 8000, x: 100, y: 120 },
  { id: 'app1', name: 'fastapi-app-server-1', label: 'APP SERVER 1', type: 'app-server', status: 'running', health: 100, port: 8001, x: 280, y: 70 },
  { id: 'app2', name: 'fastapi-app-server-2', label: 'APP SERVER 2', type: 'app-server', status: 'running', health: 100, port: 8002, x: 280, y: 170 },
  { id: 'redis', name: 'redis-cache', label: 'REDIS CACHE', type: 'cache', status: 'running', health: 100, port: 6379, x: 460, y: 120 },
  { id: 's0m', name: 'db-shard0-master', label: 'SHARD 0 MASTER', type: 'database', role: 'master', shard: 0, status: 'running', health: 100, port: 5430, x: 340, y: 310 },
  { id: 's0s', name: 'db-shard0-slave', label: 'SHARD 0 SLAVE', type: 'database', role: 'slave', shard: 0, status: 'running', health: 100, port: 5431, x: 340, y: 420 },
  { id: 's1m', name: 'db-shard1-master', label: 'SHARD 1 MASTER', type: 'database', role: 'master', shard: 1, status: 'running', health: 100, port: 5432, x: 600, y: 310 },
  { id: 's1s', name: 'db-shard1-slave', label: 'SHARD 1 SLAVE', type: 'database', role: 'slave', shard: 1, status: 'running', health: 100, port: 5433, x: 600, y: 420 },
];

const CONNECTIONS: PipelineConnection[] = [
  { from: 'lb', to: 'app1', type: 'request' },
  { from: 'lb', to: 'app2', type: 'request' },
  { from: 'app1', to: 'redis', type: 'cache' },
  { from: 'app2', to: 'redis', type: 'cache' },
  { from: 'app1', to: 's0m', type: 'request' },
  { from: 'app2', to: 's0m', type: 'request' },
  { from: 'app1', to: 's1m', type: 'request' },
  { from: 'app2', to: 's1m', type: 'request' },
  { from: 's0m', to: 's0s', label: 'WAL', type: 'replication' },
  { from: 's1m', to: 's1s', label: 'WAL', type: 'replication' },
];

export default function App() {
  const [nodes, setNodes] = useState<InfraNode[]>(INITIAL_NODES);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [logs, setLogs] = useState<string[]>(['[SYSTEM] CHAOS ENGINE INITIALIZED. STANDING BY...']);
  const [taskName, setTaskName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [traces, setTraces] = useState<PacketTrace[]>([]);
  const [maxId, setMaxId] = useState<number>(0);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [`[${ts}] ${message.toUpperCase()}`, ...prev.slice(0, 30)]);
  };

  // Fallback fetcher allows API requests to bypass a dead LB
  const fetchWithFallback = async (method: 'get' | 'post', path: string) => {
    const urls = [BACKEND_URL, 'http://localhost:8001', 'http://localhost:8002', 'http://localhost:8003'];
    for (const url of urls) {
      try {
        const res = await axios({ method, url: `${url}${path}` });
        return res;
      } catch (err: any) {
        if (err.response && err.response.status !== 502) {
            throw err; // Backend returned a real error, don't retry
        }
      }
    }
    throw new Error('Network Error: All backend nodes unreachable.');
  };

  const fetchClusterStatus = async () => {
    try {
      // Route management requests directly to the secret server for instant response
      const res = await axios.get('http://localhost:8003/chaos/status');
      if (res.data?.status === 'success') {
        const liveStates = res.data.cluster_state;
        setNodes(prev =>
          prev.map(node => {
            const dockerStatus: NodeStatus = liveStates[node.name] || 'offline';
            return {
              ...node,
              status: dockerStatus,
              health: dockerStatus === 'running' ? 100 : 0,
            };
          })
        );
      }
    } catch (err) {
      // Silently fail telemetry
    }
  };

  useEffect(() => {
    fetchClusterStatus();
    const heartbeat = setInterval(fetchClusterStatus, 2000);
    return () => clearInterval(heartbeat);
  }, []);

  const handleKillNode = async (containerName: string) => {
    addLog(`💥 DESTROYING ${containerName}...`);
    try {
      const res = await axios.post(`http://localhost:8003/chaos/kill/${containerName}`);
      addLog(`✓ ${res.data.message}`, 'success');
      await fetchClusterStatus();
    } catch (err: any) {
      addLog(`✗ Failed: ${err.message}`, 'error');
    }
  };

  const handleReviveNode = async (containerName: string) => {
    addLog(`🔧 REVIVING ${containerName}...`);
    try {
      const res = await axios.post(`http://localhost:8003/chaos/revive/${containerName}`);
      addLog(`✓ ${res.data.message}`, 'success');
      // We don't force status refresh here because PipelineCanvas will wait for telemetry
    } catch (err: any) {
      addLog(`✗ Failed: ${err.message}`, 'error');
    }
  };

  const handleInspectNode = async (containerName: string, status: string) => {
    addLog(`🔍 INSPECTED ${containerName}: STATUS IS ${status}`, 'info');
    if (status !== 'ONLINE') return;
    
    try {
      if (containerName.includes('redis')) {
        const res = await fetchWithFallback('get', '/redisItems');
        const count = res.data.count;
        addLog(`DATA [REDIS]: ${count} KEYS IN CACHE`, 'info');
      } else if (containerName.includes('db-shard')) {
        const res = await fetchWithFallback('get', '/slaveItems');
        const count = Object.keys(res.data.data).length;
        addLog(`DATA [${containerName.toUpperCase()}]: ${count} ROWS TOTAL`, 'info');
      }
    } catch (err: any) {
        addLog(`✗ FETCH DATA FAILED: ${err.message}`, 'error');
    }
  };

  const dispatchTrace = (handled_by: string, server: string) => {
    const serverMap: Record<string, string> = {
        'App_Server_1': 'app1',
        'App_Server_2': 'app2',
        'App_Server_Secret': 'lb',
        'shard0_master': 's0m',
        'shard0_slave': 's0s',
        'shard1_master': 's1m',
        'shard1_slave': 's1s',
        'redis_cache_hit': 'redis',
        'shard0_master_db_cache_miss': 's0m',
        'shard0_slave_db_cache_miss': 's0s',
        'shard1_master_db_cache_miss': 's1m',
        'shard1_slave_db_cache_miss': 's1s'
    };
    const route = ['lb', serverMap[handled_by], serverMap[server]].filter(Boolean);
    if (route.length > 1) {
      const newTrace: PacketTrace = { id: Date.now() + Math.random(), route };
      setTraces(prev => [...prev.slice(-20), newTrace]);
    }
  };

  const executeRequest = async (itemName: string) => {
    addLog(`📝 INSERT ITEM "${itemName}" → CALCULATING SHARD...`);
    try {
      const res = await fetchWithFallback('post', `/items?name=${encodeURIComponent(itemName)}`);
      const d = res.data;
      addLog(`✓ ID=${d.data.id} ROUTED TO ${d.server} (${d.handled_by})`, 'success');
      dispatchTrace(d.handled_by, d.server);
      setMaxId(prev => Math.max(prev, d.data.id));
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      addLog(`✗ WRITE FAILED: ${msg}`, 'error');
    }
  };

  const readRequest = async () => {
    if (maxId === 0) {
      addLog(`✗ CANNOT READ: DB IS EMPTY`, 'error');
      return;
    }
    const randomId = Math.floor(Math.random() * maxId) + 1;
    addLog(`📖 READ ITEM ID=${randomId} → FETCHING...`);
    try {
      const res = await fetchWithFallback('get', `/items/${randomId}`);
      const d = res.data;
      if (d.status === 'error') {
          addLog(`✗ READ FAILED: ${d.message}`, 'error');
      } else {
          addLog(`✓ READ ID=${d.data.id} ROUTED TO ${d.source || d.server} (${d.handled_by})`, 'success');
          dispatchTrace(d.handled_by, d.source || d.server);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      addLog(`✗ READ FAILED: ${msg}`, 'error');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    setIsSubmitting(true);
    await executeRequest(taskName);
    setTaskName('');
    setIsSubmitting(false);
  };

  const handleRandomRequests = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    for (let i = 0; i < 5; i++) {
        await executeRequest(`retro_item_${Math.floor(Math.random() * 9999)}`);
        await new Promise(r => setTimeout(r, 400));
    }
    setIsSubmitting(false);
  };

  const aliveCount = nodes.filter(n => n.status === 'running').length;
  const deadCount = nodes.length - aliveCount;

  return (
    <>
      <div className="grid-bg" />
      <div className="app-container">
        <header className="header">
          <div className="header-title">
            <div className="header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <rect x="2" y="2" width="20" height="20" />
                <path d="M7 7h10v10H7z"/>
              </svg>
            </div>
            <div>
              <h1>CHAOS ENGINE</h1>
              <span className="subtitle">DISTRIBUTED SYSTEM SANDBOX</span>
            </div>
          </div>
          <div className="header-controls">
            <div className={`status-pill ${deadCount > 0 ? 'alert' : ''}`}>
              <span className="status-dot" />
              <span>{aliveCount}/{nodes.length} ONLINE</span>
            </div>
          </div>
        </header>

        <div className="toolbar">
          <span className="toolbar-label">ARSENAL</span>
          <div className="toolbar-section">
            <button className={`tool-btn ${activeTool === 'select' ? 'active-select' : ''}`}
              onClick={() => setActiveTool('select')}>
              [INSPECT]
            </button>
            <button className={`tool-btn ${activeTool === 'hammer' ? 'active-hammer' : ''}`}
              onClick={() => setActiveTool('hammer')}>
              [HAMMER]
            </button>
            <button className={`tool-btn ${activeTool === 'wrench' ? 'active-wrench' : ''}`}
              onClick={() => setActiveTool('wrench')}>
              [WRENCH]
            </button>
          </div>

          <div className="toolbar-divider" />

          <form className="task-form" onSubmit={handleAddItem}>
            <span className="toolbar-label">NETWORK</span>
            <input className="task-input" type="text" placeholder="PAYLOAD..."
              value={taskName} onChange={e => setTaskName(e.target.value)} required />
            <button className="submit-btn" type="submit" disabled={isSubmitting}>
              WRITE 1
            </button>
            <button className="submit-btn random-btn" type="button" disabled={isSubmitting} onClick={handleRandomRequests}>
              WRITE 5
            </button>
            <button className="submit-btn" type="button" disabled={isSubmitting || maxId === 0} onClick={readRequest}>
              READ RANDOM
            </button>
          </form>
        </div>

        <div className="main-content">
          <PipelineCanvas
            nodes={nodes}
            connections={CONNECTIONS}
            activeTool={activeTool}
            onKill={handleKillNode}
            onRevive={handleReviveNode}
            onInspect={handleInspectNode}
            traces={traces}
          />

          <div className="sidebar">
            <div className="status-cards">
              <div className="status-cards-title">CLUSTER HEALTH</div>
              {nodes.map(node => (
                <div className="status-card" key={node.id}>
                  <span className="status-card-name">{node.label}</span>
                  <span className={`status-badge ${node.status === 'running' ? 'online' : 'offline'}`}>
                    {node.status === 'running' ? 'UP' : 'DOWN'}
                  </span>
                </div>
              ))}
            </div>

            <div className="log-terminal">
              <div className="log-header">
                <span className="log-header-title">EVENT LOG</span>
              </div>
              <div className="log-body">
                {logs.map((log, i) => (
                  <div key={i} className={`log-entry ${i === 0 ? 'latest' : ''} ${log.includes('✗') ? 'error' : ''} ${log.includes('✓') ? 'success' : ''}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}