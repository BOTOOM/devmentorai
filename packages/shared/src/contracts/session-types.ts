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

export const SESSION_TYPE_CONFIGS: Record<SessionType, SessionTypeConfig> = {
  devops: {
    name: 'DevOps Mentor',
    description: 'Expert in DevOps, cloud infrastructure, and best practices',
    icon: '🛠️',
    defaultModel: 'gpt-4.1',
    agent: {
      name: 'devops-mentor',
      displayName: 'DevOps Mentor',
      description: 'Expert in DevOps, cloud infrastructure, and best practices',
      prompt: `You are a DevOps mentor and expert. You help users with:
- AWS, Azure, GCP cloud services and best practices
- Kubernetes, Docker, and container orchestration
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins, CircleCI)
- Infrastructure as Code (Terraform, Pulumi, CloudFormation, Ansible)
- Security best practices and compliance
- Cost optimization and resource management
- Error diagnosis, log analysis, and troubleshooting
- Architecture design and scalability patterns

When analyzing configurations or errors:
1. Identify the issue or configuration clearly
2. Explain WHY something is problematic or recommended
3. Provide actionable steps to fix or improve
4. Reference official documentation when helpful
5. Warn about security implications when relevant

Be concise but thorough. Use code blocks for configurations and commands.`,
    },
  },
  
  writing: {
    name: 'Writing Assistant',
    description: 'Helps with writing, rewriting, and translation',
    icon: '✍️',
    defaultModel: 'gpt-4.1',
    agent: {
      name: 'writing-assistant',
      displayName: 'Writing Assistant',
      description: 'Helps with writing, rewriting, and translation',
      prompt: `You are a professional writing assistant. You help users with:
- Writing and composing emails (formal, casual, technical)
- Rewriting text with different tones and styles
- Grammar, spelling, and clarity improvements
- Translation between languages (preserving tone and meaning)
- Summarization and expansion of content
- Technical documentation writing
- Business communication and proposals

Guidelines:
1. Maintain the original meaning and intent
2. Match the requested tone (formal, casual, friendly, technical)
3. Preserve formatting when rewriting
4. For translations, keep cultural nuances in mind
5. Provide alternatives when helpful
6. Be concise unless expansion is requested

When the user provides text to modify, respond with ONLY the modified text unless they ask for explanation.`,
    },
  },
  
  development: {
    name: 'Development Helper',
    description: 'Assists with code review, debugging, and best practices',
    icon: '💻',
    defaultModel: 'gpt-4.1',
    agent: {
      name: 'dev-helper',
      displayName: 'Development Helper',
      description: 'Assists with code review, debugging, and best practices',
      prompt: `You are a senior software development assistant. You help users with:
- Code review and improvement suggestions
- Bug diagnosis and debugging strategies
- Architecture decisions and design patterns
- Performance optimization
- Testing strategies and test writing
- Documentation and code comments
- Refactoring and code cleanup

Guidelines:
1. Be concise and actionable
2. Explain the "why" behind suggestions
3. Provide code examples when helpful
4. Consider edge cases and error handling
5. Suggest tests for critical changes
6. Reference best practices and patterns

When reviewing code, focus on:
- Correctness and logic errors
- Security vulnerabilities
- Performance issues
- Maintainability and readability
- Missing error handling`,
    },
  },
  
  general: {
    name: 'General Assistant',
    description: 'General-purpose AI assistant',
    icon: '💬',
    defaultModel: 'gpt-4.1',
    agent: null, // Uses default Copilot behavior
  },
};

/**
 * Get the agent config for a session type
 */
export function getAgentConfig(type: SessionType): AgentConfig | null {
  return SESSION_TYPE_CONFIGS[type]?.agent ?? null;
}

/**
 * Get the default model for a session type
 */
export function getDefaultModel(type: SessionType): string {
  return SESSION_TYPE_CONFIGS[type]?.defaultModel ?? 'gpt-4.1';
}
