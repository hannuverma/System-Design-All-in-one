export type NodeStatus = 'running' | 'exited' | 'offline' | 'paused';

export type NodeType = 'load-balancer' | 'app-server' | 'database' | 'cache';

export interface InfraNode {
    id: string;
    name: string;
    label: string;
    type: NodeType;
    role?: 'master' | 'slave';
    shard?: number;
    status: NodeStatus;
    health: number;
    port: number;
    x: number;
    y: number;
}

export interface PipelineConnection {
    from: string;
    to: string;
    label?: string;
    type: 'request' | 'replication' | 'cache';
}

export type ActiveTool = 'select' | 'hammer' | 'wrench';

export interface ExplosionParticle {
    id: number;
    x: number;
    y: number;
    angle: number;
    speed: number;
    size: number;
    color: string;
}

export interface DataPacket {
    id: number;
    fromId: string;
    toId: string;
    progress: number;
    color: string;
    type: 'request' | 'replication' | 'cache';
}

export interface PacketTrace {
    id: number;
    route: string[]; // e.g. ['lb', 'app1', 's0m']
}