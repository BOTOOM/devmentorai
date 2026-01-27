import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { 
  readFileTool, 
  listDirectoryTool, 
  analyzeConfigTool, 
  analyzeErrorTool,
  devopsTools,
  getToolByName,
} from '../../src/tools/devops-tools.js';

describe('DevOps Tools', () => {
  let testDir: string;
  let testFile: string;

  beforeAll(async () => {
    // Create temp test directory
    testDir = path.join(os.tmpdir(), 'devmentorai-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test file
    testFile = path.join(testDir, 'test.txt');
    await fs.writeFile(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Registry', () => {
    it('should have 4 tools registered', () => {
      expect(devopsTools).toHaveLength(4);
    });

    it('should find tool by name', () => {
      const tool = getToolByName('read_file');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('read_file');
    });

    it('should return undefined for unknown tool', () => {
      const tool = getToolByName('unknown_tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('read_file tool', () => {
    it('should read file contents', async () => {
      const result = await readFileTool.handler({ path: testFile });
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 5');
    });

    it('should respect maxLines parameter', async () => {
      const result = await readFileTool.handler({ path: testFile, maxLines: 2 });
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('[Truncated:');
    });

    it('should return error for non-existent file', async () => {
      const result = await readFileTool.handler({ path: '/tmp/nonexistent-file-12345.txt' });
      expect(result).toContain('Error: File not found');
    });

    it('should deny access to restricted paths', async () => {
      const result = await readFileTool.handler({ path: '/etc/passwd' });
      expect(result).toContain('Access denied');
    });
  });

  describe('list_directory tool', () => {
    it('should list directory contents', async () => {
      const result = await listDirectoryTool.handler({ path: testDir });
      expect(result).toContain('test.txt');
    });

    it('should show file sizes', async () => {
      const result = await listDirectoryTool.handler({ path: testDir });
      expect(result).toMatch(/📄.*test\.txt.*\(/);
    });

    it('should deny access to restricted paths', async () => {
      const result = await listDirectoryTool.handler({ path: '/etc' });
      expect(result).toContain('Access denied');
    });
  });

  describe('analyze_config tool', () => {
    it('should analyze Kubernetes config', async () => {
      const k8sConfig = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: test
    image: nginx:latest
`;
      const result = await analyzeConfigTool.handler({ 
        content: k8sConfig, 
        type: 'kubernetes' 
      });
      expect(result).toContain('kubernetes');
      expect(result).toContain(':latest');
    });

    it('should auto-detect Kubernetes config', async () => {
      const k8sConfig = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
`;
      const result = await analyzeConfigTool.handler({ 
        content: k8sConfig, 
        type: 'auto' 
      });
      expect(result).toContain('kubernetes');
    });

    it('should analyze Dockerfile', async () => {
      const dockerfile = `
FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN apt-get install -y vim
RUN apt-get install -y git
COPY . /app
`;
      const result = await analyzeConfigTool.handler({ 
        content: dockerfile, 
        type: 'docker' 
      });
      expect(result).toContain('docker');
      expect(result).toContain(':latest');
      // Check for either specific mention or related suggestion
      expect(result).toMatch(/RUN|USER|COPY/);
    });

    it('should analyze Terraform config', async () => {
      const tfConfig = `
provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
}
`;
      const result = await analyzeConfigTool.handler({ 
        content: tfConfig, 
        type: 'terraform' 
      });
      expect(result).toContain('terraform');
      expect(result).toContain('version constraints');
    });

    it('should analyze GitHub Actions', async () => {
      const workflow = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout
    - run: npm install
    - run: npm test
`;
      const result = await analyzeConfigTool.handler({ 
        content: workflow, 
        type: 'github-actions' 
      });
      expect(result).toContain('github-actions');
      expect(result).toContain('version pinning');
    });
  });

  describe('analyze_error tool', () => {
    it('should analyze permission denied error', async () => {
      const result = await analyzeErrorTool.handler({
        error: 'permission denied: cannot access /var/log/system.log',
        context: 'linux',
      });
      expect(result).toContain('permission');
      expect(result).toContain('ls -la');
    });

    it('should analyze connection refused error', async () => {
      const result = await analyzeErrorTool.handler({
        error: 'ECONNREFUSED: Connection refused to localhost:5432',
        context: 'general',
      });
      expect(result).toContain('not running');
      expect(result).toContain('netstat');
    });

    it('should analyze Kubernetes CrashLoopBackOff', async () => {
      const result = await analyzeErrorTool.handler({
        error: 'Pod my-pod is in CrashLoopBackOff state',
        context: 'kubernetes',
      });
      // Check for diagnosis and solution
      expect(result).toContain('Container fails to start');
      expect(result).toContain('kubectl logs');
    });

    it('should analyze out of memory error', async () => {
      const result = await analyzeErrorTool.handler({
        error: 'Container was OOMKilled',
        context: 'kubernetes',
      });
      expect(result).toContain('memory');
    });

    it('should provide general guidance for unknown errors', async () => {
      const result = await analyzeErrorTool.handler({
        error: 'Some random error that does not match patterns',
        context: 'general',
      });
      expect(result).toContain('documentation');
    });
  });
});
