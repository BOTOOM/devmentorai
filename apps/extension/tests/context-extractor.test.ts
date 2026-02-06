/**
 * Unit tests for context-extractor.ts
 * Tests privacy masking, UI state analysis, and helper functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// We'll test the exported functions that don't require full browser APIs
import {
  maskSensitiveData,
  analyzeUIState,
  startRuntimeErrorCapture,
  stopRuntimeErrorCapture,
  getCapturedRuntimeErrors,
  clearCapturedRuntimeErrors,
} from '../src/lib/context-extractor';

describe('context-extractor', () => {
  describe('maskSensitiveData', () => {
    it('should mask email addresses', () => {
      const input = 'Contact us at john.doe@example.com for support';
      const result = maskSensitiveData(input);
      expect(result).toBe('Contact us at [EMAIL_REDACTED] for support');
    });

    it('should mask multiple email addresses', () => {
      const input = 'From: alice@test.com To: bob@company.org';
      const result = maskSensitiveData(input);
      expect(result).toBe('From: [EMAIL_REDACTED] To: [EMAIL_REDACTED]');
    });

    it('should mask JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const input = `Bearer ${jwt}`;
      const result = maskSensitiveData(input);
      expect(result).toContain('[JWT_REDACTED]');
    });

    it('should mask AWS ARNs', () => {
      const input = 'Resource: arn:aws:s3:us-west-2:123456789012:bucket/my-bucket';
      const result = maskSensitiveData(input);
      expect(result).toContain('[AWS_ARN_REDACTED]');
    });

    it('should mask Azure resource IDs', () => {
      const input = 'Resource: /subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/myVM';
      const result = maskSensitiveData(input);
      expect(result).toContain('[AZURE_RESOURCE_REDACTED]');
    });

    it('should mask credit card numbers', () => {
      const input = 'Card: 4111-1111-1111-1111';
      const result = maskSensitiveData(input);
      expect(result).toContain('[CARD_REDACTED]');
    });

    it('should mask SSN', () => {
      const input = 'SSN: 123-45-6789';
      const result = maskSensitiveData(input);
      expect(result).toContain('[SSN_REDACTED]');
    });

    it('should mask phone numbers', () => {
      const input = 'Call us at (555) 123-4567 or 555-987-6543';
      const result = maskSensitiveData(input);
      expect(result).toContain('[PHONE_REDACTED]');
    });

    it('should mask internal IP addresses', () => {
      const input = 'Server: 192.168.1.100 or 10.0.0.1';
      const result = maskSensitiveData(input);
      expect(result).toContain('[INTERNAL_IP]');
      expect(result).not.toContain('192.168.1.100');
      expect(result).not.toContain('10.0.0.1');
    });

    it('should preserve public IP addresses', () => {
      const input = 'Public DNS: 8.8.8.8';
      const result = maskSensitiveData(input);
      // Public IPs should not be masked
      expect(result).toContain('8.8.8.8');
    });

    it('should mask API keys', () => {
      const input = 'api_key=sk_live_abcdefghijklmnopqrstuvwxyz123456';
      const result = maskSensitiveData(input);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('sk_live_abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should mask access tokens', () => {
      // The regex uses [:\s=] so "access_token=" works, not "access_token:"
      const input = 'access_token=ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXX12345';
      const result = maskSensitiveData(input);
      expect(result).toContain('[REDACTED]');
    });

    it('should handle text without sensitive data', () => {
      const input = 'Hello, this is a normal message without secrets.';
      const result = maskSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      const result = maskSensitiveData('');
      expect(result).toBe('');
    });

    it('should handle multiple different types of sensitive data', () => {
      const input = 'User john@test.com with SSN 123-45-6789 has API key api_key=mysecretkey12345678901234567890';
      const result = maskSensitiveData(input);
      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).toContain('[SSN_REDACTED]');
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('analyzeUIState', () => {
    let dom: JSDOM;
    let originalDocument: Document;
    let originalWindow: Window & typeof globalThis;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
      });
      originalDocument = globalThis.document;
      originalWindow = globalThis.window;
      
      // Setup global document and window for the tests
      (globalThis as any).document = dom.window.document;
      (globalThis as any).window = dom.window;
    });

    afterEach(() => {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    });

    it('should detect loading indicators', () => {
      document.body.innerHTML = `
        <div class="loading-spinner">Loading...</div>
        <div class="skeleton">...</div>
        <div aria-busy="true">Processing</div>
      `;
      
      const result = analyzeUIState();
      expect(result.loadingIndicators).toBeGreaterThan(0);
      expect(result.pageState).toBe('loading');
    });

    it('should detect disabled buttons', () => {
      document.body.innerHTML = `
        <button disabled>Submit</button>
        <button disabled>Cancel</button>
        <input type="submit" disabled value="Go" />
      `;
      
      const result = analyzeUIState();
      expect(result.disabledButtons).toBe(3);
    });

    it('should detect empty states', () => {
      document.body.innerHTML = `
        <div class="empty-state">No data available</div>
        <div class="no-results">0 results found</div>
      `;
      
      const result = analyzeUIState();
      expect(result.emptyStates).toBeGreaterThan(0);
    });

    it('should detect error states', () => {
      document.body.innerHTML = `
        <div class="error-state">Something went wrong</div>
        <div class="error-boundary">Error occurred</div>
      `;
      
      const result = analyzeUIState();
      expect(result.errorStates).toBeGreaterThan(0);
      expect(result.pageState).toBe('error');
    });

    it('should detect toast notifications', () => {
      document.body.innerHTML = `
        <div class="toast">Message sent</div>
        <div role="alert">Warning!</div>
      `;
      
      const result = analyzeUIState();
      expect(result.toastNotifications).toBeGreaterThan(0);
    });

    it('should detect open modals', () => {
      document.body.innerHTML = `
        <div role="dialog" aria-modal="true">Modal content</div>
      `;
      
      const result = analyzeUIState();
      expect(result.modalOpen).toBe(true);
    });

    it('should detect form validation errors', () => {
      document.body.innerHTML = `
        <input type="text" aria-invalid="true" />
        <div class="validation-error">Required field</div>
      `;
      
      const result = analyzeUIState();
      expect(result.formValidationErrors).toBeGreaterThan(0);
    });

    it('should count interactive elements', () => {
      document.body.innerHTML = `
        <button>Click me</button>
        <button>Another button</button>
        <a href="/page">Link</a>
        <input type="text" />
        <textarea></textarea>
        <select><option>Option</option></select>
      `;
      
      const result = analyzeUIState();
      expect(result.interactiveElements.buttons).toBe(2);
      expect(result.interactiveElements.links).toBe(1);
      expect(result.interactiveElements.inputs).toBe(3);
    });

    it('should return normal page state for clean page', () => {
      document.body.innerHTML = `
        <h1>Welcome</h1>
        <p>This is a normal page.</p>
        <button>Click me</button>
      `;
      
      // jsdom's document.readyState is 'complete' by default
      const result = analyzeUIState();
      expect(result.pageState).toBe('normal');
    });
  });

  describe('Runtime Error Capture', () => {
    let dom: JSDOM;
    let originalWindow: Window & typeof globalThis;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
      });
      originalWindow = globalThis.window;
      (globalThis as any).window = dom.window;
      
      // Clear any previously captured errors
      clearCapturedRuntimeErrors();
    });

    afterEach(() => {
      stopRuntimeErrorCapture();
      (globalThis as any).window = originalWindow;
    });

    it('should start and stop error capture', () => {
      expect(() => startRuntimeErrorCapture()).not.toThrow();
      expect(() => stopRuntimeErrorCapture()).not.toThrow();
    });

    it('should return empty array when no errors captured', () => {
      startRuntimeErrorCapture();
      const errors = getCapturedRuntimeErrors();
      expect(errors).toEqual([]);
    });

    it('should clear captured errors', () => {
      startRuntimeErrorCapture();
      // Simulate an error by manually triggering onerror
      if (window.onerror) {
        (window.onerror as any)('Test error', 'test.js', 1, 1, new Error('Test'));
      }
      
      clearCapturedRuntimeErrors();
      const errors = getCapturedRuntimeErrors();
      expect(errors).toEqual([]);
    });

    it('should capture errors when capture is active', () => {
      startRuntimeErrorCapture();
      
      // Trigger onerror manually
      if (window.onerror) {
        (window.onerror as any)('Test error message', 'script.js', 10, 5, new Error('Test'));
      }
      
      const errors = getCapturedRuntimeErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error message');
      expect(errors[0].source).toBe('script.js');
      expect(errors[0].lineno).toBe(10);
      expect(errors[0].colno).toBe(5);
      expect(errors[0].type).toBe('error');
    });

    it('should capture unhandled promise rejections', () => {
      startRuntimeErrorCapture();
      
      // Trigger onunhandledrejection manually
      if (window.onunhandledrejection) {
        const event = {
          reason: { message: 'Promise rejected', stack: 'Error stack' },
        } as PromiseRejectionEvent;
        (window.onunhandledrejection as any)(event);
      }
      
      const errors = getCapturedRuntimeErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Promise rejected');
      expect(errors[0].type).toBe('unhandledrejection');
    });

    it('should not capture errors after stopping', () => {
      startRuntimeErrorCapture();
      stopRuntimeErrorCapture();
      
      // Try to trigger an error
      const originalOnerror = window.onerror;
      if (originalOnerror) {
        (originalOnerror as any)('Should not be captured', 'test.js', 1, 1, null);
      }
      
      const errors = getCapturedRuntimeErrors();
      // Errors shouldn't be added after stopping
      expect(errors.length).toBe(0);
    });
  });
});
