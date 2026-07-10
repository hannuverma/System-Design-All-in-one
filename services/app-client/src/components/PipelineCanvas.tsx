import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { InfraNode, PipelineConnection, ActiveTool, ExplosionParticle, PacketTrace } from '../types';
import { NodeModel } from './NodeModels';

interface PipelineCanvasProps {
  nodes: InfraNode[];
  connections: PipelineConnection[];
  activeTool: ActiveTool;
  onKill: (name: string) => void;
  onRevive: (name: string) => void;
  onInspect: (name: string, status: string) => void;
  traces: PacketTrace[];
}

const CONNECTION_COLORS: Record<string, string> = {
  request: '#a855f7',
  replication: '#06b6d4',
  cache: '#f59e0b',
};

// Local extended packet type for multi-hop
interface HopPacket {
  id: number;
  route: string[];
  hopIndex: number;
  progress: number;
  color: string;
}

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({
  nodes,
  connections,
  activeTool,
  onKill,
  onRevive,
  onInspect,
  traces
}) => {
  const [packets, setPackets] = useState<HopPacket[]>([]);
  const [explosions, setExplosions] = useState<ExplosionParticle[]>([]);
  const [shakingNode, setShakingNode] = useState<string | null>(null);
  const [dyingNodes, setDyingNodes] = useState<Set<string>>(new Set());
  const [revivingNodes, setRevivingNodes] = useState<Set<string>>(new Set());
  const animFrameRef = useRef<number>(0);
  const prevTracesLength = useRef(0);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Clear reviving nodes and dying nodes based on actual status
  useEffect(() => {
    setRevivingNodes(prev => {
      const next = new Set(prev);
      for (const id of next) {
        if (nodeMap.get(id)?.status === 'running') next.delete(id);
      }
      return next;
    });
    setDyingNodes(prev => {
      const next = new Set(prev);
      for (const id of next) {
        if (nodeMap.get(id)?.status !== 'running') next.delete(id);
      }
      return next;
    });
  }, [nodes]);

  // Continuous explosions for dying nodes
  useEffect(() => {
    if (dyingNodes.size === 0) return;
    const interval = setInterval(() => {
      dyingNodes.forEach(id => {
        const node = nodeMap.get(id);
        if (node) triggerExplosion(node, true);
      });
    }, 200);
    return () => clearInterval(interval);
  }, [dyingNodes, nodes]);

  // Handle incoming request traces
  useEffect(() => {
    if (traces.length > prevTracesLength.current) {
      const newTraces = traces.slice(prevTracesLength.current);
      const newPackets = newTraces.map(trace => ({
        id: trace.id,
        route: trace.route,
        hopIndex: 0,
        progress: 0,
        color: '#a855f7' // default request color
      }));
      setPackets(prev => [...prev, ...newPackets]);
      prevTracesLength.current = traces.length;
    }
  }, [traces]);

  // Animate packets
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      setPackets(prev => {
        let updated = false;
        const next = prev.map(p => {
          const np = { ...p, progress: p.progress + dt * 1.5 }; // Speed multiplier
          updated = true;
          
          if (np.progress >= 1) {
            if (np.hopIndex < np.route.length - 2) {
              // Move to next hop
              np.hopIndex += 1;
              np.progress = 0;
            }
          }
          return np;
        }).filter(p => p.progress < 1 || p.hopIndex < p.route.length - 2);
        
        return updated ? next : prev;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Retro Orthogonal Pathing
  const getPath = useCallback((fromId: string, toId: string): string => {
    const from = nodeMap.get(fromId);
    const to = nodeMap.get(toId);
    if (!from || !to) return '';

    const midX = from.x + (to.x - from.x) / 2;
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  }, [nodes]);

  // Get point on orthogonal path
  const getPointOnPath = (fromId: string, toId: string, t: number) => {
    const from = nodeMap.get(fromId);
    const to = nodeMap.get(toId);
    if (!from || !to) return { x: 0, y: 0 };

    const midX = from.x + (to.x - from.x) / 2;
    
    // 3 segments: 
    // 1. from.x -> midX  (horiz)
    // 2. from.y -> to.y  (vert)
    // 3. midX -> to.x    (horiz)
    
    const d1 = Math.abs(midX - from.x);
    const d2 = Math.abs(to.y - from.y);
    const d3 = Math.abs(to.x - midX);
    const totalDist = d1 + d2 + d3;
    
    const currentDist = t * totalDist;
    
    if (currentDist <= d1) {
      const r = d1 === 0 ? 0 : currentDist / d1;
      return { x: from.x + (midX - from.x) * r, y: from.y };
    } else if (currentDist <= d1 + d2) {
      const r = d2 === 0 ? 0 : (currentDist - d1) / d2;
      return { x: midX, y: from.y + (to.y - from.y) * r };
    } else {
      const r = d3 === 0 ? 0 : (currentDist - d1 - d2) / d3;
      return { x: midX + (to.x - midX) * r, y: to.y };
    }
  };

  const triggerExplosion = (node: InfraNode, offset = false) => {
    const colors = ['#f59e0b', '#ef4444', '#fb923c', '#fbbf24', '#f97316'];
    const cx = offset ? node.x + (Math.random() - 0.5) * 40 : node.x;
    const cy = offset ? node.y + (Math.random() - 0.5) * 40 : node.y;
    
    const newParticles: ExplosionParticle[] = Array.from({ length: offset ? 8 : 18 }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      x: cx,
      y: cy,
      angle: (Math.PI * 2 * i) / (offset ? 8 : 18) + (Math.random() - 0.5) * 0.5,
      speed: 40 + Math.random() * 80,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setExplosions(prev => [...prev.slice(-100), ...newParticles]);
    setTimeout(() => {
      setExplosions(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 800);
  };

  const handleNodeClick = (node: InfraNode) => {
    if (activeTool === 'select') {
      onInspect(node.label, node.status === 'running' ? 'ONLINE' : 'OFFLINE');
    } else if (activeTool === 'hammer' && node.status === 'running') {
      setShakingNode(node.id);
      setDyingNodes(prev => new Set(prev).add(node.id));
      triggerExplosion(node);
      onKill(node.name);
      setTimeout(() => setShakingNode(null), 500);
    } else if (activeTool === 'wrench' && node.status !== 'running' && !revivingNodes.has(node.id)) {
      setRevivingNodes(prev => new Set(prev).add(node.id));
      onRevive(node.name);
    }
  };

  const getNodeToolClass = (node: InfraNode) => {
    if (activeTool === 'hammer' && node.status === 'running') return 'tool-hammer';
    if (activeTool === 'wrench' && node.status !== 'running') return 'tool-wrench';
    return '';
  };

  return (
    <div className="pipeline-canvas">
      <svg className="pipeline-svg" viewBox="0 0 760 520" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="dead-filter">
            <feColorMatrix type="saturate" values="0.1" />
          </filter>
        </defs>

        {/* ── Background grid dots ── */}
        <g opacity={0.3}>
          {Array.from({ length: 20 }).map((_, xi) =>
            Array.from({ length: 14 }).map((_, yi) => (
              <rect key={`${xi}-${yi}`} x={xi * 40 + 19} y={yi * 40 + 19} width={2} height={2} fill="#5a5e72" />
            ))
          )}
        </g>

        {/* ── Shard zone backgrounds ── */}
        <rect x={260} y={240} width={240} height={250} 
          fill="transparent" stroke="#22d37e" strokeWidth={2} strokeDasharray="8 8" opacity={0.2} />
        <text x={380} y={260} textAnchor="middle" fill="#22d37e" opacity={0.4}
          fontFamily="'Press Start 2P', monospace" fontSize="8">
          SHARD 0 - EVEN
        </text>

        <rect x={510} y={240} width={240} height={250} 
          fill="transparent" stroke="#06b6d4" strokeWidth={2} strokeDasharray="8 8" opacity={0.2} />
        <text x={630} y={260} textAnchor="middle" fill="#06b6d4" opacity={0.4}
          fontFamily="'Press Start 2P', monospace" fontSize="8">
          SHARD 1 - ODD
        </text>

        {/* ── Connection lines ── */}
        {connections.map((conn, i) => {
          const from = nodeMap.get(conn.from);
          const to = nodeMap.get(conn.to);
          const isActive = from?.status === 'running' && to?.status === 'running';
          const color = CONNECTION_COLORS[conn.type] || '#a855f7';

          return (
            <path
              key={i}
              d={getPath(conn.from, conn.to)}
              stroke={isActive ? color : '#555'}
              strokeWidth={3}
              fill="none"
              className={isActive ? '' : 'dead'}
              strokeDasharray={isActive ? 'none' : '4 4'}
              opacity={isActive ? 0.6 : 0.3}
            />
          );
        })}

        {/* ── Flowing data packets ── */}
        {packets.map(packet => {
          const fromId = packet.route[packet.hopIndex];
          const toId = packet.route[packet.hopIndex + 1];
          const pos = getPointOnPath(fromId, toId, packet.progress);
          return (
            <rect
              key={`${packet.id}-${packet.hopIndex}`}
              x={pos.x - 4}
              y={pos.y - 4}
              width={8}
              height={8}
              fill={packet.color}
            />
          );
        })}

        {/* ── Infrastructure nodes ── */}
        {nodes.map(node => {
          const alive = node.status === 'running';
          const isShaking = shakingNode === node.id;
          const isReviving = revivingNodes.has(node.id);

          return (
            <g
              key={node.id}
              className={`infra-node ${getNodeToolClass(node)}`}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => handleNodeClick(node)}
              filter={!alive ? 'url(#dead-filter)' : undefined}
            >
              {/* Inner group for animation so it doesn't overwrite outer transform */}
              <g className={isShaking ? 'node-shake' : ''}>
                
                {/* Dead X overlay */}
                {!alive && !isReviving && (
                  <g opacity={0.8}>
                    <line x1={-14} y1={-14} x2={14} y2={14} stroke="#ef4444" strokeWidth={4} />
                    <line x1={14} y1={-14} x2={-14} y2={14} stroke="#ef4444" strokeWidth={4} />
                  </g>
                )}

                {/* Revive Bar */}
                {isReviving && (
                  <g transform="translate(-20, 24)">
                    <rect x={0} y={0} width={40} height={6} fill="#111" stroke="#00ff00" strokeWidth={1} />
                    <rect x={0} y={0} height={6} fill="#00ff00" className="revive-bar" />
                  </g>
                )}

                {/* The actual model SVG */}
                <NodeModel node={node} />

                {/* Label */}
                <text className="node-label" y={36}>{node.label}</text>

                {/* Status indicator block */}
                <rect x={18} y={-28} width={10} height={10}
                  fill={alive ? '#22d37e' : '#ef4444'}
                  stroke="#1e1e2e" strokeWidth={2}>
                  {alive && <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />}
                </rect>

                {/* Tool hint */}
                {activeTool === 'hammer' && alive && (
                  <text y={52} textAnchor="middle" fill="#f59e0b" fontSize="8" fontFamily="'Press Start 2P', monospace">
                    DESTROY
                  </text>
                )}
                {activeTool === 'wrench' && !alive && (
                  <text y={52} textAnchor="middle" fill="#06b6d4" fontSize="8" fontFamily="'Press Start 2P', monospace">
                    REVIVE
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {/* ── Explosion particles ── */}
        {explosions.map(p => {
          const elapsed = (Date.now() - p.id) / 1000;
          const px = p.x + Math.cos(p.angle) * p.speed * Math.min(elapsed, 0.7);
          const py = p.y + Math.sin(p.angle) * p.speed * Math.min(elapsed, 0.7);
          const opacity = Math.max(0, 1 - elapsed / 0.7);
          const scale = Math.max(0.1, 1 - elapsed / 0.7);
          return (
            <rect
              key={p.id}
              x={px - (p.size * scale) / 2} 
              y={py - (p.size * scale) / 2}
              width={p.size * scale}
              height={p.size * scale}
              fill={p.color}
              opacity={opacity}
            />
          );
        })}
      </svg>
    </div>
  );
};
