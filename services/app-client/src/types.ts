export type NodeStatus = 'running' | 'exited' | 'offline' | 'paused';

export interface ServerInfo {
    name: string
    role: 'master' | 'slave'
    shard: number
    status: NodeStatus
    health: number
    port: number
}

export type ActiveTool = 'select' | 'hammer' | 'wrench';

export interface ExplosionParticle{
    id: number
    x: number;
    y: number;
}