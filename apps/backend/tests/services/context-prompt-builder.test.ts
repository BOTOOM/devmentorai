/**
 * Context Prompt Builder Tests
 * 
 * Tests for the context-aware prompt building service.
 * 
 * PHASE 3: These tests verify that:
 * - Prompts contain FACTUAL context only
 * - NO intent instructions are included (agent decides)
 * - NO emoji severity indicators (agent interprets)
 * - systemPrompt is always null (don't override Copilot)
 */

import { describe, it, expect } from 'vitest';
import {
  buildContextAwarePrompt,
  buildSimplePrompt,
  validateContext,
  sanitizeContext,
} from '../../src/services/context-prompt-builder.ts';
import type { ContextPayload } from '@devmentorai/shared';

// Helper to create a minimal valid context
function createMockContext(overrides: Partial<ContextPayload> = {}): ContextPayload {
  return {
    metadata: {
      version: '1.0',
      extractedAt: new Date().toISOString(),
      extractionTimeMs: 50,
      partialExtraction: false,
    },
    page: {
      url: 'https://portal.azure.com/#blade/Microsoft_Azure_Compute/VirtualMachineInstance',
      hostname: 'portal.azure.com',
      title: 'Virtual Machines - Microsoft Azure',
      urlParsed: {
        protocol: 'https:',
        pathname: '/',
        search: '',
        hash: '#blade/Microsoft_Azure_Compute/VirtualMachineInstance',
      },
      platform: {
        type: 'azure',
        confidence: 0.9,
        specificProduct: 'Azure Virtual Machines',
        signals: ['url pattern', 'hostname'],
      },
    },
    text: {
      selectedText: undefined,
      visibleText: 'Create virtual machine\nSize: Standard_D2s_v3\nStatus: Running',
      headings: [
        { level: 1, text: 'Virtual Machines', hierarchy: 'Virtual Machines' },
        { level: 2, text: 'Create a virtual machine', hierarchy: 'Virtual Machines > Create a virtual machine' },
      ],
      errors: [],
    },
    structure: {
      relevantSections: [],
      forms: [],
    },
    session: {
      sessionId: 'test-session-123',
      sessionType: 'devops',
      intent: {
        primary: 'help',
        confidence: 0.8,
        signals: ['how to', 'help'],
      },
      previousMessages: {
        count: 0,
        lastN: [],
      },
    },
    ...overrides,
  };
}

describe('Context Prompt Builder', () => {
  describe('buildContextAwarePrompt', () => {
    it('should build a factual prompt with errors (Phase 3: no intent instructions)', () => {
      const context = createMockContext({
        session: {
          sessionId: 'test',
          sessionType: 'devops',
          intent: { primary: 'debug', confidence: 0.9, signals: ['error'] },
          previousMessages: { count: 0, lastN: [] },
        },
        text: {
          selectedText: undefined,
          visibleText: 'Error: Resource not found',
          headings: [],
          errors: [
            {
              message: 'Resource not found',
              type: 'error',
              severity: 'high',
              source: 'Azure Portal',
            },
          ],
        },
      });

      const result = buildContextAwarePrompt(context, 'Why is this error happening?');

      // systemPrompt is null - we don't override Copilot's default
      expect(result.systemPrompt).toBeNull();
      // Phase 3: NO intent instructions, just factual context
      expect(result.userPrompt).not.toContain('**Task:**');
      expect(result.userPrompt).not.toContain('root cause'); // No instructions
      // But factual error data IS included
      expect(result.userPrompt).toContain('## Errors and Alerts');
      expect(result.userPrompt).toContain('Resource not found');
      expect(result.userPrompt).toContain('Why is this error happening?');
    });

    it('should build a factual prompt (Phase 3: agent decides what to do)', () => {
      const context = createMockContext({
        session: {
          sessionId: 'test',
          sessionType: 'devops',
          intent: { primary: 'mentor', confidence: 0.85, signals: ['teach', 'best practice'] },
          previousMessages: { count: 0, lastN: [] },
        },
      });

      const result = buildContextAwarePrompt(context, 'Teach me about Kubernetes');

      // systemPrompt is null - we don't override Copilot's default
      expect(result.systemPrompt).toBeNull();
      // Phase 3: NO intent instructions
      expect(result.userPrompt).not.toContain('**Task:**');
      // User message is included as-is
      expect(result.userPrompt).toContain('Teach me about Kubernetes');
    });

    it('should include platform-specific context for Azure', () => {
      const context = createMockContext();

      const result = buildContextAwarePrompt(context, 'How do I deploy?');

      // systemPrompt is null
      expect(result.systemPrompt).toBeNull();
      // Platform notes are in userPrompt (factual locations)
      expect(result.userPrompt).toContain('Azure');
    });

    it('should include platform-specific context for AWS', () => {
      const context = createMockContext({
        page: {
          url: 'https://console.aws.amazon.com/ec2/v2/home',
          hostname: 'console.aws.amazon.com',
          title: 'EC2 Dashboard - AWS',
          urlParsed: { protocol: 'https:', pathname: '/ec2/v2/home', search: '', hash: '' },
          platform: {
            type: 'aws',
            confidence: 0.95,
            specificProduct: 'AWS EC2',
            signals: ['hostname'],
          },
        },
      });

      const result = buildContextAwarePrompt(context, 'How do I launch an instance?');

      // systemPrompt is null
      expect(result.systemPrompt).toBeNull();
      // Platform notes are in userPrompt
      expect(result.userPrompt).toContain('AWS');
      expect(result.userPrompt).toContain('CloudWatch');
    });

    it('should include selected text when present', () => {
      const context = createMockContext({
        text: {
          selectedText: 'apiVersion: apps/v1',
          visibleText: 'Full YAML config here',
          headings: [],
          errors: [],
        },
      });

      const result = buildContextAwarePrompt(context, 'Is this correct?');

      expect(result.userPrompt).toContain('## User Selected Text');
      expect(result.userPrompt).toContain('apiVersion: apps/v1');
    });

    it('should include headings when present', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Page content',
          headings: [
            { level: 1, text: 'Overview', hierarchy: 'Overview' },
            { level: 2, text: 'Configuration', hierarchy: 'Overview > Configuration' },
            { level: 2, text: 'Networking', hierarchy: 'Overview > Networking' },
          ],
          errors: [],
        },
      });

      const result = buildContextAwarePrompt(context, 'What are the sections?');

      expect(result.userPrompt).toContain('## Page Structure');
      expect(result.userPrompt).toContain('Overview');
      expect(result.userPrompt).toContain('Configuration');
    });

    it('should include previous messages history', () => {
      const context = createMockContext({
        session: {
          sessionId: 'test',
          sessionType: 'devops',
          intent: { primary: 'help', confidence: 0.8, signals: [] },
          previousMessages: {
            count: 2,
            lastN: [
              { role: 'user', content: 'How do I set up CI/CD?' },
              { role: 'assistant', content: 'You can use GitHub Actions...' },
            ],
          },
        },
      });

      const result = buildContextAwarePrompt(context, 'What about deployment?');

      expect(result.userPrompt).toContain('## Recent Conversation');
      expect(result.userPrompt).toContain('How do I set up CI/CD?');
    });

    it('should truncate long prompts while preserving user message', () => {
      const longContent = 'A'.repeat(10000);
      const context = createMockContext({
        text: {
          selectedText: longContent,
          visibleText: longContent,
          headings: [],
          errors: [],
        },
      });

      const result = buildContextAwarePrompt(context, 'My important question', {
        maxContextLength: 2000,
      });

      expect(result.userPrompt.length).toBeLessThanOrEqual(2500); // Some buffer
      expect(result.userPrompt).toContain('My important question');
      expect(result.userPrompt).toContain('[Context truncated for length]');
    });

    it('should use options to exclude content', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Content',
          headings: [{ level: 1, text: 'Test', hierarchy: 'Test' }],
          errors: [{ message: 'Error', type: 'error', severity: 'medium' }],
        },
      });

      const result = buildContextAwarePrompt(context, 'Test', {
        includeErrors: false,
        includeStructure: false,
        includePlatformNotes: false,
      });

      expect(result.systemPrompt).toBeNull();
      expect(result.userPrompt).not.toContain('## Errors');
      expect(result.userPrompt).not.toContain('## Page Structure');
    });
  });

  describe('buildSimplePrompt', () => {
    it('should build a simple prompt with all parameters', () => {
      const result = buildSimplePrompt(
        'How do I deploy?',
        'https://example.com/deploy',
        'Deployment Dashboard',
        'npm run deploy'
      );

      // systemPrompt is null - we don't override Copilot's default
      expect(result.systemPrompt).toBeNull();
      expect(result.userPrompt).toContain('https://example.com/deploy');
      expect(result.userPrompt).toContain('Deployment Dashboard');
      expect(result.userPrompt).toContain('npm run deploy');
      expect(result.userPrompt).toContain('How do I deploy?');
    });

    it('should build a simple prompt with only user message', () => {
      const result = buildSimplePrompt('What is Kubernetes?');

      // systemPrompt is null - we don't override Copilot's default
      expect(result.systemPrompt).toBeNull();
      expect(result.userPrompt).toBe('What is Kubernetes?');
    });

    it('should handle undefined optional parameters', () => {
      const result = buildSimplePrompt('Test', undefined, undefined, undefined);

      expect(result.systemPrompt).toBeNull();
      expect(result.userPrompt).toBe('Test');
    });
  });

  describe('validateContext', () => {
    it('should return true for valid context', () => {
      const context = createMockContext();
      expect(validateContext(context)).toBe(true);
    });

    it('should return false for null', () => {
      expect(validateContext(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(validateContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validateContext('string')).toBe(false);
      expect(validateContext(123)).toBe(false);
    });

    it('should return false for missing metadata', () => {
      const context = createMockContext();
      delete (context as Record<string, unknown>).metadata;
      expect(validateContext(context)).toBe(false);
    });

    it('should return false for missing page', () => {
      const context = createMockContext();
      delete (context as Record<string, unknown>).page;
      expect(validateContext(context)).toBe(false);
    });

    it('should return false for missing text', () => {
      const context = createMockContext();
      delete (context as Record<string, unknown>).text;
      expect(validateContext(context)).toBe(false);
    });

    it('should return false for missing session', () => {
      const context = createMockContext();
      delete (context as Record<string, unknown>).session;
      expect(validateContext(context)).toBe(false);
    });
  });

  describe('sanitizeContext', () => {
    it('should redact Bearer tokens from visible text', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          headings: [],
          errors: [],
        },
      });

      const sanitized = sanitizeContext(context);

      expect(sanitized.text.visibleText).toContain('[REDACTED]');
      expect(sanitized.text.visibleText).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact API keys from visible text', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'api_key=sk-1234567890abcdef',
          headings: [],
          errors: [],
        },
      });

      const sanitized = sanitizeContext(context);

      expect(sanitized.text.visibleText).toContain('[REDACTED]');
      expect(sanitized.text.visibleText).not.toContain('sk-1234567890abcdef');
    });

    it('should redact sensitive URL parameters', () => {
      const context = createMockContext({
        page: {
          url: 'https://example.com/api?token=secret123&key=api-key-456',
          hostname: 'example.com',
          title: 'API Test',
          urlParsed: {
            protocol: 'https:',
            pathname: '/api',
            search: '?token=secret123&key=api-key-456',
            hash: '',
          },
          platform: { type: 'generic', confidence: 0.5, signals: [] },
        },
      });

      const sanitized = sanitizeContext(context);

      // URL encoding may encode the brackets, so check for both possibilities
      const hasTokenRedacted = sanitized.page.url.includes('token=[REDACTED]') || 
                               sanitized.page.url.includes('token=%5BREDACTED%5D');
      const hasKeyRedacted = sanitized.page.url.includes('key=[REDACTED]') || 
                             sanitized.page.url.includes('key=%5BREDACTED%5D');
      
      expect(hasTokenRedacted).toBe(true);
      expect(hasKeyRedacted).toBe(true);
      expect(sanitized.page.url).not.toContain('secret123');
      expect(sanitized.page.url).not.toContain('api-key-456');
    });

    it('should preserve non-sensitive data', () => {
      const context = createMockContext({
        text: {
          selectedText: 'kubectl get pods',
          visibleText: 'Normal command output without secrets',
          headings: [{ level: 1, text: 'Deployment', hierarchy: 'Deployment' }],
          errors: [],
        },
      });

      const sanitized = sanitizeContext(context);

      expect(sanitized.text.visibleText).toBe('Normal command output without secrets');
      expect(sanitized.text.selectedText).toBe('kubectl get pods');
      expect(sanitized.text.headings[0].text).toBe('Deployment');
    });

    it('should not modify the original context', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'password=secret123',
          headings: [],
          errors: [],
        },
      });

      const originalText = context.text.visibleText;
      sanitizeContext(context);

      expect(context.text.visibleText).toBe(originalText);
    });
  });

  describe('Error formatting (Phase 3: factual, no emojis)', () => {
    it('should format critical errors factually without icons', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Error occurred',
          headings: [],
          errors: [
            { message: 'Critical system failure', type: 'error', severity: 'critical' },
          ],
        },
      });

      const result = buildContextAwarePrompt(context, 'What happened?');

      // Phase 3: NO emojis, just factual severity labels
      expect(result.userPrompt).not.toContain('🔴');
      expect(result.userPrompt).toContain('[CRITICAL]');
      expect(result.userPrompt).toContain('Critical system failure');
    });

    it('should format multiple errors with severity labels only', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Multiple issues',
          headings: [],
          errors: [
            { message: 'Critical error', type: 'error', severity: 'critical' },
            { message: 'High priority warning', type: 'warning', severity: 'high' },
            { message: 'Medium notice', type: 'info', severity: 'medium' },
            { message: 'Low info', type: 'info', severity: 'low' },
          ],
        },
      });

      const result = buildContextAwarePrompt(context, 'What are all the issues?');

      // Phase 3: NO emojis, factual labels
      expect(result.userPrompt).not.toContain('🔴');
      expect(result.userPrompt).not.toContain('🟠');
      expect(result.userPrompt).not.toContain('🟡');
      expect(result.userPrompt).not.toContain('🟢');
      expect(result.userPrompt).toContain('[CRITICAL]');
      expect(result.userPrompt).toContain('[HIGH]');
      expect(result.userPrompt).toContain('[MEDIUM]');
      expect(result.userPrompt).toContain('[LOW]');
      expect(result.userPrompt).toContain('4 issue(s)');
    });

    it('should include error source and context when available', () => {
      const context = createMockContext({
        text: {
          selectedText: undefined,
          visibleText: 'Error details',
          headings: [],
          errors: [
            {
              message: 'Connection timeout',
              type: 'error',
              severity: 'high',
              source: 'Network Module',
              context: 'Attempting to connect to database',
            },
          ],
        },
      });

      const result = buildContextAwarePrompt(context, 'Why the timeout?');

      expect(result.userPrompt).toContain('Source: Network Module');
      expect(result.userPrompt).toContain('Context: Attempting to connect to database');
    });
  });

  // ============================================================================
  // Phase 2 Tests
  // ============================================================================

  describe('Phase 2: Console Logs (Phase 3: factual format)', () => {
    it('should include console error logs in prompt factually', () => {
      const context = createMockContext();
      context.text.consoleLogs = [
        { level: 'error', message: 'Uncaught TypeError: Cannot read property of undefined', timestamp: '2024-01-01T12:00:00Z' },
        { level: 'warn', message: 'Deprecation warning: This API will be removed', timestamp: '2024-01-01T12:00:01Z' },
      ];

      const result = buildContextAwarePrompt(context, 'What are the errors?');

      expect(result.userPrompt).toContain('## Browser Console Logs');
      expect(result.userPrompt).toContain('Uncaught TypeError');
      expect(result.userPrompt).toContain('Deprecation warning');
      expect(result.userPrompt).toContain('2 error/warning message(s)');
    });

    it('should include stack trace for errors', () => {
      const context = createMockContext();
      context.text.consoleLogs = [
        { 
          level: 'error', 
          message: 'Error in component', 
          timestamp: '2024-01-01T12:00:00Z',
          stackTrace: 'at Component.render (app.js:123)\n  at Object.updateComponent (react.js:456)'
        },
      ];

      const result = buildContextAwarePrompt(context, 'Debug this');

      expect(result.userPrompt).toContain('Stack:');
      expect(result.userPrompt).toContain('Component.render');
    });

    it('should exclude info/debug logs from error section', () => {
      const context = createMockContext();
      context.text.consoleLogs = [
        { level: 'info', message: 'App started', timestamp: '2024-01-01T12:00:00Z' },
        { level: 'debug', message: 'Debug info', timestamp: '2024-01-01T12:00:01Z' },
        { level: 'log', message: 'Normal log', timestamp: '2024-01-01T12:00:02Z' },
      ];

      const result = buildContextAwarePrompt(context, 'Check logs');

      // Should not include console logs section since no errors/warnings
      expect(result.userPrompt).not.toContain('## Browser Console Logs');
    });
  });

  describe('Phase 2: Network Errors (Phase 3: factual format)', () => {
    it('should include network errors in prompt factually', () => {
      const context = createMockContext();
      context.text.networkErrors = [
        { url: 'https://api.example.com/users', method: 'GET', status: 404, statusText: 'Not Found', timestamp: '2024-01-01T12:00:00Z' },
        { url: 'https://api.example.com/posts', method: 'POST', status: 500, statusText: 'Internal Server Error', timestamp: '2024-01-01T12:00:01Z' },
      ];

      const result = buildContextAwarePrompt(context, 'Why are requests failing?');

      expect(result.userPrompt).toContain('## Network Requests Failed');
      expect(result.userPrompt).toContain('2 failed request(s)');
      expect(result.userPrompt).toContain('api.example.com/users');
      expect(result.userPrompt).toContain('HTTP 404');
      expect(result.userPrompt).toContain('HTTP 500');
    });

    it('should include network errors without status', () => {
      const context = createMockContext();
      context.text.networkErrors = [
        { url: 'https://api.example.com/data', method: 'GET', errorMessage: 'Network request failed', timestamp: '2024-01-01T12:00:00Z' },
      ];

      const result = buildContextAwarePrompt(context, 'Network issue');

      expect(result.userPrompt).toContain('Network request failed');
    });
  });

  describe('Phase 2: Code Blocks', () => {
    it('should include code blocks in prompt', () => {
      const context = createMockContext();
      context.structure.codeBlocks = [
        { 
          purpose: 'code-block', 
          outerHTML: '<pre><code>const x = 1;</code></pre>',
          textContent: 'const x = 1;',
          attributes: { detectedLanguage: 'javascript' }
        },
        { 
          purpose: 'code-block', 
          outerHTML: '<pre><code>apiVersion: v1</code></pre>',
          textContent: 'apiVersion: v1\nkind: Pod',
          attributes: { detectedLanguage: 'yaml' }
        },
      ];

      const result = buildContextAwarePrompt(context, 'Check this code');

      expect(result.userPrompt).toContain('## Code Snippets');
      expect(result.userPrompt).toContain('JAVASCRIPT');
      expect(result.userPrompt).toContain('const x = 1');
      expect(result.userPrompt).toContain('YAML');
      expect(result.userPrompt).toContain('apiVersion');
    });
  });

  describe('Phase 2: Tables', () => {
    it('should include tables in prompt', () => {
      const context = createMockContext();
      context.structure.tables = [
        { 
          purpose: 'table', 
          outerHTML: '<table>...</table>',
          textContent: 'Name | Status | Age\nPod-1 | Running | 5d',
          attributes: { rowCount: '10', columnCount: '3' }
        },
      ];

      const result = buildContextAwarePrompt(context, 'Explain this table');

      expect(result.userPrompt).toContain('## Data Tables');
      expect(result.userPrompt).toContain('10 rows × 3 cols');
      expect(result.userPrompt).toContain('Name | Status | Age');
    });
  });

  describe('Phase 2: Modal Content', () => {
    it('should include modal content with high priority', () => {
      const context = createMockContext();
      context.structure.modal = {
        purpose: 'modal',
        outerHTML: '<div role="dialog">...</div>',
        textContent: 'Confirm deletion\n\nAre you sure you want to delete this resource?',
        attributes: { title: 'Delete Resource' }
      };

      const result = buildContextAwarePrompt(context, 'What is this dialog asking?');

      expect(result.userPrompt).toContain('## Active Modal/Dialog');
      expect(result.userPrompt).toContain('Delete Resource');
      expect(result.userPrompt).toContain('Confirm deletion');
    });
  });

  describe('Phase 2: Platform-Specific Context', () => {
    it('should include Azure-specific context', () => {
      const context = createMockContext({
        page: {
          url: 'https://portal.azure.com/#blade/VMs',
          hostname: 'portal.azure.com',
          title: 'Virtual Machines',
          urlParsed: { protocol: 'https:', pathname: '/', search: '', hash: '#blade/VMs' },
          platform: {
            type: 'azure',
            confidence: 0.95,
            signals: ['hostname'],
            specificProduct: 'Azure Virtual Machines',
            specificContext: {
              subscriptionId: 'sub-12345',
              resourceGroup: 'my-resource-group',
              bladeName: 'VirtualMachines'
            }
          },
        },
      });

      const result = buildContextAwarePrompt(context, 'Show me the details');

      expect(result.userPrompt).toContain('## Platform-Specific Details');
      expect(result.userPrompt).toContain('subscriptionId');
      expect(result.userPrompt).toContain('sub-12345');
      expect(result.userPrompt).toContain('resourceGroup');
    });

    it('should include AWS-specific context', () => {
      const context = createMockContext({
        page: {
          url: 'https://console.aws.amazon.com/ec2',
          hostname: 'console.aws.amazon.com',
          title: 'EC2 Dashboard',
          urlParsed: { protocol: 'https:', pathname: '/ec2', search: '?region=us-east-1', hash: '' },
          platform: {
            type: 'aws',
            confidence: 0.95,
            signals: ['hostname'],
            specificProduct: 'AWS EC2',
            specificContext: {
              service: 'ec2',
              region: 'us-east-1',
              activeAlarms: 2
            }
          },
        },
      });

      const result = buildContextAwarePrompt(context, 'What alarms are active?');

      expect(result.userPrompt).toContain('## Platform-Specific Details');
      expect(result.userPrompt).toContain('region');
      expect(result.userPrompt).toContain('us-east-1');
      expect(result.userPrompt).toContain('activeAlarms');
    });
  });

  describe('Phase 2: Options Control (Phase 3 compatible)', () => {
    it('should exclude Phase 2 content when options are disabled', () => {
      const context = createMockContext();
      context.text.consoleLogs = [
        { level: 'error', message: 'Test error', timestamp: '2024-01-01T12:00:00Z' }
      ];
      context.text.networkErrors = [
        { url: 'https://api.example.com', method: 'GET', status: 500, timestamp: '2024-01-01T12:00:00Z' }
      ];
      context.structure.codeBlocks = [
        { purpose: 'code-block', outerHTML: '<code/>', textContent: 'code', attributes: {} }
      ];
      context.structure.tables = [
        { purpose: 'table', outerHTML: '<table/>', textContent: 'data', attributes: {} }
      ];
      context.structure.modal = {
        purpose: 'modal', outerHTML: '<div/>', textContent: 'modal', attributes: {}
      };

      const result = buildContextAwarePrompt(context, 'Test', {
        includeConsoleLogs: false,
        includeNetworkErrors: false,
        includeCodeBlocks: false,
        includeTables: false,
        includeModal: false,
      });

      expect(result.userPrompt).not.toContain('## Browser Console Logs');
      expect(result.userPrompt).not.toContain('## Network Requests Failed');
      expect(result.userPrompt).not.toContain('## Code Snippets');
      expect(result.userPrompt).not.toContain('## Data Tables');
      expect(result.userPrompt).not.toContain('## Active Modal');
    });
  });
});
