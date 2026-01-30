/**
 * Session type configurations with pre-defined agents
 */
import type { SessionType } from '../types/session.ts';
export interface AgentConfig {
    name: string;
    displayName: string;
    description: string;
    prompt: string;
}
export interface SessionTypeConfig {
    name: string;
    description: string;
    icon: string;
    agent: AgentConfig | null;
    defaultModel: string;
}
export declare const SESSION_TYPE_CONFIGS: Record<SessionType, SessionTypeConfig>;
/**
 * Get the agent config for a session type
 */
export declare function getAgentConfig(type: SessionType): AgentConfig | null;
/**
 * Get the default model for a session type
 */
export declare function getDefaultModel(type: SessionType): string;
//# sourceMappingURL=session-types.d.ts.map