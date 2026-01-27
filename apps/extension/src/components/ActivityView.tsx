/**
 * Activity View Component
 * 
 * Displays Copilot activity states and tool executions for transparency.
 * Shows processing indicators, running tools, and errors.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Wrench, Brain, ChevronDown, ChevronUp } from 'lucide-react';

export type ActivityStatus = 'idle' | 'thinking' | 'processing' | 'tool_running' | 'streaming' | 'complete' | 'error';

export interface ToolExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt: Date;
  completedAt?: Date;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface ActivityState {
  status: ActivityStatus;
  message?: string;
  toolExecutions: ToolExecution[];
  thinkingContent?: string;
}

interface ActivityViewProps {
  activity: ActivityState;
  compact?: boolean;
}

const statusConfig: Record<ActivityStatus, { icon: React.ReactNode; label: string; color: string }> = {
  idle: { icon: null, label: '', color: 'text-muted-foreground' },
  thinking: { 
    icon: <Brain className="w-4 h-4 animate-pulse" />, 
    label: 'Thinking...', 
    color: 'text-purple-500' 
  },
  processing: { 
    icon: <Loader2 className="w-4 h-4 animate-spin" />, 
    label: 'Processing...', 
    color: 'text-blue-500' 
  },
  tool_running: { 
    icon: <Wrench className="w-4 h-4 animate-bounce" />, 
    label: 'Running tool...', 
    color: 'text-orange-500' 
  },
  streaming: { 
    icon: <Loader2 className="w-4 h-4 animate-spin" />, 
    label: 'Generating response...', 
    color: 'text-green-500' 
  },
  complete: { 
    icon: <CheckCircle className="w-4 h-4" />, 
    label: 'Complete', 
    color: 'text-green-500' 
  },
  error: { 
    icon: <XCircle className="w-4 h-4" />, 
    label: 'Error', 
    color: 'text-red-500' 
  },
};

export function ActivityView({ activity, compact = false }: ActivityViewProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  
  const { status, message, toolExecutions, thinkingContent } = activity;
  const config = statusConfig[status];
  
  // Don't render if idle
  if (status === 'idle') return null;
  
  // Auto-collapse after completion
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(() => setExpanded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${config.color}`}>
        {config.icon}
        <span>{message || config.label}</span>
      </div>
    );
  }
  
  const runningTools = toolExecutions.filter(t => t.status === 'running');
  const completedTools = toolExecutions.filter(t => t.status === 'completed');
  const failedTools = toolExecutions.filter(t => t.status === 'error');
  
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-sm">
      {/* Status Header */}
      <div 
        className={`flex items-center justify-between cursor-pointer ${config.color}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="font-medium">{message || config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {toolExecutions.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {runningTools.length > 0 && `${runningTools.length} running`}
              {completedTools.length > 0 && ` • ${completedTools.length} completed`}
              {failedTools.length > 0 && ` • ${failedTools.length} failed`}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Thinking Content (if available) */}
          {thinkingContent && (
            <div className="border border-purple-500/20 rounded p-2 bg-purple-500/5">
              <div 
                className="flex items-center gap-1 text-purple-500 text-xs cursor-pointer"
                onClick={() => setShowThinking(!showThinking)}
              >
                <Brain className="w-3 h-3" />
                <span>Reasoning</span>
                {showThinking ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
              {showThinking && (
                <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {thinkingContent}
                </div>
              )}
            </div>
          )}
          
          {/* Tool Executions */}
          {toolExecutions.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Tool Executions</div>
              {toolExecutions.map((tool) => (
                <ToolExecutionItem key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolExecutionItemProps {
  tool: ToolExecution;
}

function ToolExecutionItem({ tool }: ToolExecutionItemProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);
  
  const statusColors = {
    pending: 'text-muted-foreground',
    running: 'text-orange-500',
    completed: 'text-green-500',
    error: 'text-red-500',
  };
  
  const statusIcons = {
    pending: <Loader2 className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <CheckCircle className="w-3 h-3" />,
    error: <XCircle className="w-3 h-3" />,
  };
  
  const duration = tool.completedAt 
    ? `${((tool.completedAt.getTime() - tool.startedAt.getTime()) / 1000).toFixed(1)}s`
    : null;
  
  return (
    <div className="border border-border rounded p-2 bg-background/50">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          <span className={statusColors[tool.status]}>{statusIcons[tool.status]}</span>
          <span className="font-mono text-xs">{tool.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {duration && <span>{duration}</span>}
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>
      
      {showDetails && (
        <div className="mt-2 space-y-1 text-xs">
          {tool.input && (
            <div>
              <span className="text-muted-foreground">Input: </span>
              <code className="bg-muted px-1 rounded">
                {JSON.stringify(tool.input, null, 2)}
              </code>
            </div>
          )}
          {tool.output && (
            <div>
              <span className="text-muted-foreground">Output: </span>
              <pre className="bg-muted p-1 rounded overflow-x-auto max-h-20">
                {tool.output.slice(0, 500)}
                {tool.output.length > 500 && '...'}
              </pre>
            </div>
          )}
          {tool.error && (
            <div className="text-red-500">
              <span>Error: </span>
              <span>{tool.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage activity state
 */
export function useActivityState(): [ActivityState, {
  setStatus: (status: ActivityStatus, message?: string) => void;
  setThinking: (content: string) => void;
  addToolExecution: (tool: Omit<ToolExecution, 'id'>) => string;
  updateToolExecution: (id: string, updates: Partial<ToolExecution>) => void;
  reset: () => void;
}] {
  const [activity, setActivity] = useState<ActivityState>({
    status: 'idle',
    toolExecutions: [],
  });
  
  const setStatus = (status: ActivityStatus, message?: string) => {
    setActivity(prev => ({ ...prev, status, message }));
  };
  
  const setThinking = (content: string) => {
    setActivity(prev => ({ ...prev, thinkingContent: content }));
  };
  
  const addToolExecution = (tool: Omit<ToolExecution, 'id'>): string => {
    const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setActivity(prev => ({
      ...prev,
      toolExecutions: [...prev.toolExecutions, { ...tool, id }],
    }));
    return id;
  };
  
  const updateToolExecution = (id: string, updates: Partial<ToolExecution>) => {
    setActivity(prev => ({
      ...prev,
      toolExecutions: prev.toolExecutions.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  };
  
  const reset = () => {
    setActivity({ status: 'idle', toolExecutions: [] });
  };
  
  return [activity, { setStatus, setThinking, addToolExecution, updateToolExecution, reset }];
}

export default ActivityView;
