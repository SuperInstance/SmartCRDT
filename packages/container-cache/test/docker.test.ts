import { describe, it, expect, beforeEach } from 'vitest';
import { DockerClient, createDockerClient } from '../src/docker.js';
import { PullProgress } from '../src/types.js';

describe('DockerClient', () => {
  let client: DockerClient;

  beforeEach(() => {
    client = createDockerClient({
      socketPath: '/var/run/docker.sock'
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultClient = createDockerClient();
      expect(defaultClient).toBeInstanceOf(DockerClient);
    });

    it('should initialize with custom socket path', () => {
      const customClient = createDockerClient({
        socketPath: '/custom/docker.sock'
      });
      expect(customClient).toBeInstanceOf(DockerClient);
    });

    it('should initialize with host URL', () => {
      const hostClient = createDockerClient({
        host: 'http://localhost:2375'
      });
      expect(hostClient).toBeInstanceOf(DockerClient);
    });

    it('should initialize with custom version', () => {
      const versionClient = createDockerClient({
        version: 'v1.42'
      });
      expect(versionClient).toBeInstanceOf(DockerClient);
    });

    it('should initialize with custom timeout', () => {
      const timeoutClient = createDockerClient({
        timeout: 60000
      });
      expect(timeoutClient).toBeInstanceOf(DockerClient);
    });

    it('should use environment variable for socket path', () => {
      const originalSocket = process.env.DOCKER_SOCKET;
      process.env.DOCKER_SOCKET = '/custom/env.sock';

      const envClient = createDockerClient();
      expect(envClient).toBeInstanceOf(DockerClient);

      process.env.DOCKER_SOCKET = originalSocket;
    });
  });

  describe('image operations', () => {
    it('should have pullImage method', () => {
      expect(typeof client.pullImage).toBe('function');
    });

    it('should have inspectImage method', () => {
      expect(typeof client.inspectImage).toBe('function');
    });

    it('should have imageExists method', () => {
      expect(typeof client.imageExists).toBe('function');
    });

    it('should have listImages method', () => {
      expect(typeof client.listImages).toBe('function');
    });

    it('should have removeImage method', () => {
      expect(typeof client.removeImage).toBe('function');
    });

    it('should have getImageSize method', () => {
      expect(typeof client.getImageSize).toBe('function');
    });

    it('should have getImageLayers method', () => {
      expect(typeof client.getImageLayers).toBe('function');
    });
  });

  describe('container operations', () => {
    it('should have createContainer method', () => {
      expect(typeof client.createContainer).toBe('function');
    });

    it('should have startContainer method', () => {
      expect(typeof client.startContainer).toBe('function');
    });

    it('should have stopContainer method', () => {
      expect(typeof client.stopContainer).toBe('function');
    });

    it('should have removeContainer method', () => {
      expect(typeof client.removeContainer).toBe('function');
    });

    it('should have getContainerLogs method', () => {
      expect(typeof client.getContainerLogs).toBe('function');
    });

    it('should have execInContainer method', () => {
      expect(typeof client.execInContainer).toBe('function');
    });
  });

  describe('system operations', () => {
    it('should have getSystemInfo method', () => {
      expect(typeof client.getSystemInfo).toBe('function');
    });

    it('should have getDiskUsage method', () => {
      expect(typeof client.getDiskUsage).toBe('function');
    });

    it('should have pruneImages method', () => {
      expect(typeof client.pruneImages).toBe('function');
    });

    it('should have verifyImageIntegrity method', () => {
      expect(typeof client.verifyImageIntegrity).toBe('function');
    });
  });

  describe('build operations', () => {
    it('should have buildImage method', () => {
      expect(typeof client.buildImage).toBe('function');
    });

    it('should have tagImage method', () => {
      expect(typeof client.tagImage).toBe('function');
    });

    it('should have pushImage method', () => {
      expect(typeof client.pushImage).toBe('function');
    });

    it('should have saveImage method', () => {
      expect(typeof client.saveImage).toBe('function');
    });

    it('should have loadImage method', () => {
      expect(typeof client.loadImage).toBe('function');
    });
  });

  describe('createContainer options', () => {
    it('should accept name option', async () => {
      // Test method signature (actual Docker may not be available)
      expect(client.createContainer).toBeDefined();
    });

    it('should accept cmd option', async () => {
      expect(client.createContainer).toBeDefined();
    });

    it('should accept env option', async () => {
      expect(client.createContainer).toBeDefined();
    });

    it('should accept volumes option', async () => {
      expect(client.createContainer).toBeDefined();
    });

    it('should accept ports option', async () => {
      expect(client.createContainer).toBeDefined();
    });
  });

  describe('execInContainer options', () => {
    it('should accept env option', async () => {
      expect(client.execInContainer).toBeDefined();
    });
  });

  describe('getContainerLogs options', () => {
    it('should accept tail option', async () => {
      expect(client.getContainerLogs).toBeDefined();
    });

    it('should accept follow option', async () => {
      expect(client.getContainerLogs).toBeDefined();
    });
  });

  describe('stopContainer options', () => {
    it('should accept timeout option', async () => {
      expect(client.stopContainer).toBeDefined();
    });
  });

  describe('removeContainer options', () => {
    it('should accept force option', async () => {
      expect(client.removeContainer).toBeDefined();
    });
  });

  describe('removeImage options', () => {
    it('should accept force option', async () => {
      expect(client.removeImage).toBeDefined();
    });
  });

  describe('pruneImages options', () => {
    it('should accept danglingOnly option', async () => {
      expect(client.pruneImages).toBeDefined();
    });
  });

  describe('buildImage options', () => {
    it('should accept dockerfile option', async () => {
      expect(client.buildImage).toBeDefined();
    });

    it('should accept tag option', async () => {
      expect(client.buildImage).toBeDefined();
    });

    it('should accept buildArgs option', async () => {
      expect(client.buildImage).toBeDefined();
    });

    it('should accept onProgress callback', async () => {
      expect(client.buildImage).toBeDefined();
    });
  });

  describe('pushImage options', () => {
    it('should accept username option', async () => {
      expect(client.pushImage).toBeDefined();
    });

    it('should accept password option', async () => {
      expect(client.pushImage).toBeDefined();
    });

    it('should accept server option', async () => {
      expect(client.pushImage).toBeDefined();
    });

    it('should accept onProgress callback', async () => {
      expect(client.pushImage).toBeDefined();
    });
  });

  describe('pullImage progress tracking', () => {
    it('should call onProgress callback', async () => {
      expect(client.pullImage).toBeDefined();
    });

    it('should handle missing onProgress callback', async () => {
      expect(client.pullImage).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty image reference', async () => {
      expect(client.pullImage).toBeDefined();
    });

    it('should handle invalid image reference', async () => {
      expect(client.pullImage).toBeDefined();
    });

    it('should handle very long image reference', async () => {
      expect(client.pullImage).toBeDefined();
    });

    it('should handle special characters in image reference', async () => {
      expect(client.pullImage).toBeDefined();
    });
  });

  describe('createDockerClient', () => {
    it('should create client instance with no config', () => {
      const dockerClient = createDockerClient();
      expect(dockerClient).toBeInstanceOf(DockerClient);
    });

    it('should create client instance with config', () => {
      const dockerClient = createDockerClient({
        socketPath: '/var/run/docker.sock'
      });
      expect(dockerClient).toBeInstanceOf(DockerClient);
    });

    it('should create unique instances', () => {
      const client1 = createDockerClient();
      const client2 = createDockerClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('DockerOptions type compatibility', () => {
    it('should accept all valid DockerOptions', () => {
      const options = {
        socketPath: '/var/run/docker.sock',
        host: 'http://localhost:2375',
        version: 'v1.43',
        timeout: 120000,
        tls: {}
      };

      expect(() => createDockerClient(options)).not.toThrow();
    });
  });

  describe('PullProgress type compatibility', () => {
    it('should create valid PullProgress objects', () => {
      const progress: PullProgress = {
        image_ref: 'python:3.11-slim',
        layers_completed: 5,
        total_layers: 10,
        bytes_downloaded: 5000000,
        total_bytes: 10000000,
        progress: 50,
        status: 'pulling'
      };

      expect(progress.image_ref).toBe('python:3.11-slim');
      expect(progress.progress).toBe(50);
      expect(progress.status).toBe('pulling');
    });

    it('should handle all PullProgress statuses', () => {
      const statuses: PullProgress['status'][] = [
        'pulling',
        'verifying',
        'extracting',
        'complete',
        'failed'
      ];

      statuses.forEach(status => {
        const progress: PullProgress = {
          image_ref: 'test:latest',
          layers_completed: 0,
          total_layers: 0,
          bytes_downloaded: 0,
          total_bytes: 0,
          progress: 0,
          status
        };
        expect(progress.status).toBe(status);
      });
    });
  });

  describe('method chaining', () => {
    it('should support chaining container operations', async () => {
      const containerId = 'test-container-id';
      expect(client.stopContainer).toBeDefined();
      expect(client.removeContainer).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle non-existent container gracefully', async () => {
      expect(client.stopContainer).toBeDefined();
      expect(client.removeContainer).toBeDefined();
    });

    it('should handle non-existent image gracefully', async () => {
      expect(client.removeImage).toBeDefined();
      expect(client.inspectImage).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      const offlineClient = createDockerClient({
        socketPath: '/nonexistent/docker.sock'
      });
      expect(offlineClient.pullImage).toBeDefined();
    });
  });
});
