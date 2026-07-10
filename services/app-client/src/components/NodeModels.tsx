import React from 'react';
import type { InfraNode } from '../types';

/* ====================================================================
   Retro 8-bit SVG models.
   Blocky shapes, thick strokes, solid fills, no anti-aliasing magic.
   ==================================================================== */

// ─── Load Balancer (Nginx) ───────────────────────────────────
export const LoadBalancerModel: React.FC<{ alive: boolean }> = ({ alive }) => {
  const color = alive ? '#0000ff' : '#444444';
  const fillColor = alive ? '#000044' : '#111111';
  return (
    <g>
      {/* Boxy chassis */}
      <rect x={-28} y={-22} width={56} height={44}
        fill={fillColor}
        stroke={color} strokeWidth={4} />
      
      {/* Fan out block arrows */}
      <rect x={-18} y={4} width={8} height={8} fill={color} />
      <rect x={-4} y={4} width={8} height={8} fill={color} />
      <rect x={10} y={4} width={8} height={8} fill={color} />
      
      {/* Top indicator pixel */}
      <rect x={-4} y={-14} width={8} height={8} fill={color}>
        {alive && <animate attributeName="opacity" values="1;0;1" dur="1s" steps="2" repeatCount="indefinite" />}
      </rect>
    </g>
  );
};

// ─── App Server (FastAPI) ────────────────────────────────────
export const AppServerModel: React.FC<{ alive: boolean }> = ({ alive }) => {
  const color = alive ? '#ff00ff' : '#444444';
  const fillColor = alive ? '#440044' : '#111111';
  return (
    <g>
      {/* Server rack body */}
      <rect x={-26} y={-22} width={52} height={44}
        fill={fillColor}
        stroke={color} strokeWidth={4} />
      
      {/* Rack slots */}
      <rect x={-20} y={-14} width={40} height={6} fill={color} />
      <rect x={-20} y={0} width={40} height={6} fill={color} />
      
      {/* Activity LEDs */}
      <rect x={-18} y={-14} width={6} height={6} fill={alive ? '#00ff00' : '#444444'}>
        {alive && <animate attributeName="opacity" values="1;0;1" dur="0.5s" steps="2" repeatCount="indefinite" />}
      </rect>
      <rect x={-18} y={0} width={6} height={6} fill={alive ? '#00ff00' : '#444444'}>
        {alive && <animate attributeName="opacity" values="1;0;1" dur="0.8s" steps="2" repeatCount="indefinite" />}
      </rect>
    </g>
  );
};

// ─── Database (PostgreSQL) ────────────────────────────────────
export const DatabaseModel: React.FC<{ alive: boolean; role?: string }> = ({ alive, role }) => {
  const isMaster = role === 'master';
  const color = alive ? (isMaster ? '#00ff00' : '#00ffff') : '#444444';
  const fillColor = alive ? (isMaster ? '#004400' : '#004444') : '#111111';
  return (
    <g>
      {/* Stacked blocky disks */}
      <rect x={-26} y={-20} width={52} height={12} fill={fillColor} stroke={color} strokeWidth={4} />
      <rect x={-26} y={-4} width={52} height={12} fill={fillColor} stroke={color} strokeWidth={4} />
      <rect x={-26} y={12} width={52} height={12} fill={fillColor} stroke={color} strokeWidth={4} />
      
      {/* Crown for master */}
      {isMaster && alive && (
        <path d="M -12 -24 L -12 -32 L -4 -26 L 0 -34 L 4 -26 L 12 -32 L 12 -24 Z" fill="#ffff00" />
      )}
      
      {/* Heartbeat block */}
      {alive && (
        <rect x={-6} y={-2} width={12} height={8} fill={color}>
          <animate attributeName="opacity" values="1;0;1" dur="2s" steps="2" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
};

// ─── Cache (Redis) ───────────────────────────────────────────
export const CacheModel: React.FC<{ alive: boolean }> = ({ alive }) => {
  const color = alive ? '#ffff00' : '#444444';
  const fillColor = alive ? '#444400' : '#111111';
  return (
    <g>
      {/* Diamond / rhombus shape - approximated with a blocky star/cross */}
      <rect x={-14} y={-26} width={28} height={52} fill={fillColor} stroke={color} strokeWidth={4} />
      <rect x={-26} y={-14} width={52} height={28} fill={fillColor} stroke={color} strokeWidth={4} />
      
      {/* Center fill to override inner borders */}
      <rect x={-10} y={-10} width={20} height={20} fill={fillColor} />
      
      {/* Inner block */}
      <rect x={-6} y={-6} width={12} height={12} fill={color}>
        {alive && <animate attributeName="opacity" values="1;0.2;1" dur="1s" steps="2" repeatCount="indefinite" />}
      </rect>
    </g>
  );
};

// ─── Resolver: pick the right model for a given node ─────────
interface NodeModelProps {
  node: InfraNode;
}

export const NodeModel: React.FC<NodeModelProps> = ({ node }) => {
  const alive = node.status === 'running';
  switch (node.type) {
    case 'load-balancer':
      return <LoadBalancerModel alive={alive} />;
    case 'app-server':
      return <AppServerModel alive={alive} />;
    case 'database':
      return <DatabaseModel alive={alive} role={node.role} />;
    case 'cache':
      return <CacheModel alive={alive} />;
    default:
      return <AppServerModel alive={alive} />;
  }
};
