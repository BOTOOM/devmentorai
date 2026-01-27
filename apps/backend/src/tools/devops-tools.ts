/**
 * Custom DevOps Analysis Tools for DevMentorAI
 * 
 * These tools extend Copilot's capabilities with specialized DevOps functionality:
 * - Configuration file analysis
 * - Infrastructure best practices checking
 * - Log analysis
 * - Cost estimation helpers
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<string>;
}

// Allowed directories for file access (security sandbox)
const ALLOWED_DIRECTORIES = [
  process.env.HOME || '/home',
  '/tmp',
];

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_DIRECTORIES.some(dir => resolved.startsWith(dir));
}

/**
 * Read file contents with security checks
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a local file. Use this to analyze configuration files, logs, or code.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to read',
      },
      maxLines: {
        type: 'number',
        description: 'Maximum number of lines to read (default: 500)',
      },
    },
    required: ['path'],
  },
  handler: async (params) => {
    const filePath = params.path as string;
    const maxLines = (params.maxLines as number) || 500;

    if (!isPathAllowed(filePath)) {
      return `Error: Access denied. Path "${filePath}" is outside allowed directories.`;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') + 
          `\n\n[Truncated: ${lines.length - maxLines} more lines]`;
      }
      
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `Error: File not found: ${filePath}`;
      }
      return `Error reading file: ${error}`;
    }
  },
};

/**
 * List directory contents
 */
export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List contents of a directory. Useful for exploring project structure.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list',
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list recursively (default: false, max depth: 3)',
      },
    },
    required: ['path'],
  },
  handler: async (params) => {
    const dirPath = params.path as string;
    const recursive = params.recursive as boolean || false;

    if (!isPathAllowed(dirPath)) {
      return `Error: Access denied. Path "${dirPath}" is outside allowed directories.`;
    }

    async function listDir(dir: string, depth: number = 0): Promise<string[]> {
      if (depth > 3) return [];
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: string[] = [];
      
      for (const entry of entries) {
        const prefix = '  '.repeat(depth);
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          results.push(`${prefix}📁 ${entry.name}/`);
          if (recursive) {
            results.push(...await listDir(fullPath, depth + 1));
          }
        } else {
          const stats = await fs.stat(fullPath);
          const size = formatSize(stats.size);
          results.push(`${prefix}📄 ${entry.name} (${size})`);
        }
      }
      
      return results;
    }

    try {
      const contents = await listDir(dirPath);
      return contents.join('\n');
    } catch (error) {
      return `Error listing directory: ${error}`;
    }
  },
};

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Analyze configuration file for best practices
 */
export const analyzeConfigTool: Tool = {
  name: 'analyze_config',
  description: 'Analyze a configuration file for DevOps best practices. Supports Kubernetes, Docker, Terraform, and CloudFormation.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The configuration file content to analyze',
      },
      type: {
        type: 'string',
        enum: ['kubernetes', 'docker', 'terraform', 'cloudformation', 'github-actions', 'auto'],
        description: 'Type of configuration (auto-detect if not specified)',
      },
    },
    required: ['content'],
  },
  handler: async (params) => {
    const content = params.content as string;
    let configType = params.type as string || 'auto';

    // Auto-detect config type
    if (configType === 'auto') {
      configType = detectConfigType(content);
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    switch (configType) {
      case 'kubernetes':
        analyzeKubernetes(content, issues, suggestions);
        break;
      case 'docker':
        analyzeDocker(content, issues, suggestions);
        break;
      case 'terraform':
        analyzeTerraform(content, issues, suggestions);
        break;
      case 'cloudformation':
        analyzeCloudFormation(content, issues, suggestions);
        break;
      case 'github-actions':
        analyzeGitHubActions(content, issues, suggestions);
        break;
      default:
        return `Could not determine configuration type. Please specify the type parameter.`;
    }

    let result = `## Configuration Analysis (${configType})\n\n`;
    
    if (issues.length > 0) {
      result += `### ⚠️ Issues Found\n`;
      issues.forEach((issue, i) => {
        result += `${i + 1}. ${issue}\n`;
      });
      result += '\n';
    } else {
      result += `### ✅ No Critical Issues Found\n\n`;
    }

    if (suggestions.length > 0) {
      result += `### 💡 Suggestions\n`;
      suggestions.forEach((suggestion, i) => {
        result += `${i + 1}. ${suggestion}\n`;
      });
    }

    return result;
  },
};

function detectConfigType(content: string): string {
  if (content.includes('apiVersion:') && content.includes('kind:')) return 'kubernetes';
  if (content.includes('FROM ') || content.includes('COPY ') || content.includes('RUN ')) return 'docker';
  if (content.includes('resource "') || content.includes('provider "')) return 'terraform';
  if (content.includes('AWSTemplateFormatVersion') || content.includes('Resources:')) return 'cloudformation';
  if (content.includes('jobs:') && content.includes('runs-on:')) return 'github-actions';
  return 'unknown';
}

function analyzeKubernetes(content: string, issues: string[], suggestions: string[]): void {
  // Resource limits
  if (!content.includes('resources:') || !content.includes('limits:')) {
    issues.push('Missing resource limits. Pods without limits can consume excessive cluster resources.');
  }
  
  // Security context
  if (!content.includes('securityContext:')) {
    suggestions.push('Consider adding securityContext to restrict container privileges.');
  }
  
  // Image tag
  if (content.includes(':latest')) {
    issues.push('Using :latest tag. Pin specific image versions for reproducible deployments.');
  }
  
  // Probes
  if (!content.includes('livenessProbe:') && !content.includes('readinessProbe:')) {
    suggestions.push('Add health probes (livenessProbe/readinessProbe) for better reliability.');
  }
  
  // Namespace
  if (!content.includes('namespace:')) {
    suggestions.push('Explicitly specify namespace to avoid deploying to default namespace.');
  }

  // Run as non-root
  if (content.includes('runAsRoot: true') || content.includes('privileged: true')) {
    issues.push('Container configured to run as root or privileged. This is a security risk.');
  }
}

function analyzeDocker(content: string, issues: string[], suggestions: string[]): void {
  const lines = content.split('\n');
  
  // Base image
  const fromLine = lines.find(l => l.trim().startsWith('FROM '));
  if (fromLine?.includes(':latest')) {
    issues.push('Using :latest base image. Pin a specific version for reproducible builds.');
  }
  
  // Multiple RUN commands
  const runCount = lines.filter(l => l.trim().startsWith('RUN ')).length;
  if (runCount > 5) {
    suggestions.push(`${runCount} separate RUN commands. Consider combining them to reduce image layers.`);
  }
  
  // COPY vs ADD
  if (content.includes('ADD ') && !content.includes('.tar') && !content.includes('http')) {
    suggestions.push('Use COPY instead of ADD for simple file copying. ADD has extra features that may be unnecessary.');
  }
  
  // .dockerignore reminder
  if (content.includes('COPY . ') || content.includes('COPY ./ ')) {
    suggestions.push('Copying entire context. Ensure .dockerignore is configured to exclude unnecessary files.');
  }
  
  // Non-root user
  if (!content.includes('USER ')) {
    suggestions.push('No USER directive. Consider running as non-root user for security.');
  }
  
  // Multi-stage builds
  if (!content.includes('AS ') && content.includes('npm install') || content.includes('go build')) {
    suggestions.push('Consider multi-stage builds to reduce final image size.');
  }
}

function analyzeTerraform(content: string, issues: string[], suggestions: string[]): void {
  // Version constraints
  if (!content.includes('required_version') && !content.includes('required_providers')) {
    issues.push('Missing version constraints. Pin Terraform and provider versions for reproducibility.');
  }
  
  // Hardcoded values
  const hardcodedPatterns = [
    /ami-[a-z0-9]+/,
    /subnet-[a-z0-9]+/,
    /sg-[a-z0-9]+/,
    /vpc-[a-z0-9]+/,
  ];
  for (const pattern of hardcodedPatterns) {
    if (pattern.test(content)) {
      suggestions.push('Hardcoded AWS resource IDs detected. Consider using data sources or variables.');
      break;
    }
  }
  
  // State backend
  if (!content.includes('backend "')) {
    suggestions.push('No remote backend configured. Use S3/GCS/Azure for team collaboration.');
  }
  
  // Sensitive variables
  if (content.includes('password') || content.includes('secret') || content.includes('api_key')) {
    if (!content.includes('sensitive = true')) {
      issues.push('Potentially sensitive variables without sensitive = true flag.');
    }
  }
  
  // Encryption
  if (content.includes('aws_s3_bucket') && !content.includes('server_side_encryption')) {
    suggestions.push('S3 bucket without explicit encryption configuration.');
  }
}

function analyzeCloudFormation(content: string, issues: string[], suggestions: string[]): void {
  // DeletionPolicy
  if (content.includes('AWS::RDS::') || content.includes('AWS::S3::Bucket')) {
    if (!content.includes('DeletionPolicy')) {
      issues.push('Stateful resources without DeletionPolicy. Data may be lost on stack deletion.');
    }
  }
  
  // UpdateReplacePolicy
  if (!content.includes('UpdateReplacePolicy')) {
    suggestions.push('Consider adding UpdateReplacePolicy for stateful resources.');
  }
  
  // Stack drift detection hint
  suggestions.push('Run `aws cloudformation detect-stack-drift` regularly to catch manual changes.');
  
  // Parameters without constraints
  if (content.includes('Parameters:') && !content.includes('AllowedValues')) {
    suggestions.push('Consider adding AllowedValues constraints to parameters.');
  }
}

function analyzeGitHubActions(content: string, issues: string[], suggestions: string[]): void {
  // Pinned actions
  if (content.includes('uses: ') && !content.includes('@v') && !content.includes('@sha')) {
    issues.push('Actions without version pinning. Pin to specific versions or SHA for security.');
  }
  
  // Secrets in env
  if (content.includes('${{ secrets.') && content.includes('echo ')) {
    issues.push('Potential secret exposure in echo/print commands.');
  }
  
  // Permissions
  if (!content.includes('permissions:')) {
    suggestions.push('Explicitly define job permissions for better security (least privilege).');
  }
  
  // Caching
  if ((content.includes('npm ') || content.includes('pip ') || content.includes('go ')) && 
      !content.includes('actions/cache')) {
    suggestions.push('Consider adding caching to speed up workflows.');
  }
  
  // Timeout
  if (!content.includes('timeout-minutes:')) {
    suggestions.push('Add timeout-minutes to prevent stuck workflows from running indefinitely.');
  }
}

/**
 * Analyze error logs
 */
export const analyzeErrorTool: Tool = {
  name: 'analyze_error',
  description: 'Analyze error messages or logs to diagnose issues and suggest solutions.',
  parameters: {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: 'The error message or log content to analyze',
      },
      context: {
        type: 'string',
        enum: ['kubernetes', 'docker', 'terraform', 'aws', 'linux', 'nodejs', 'python', 'general'],
        description: 'Context/environment where the error occurred',
      },
    },
    required: ['error'],
  },
  handler: async (params) => {
    const error = params.error as string;
    const context = params.context as string || 'general';

    const analysis: string[] = [];
    const possibleCauses: string[] = [];
    const solutions: string[] = [];

    // Common patterns
    if (error.includes('permission denied') || error.includes('EACCES')) {
      possibleCauses.push('Insufficient file system permissions');
      solutions.push('Check file/directory permissions with `ls -la`');
      solutions.push('Try running with appropriate user or `sudo` if necessary');
    }

    if (error.includes('connection refused') || error.includes('ECONNREFUSED')) {
      possibleCauses.push('Target service is not running or not listening on expected port');
      solutions.push('Verify the service is running: `systemctl status <service>`');
      solutions.push('Check if the port is open: `netstat -tlnp | grep <port>`');
    }

    if (error.includes('out of memory') || error.includes('OOMKilled')) {
      possibleCauses.push('Application exceeded memory limits');
      solutions.push('Increase memory limits if possible');
      solutions.push('Profile memory usage to find leaks');
      solutions.push('Consider horizontal scaling');
    }

    if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
      possibleCauses.push('Network latency or unreachable endpoint');
      possibleCauses.push('Slow database queries or API responses');
      solutions.push('Check network connectivity: `ping`, `traceroute`');
      solutions.push('Review and optimize slow queries');
      solutions.push('Consider increasing timeout values');
    }

    // Context-specific patterns
    if (context === 'kubernetes') {
      if (error.includes('CrashLoopBackOff')) {
        possibleCauses.push('Container fails to start or crashes immediately');
        solutions.push('Check container logs: `kubectl logs <pod> --previous`');
        solutions.push('Verify image exists and is pullable');
        solutions.push('Check resource limits and requests');
      }
      if (error.includes('ImagePullBackOff')) {
        possibleCauses.push('Cannot pull container image');
        solutions.push('Verify image name and tag');
        solutions.push('Check image registry credentials (imagePullSecrets)');
      }
    }

    if (context === 'docker') {
      if (error.includes('no space left on device')) {
        possibleCauses.push('Docker disk space exhausted');
        solutions.push('Clean up: `docker system prune -a`');
        solutions.push('Remove unused images: `docker image prune`');
      }
    }

    if (possibleCauses.length === 0) {
      analysis.push('No specific pattern matched. Consider:');
      analysis.push('- Searching the error message in documentation');
      analysis.push('- Checking application logs for more context');
      analysis.push('- Verifying configuration and environment variables');
    }

    let result = `## Error Analysis\n\n`;
    result += `**Context:** ${context}\n\n`;
    
    if (possibleCauses.length > 0) {
      result += `### Possible Causes\n`;
      possibleCauses.forEach(cause => result += `- ${cause}\n`);
      result += '\n';
    }
    
    if (solutions.length > 0) {
      result += `### Suggested Solutions\n`;
      solutions.forEach((solution, i) => result += `${i + 1}. ${solution}\n`);
      result += '\n';
    }
    
    if (analysis.length > 0) {
      result += `### Notes\n`;
      analysis.forEach(note => result += `${note}\n`);
    }

    return result;
  },
};

/**
 * Export all DevOps tools
 */
export const devopsTools: Tool[] = [
  readFileTool,
  listDirectoryTool,
  analyzeConfigTool,
  analyzeErrorTool,
];

export function getToolByName(name: string): Tool | undefined {
  return devopsTools.find(tool => tool.name === name);
}
