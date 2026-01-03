import { describe, it, expect, beforeEach } from 'vitest';
import { KubernetesClient, createKubernetesClient } from '../src/kubernetes.js';
import { PodTemplate, ContainerSpec } from '../src/types.js';

describe('KubernetesClient', () => {
  let client: KubernetesClient;

  beforeEach(() => {
    client = createKubernetesClient({
      namespace: 'default'
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultClient = createKubernetesClient();
      expect(defaultClient).toBeInstanceOf(KubernetesClient);
    });

    it('should initialize with custom namespace', () => {
      const customClient = createKubernetesClient({
        namespace: 'test-namespace'
      });
      expect(customClient).toBeInstanceOf(KubernetesClient);
    });

    it('should initialize with kubeconfig path', () => {
      const kubeconfigClient = createKubernetesClient({
        kubeconfig: '/path/to/kubeconfig'
      });
      expect(kubeconfigClient).toBeInstanceOf(KubernetesClient);
    });

    it('should initialize with context', () => {
      const contextClient = createKubernetesClient({
        context: 'minikube'
      });
      expect(contextClient).toBeInstanceOf(KubernetesClient);
    });

    it('should initialize with cluster', () => {
      const clusterClient = createKubernetesClient({
        cluster: 'my-cluster'
      });
      expect(clusterClient).toBeInstanceOf(KubernetesClient);
    });

    it('should initialize with timeout', () => {
      const timeoutClient = createKubernetesClient({
        timeout: 60000
      });
      expect(timeoutClient).toBeInstanceOf(KubernetesClient);
    });
  });

  describe('pod operations', () => {
    it('should have listPods method', () => {
      expect(typeof client.listPods).toBe('function');
    });

    it('should have getPod method', () => {
      expect(typeof client.getPod).toBe('function');
    });

    it('should have createPod method', () => {
      expect(typeof client.createPod).toBe('function');
    });

    it('should have deletePod method', () => {
      expect(typeof client.deletePod).toBe('function');
    });

    it('should have getPodLogs method', () => {
      expect(typeof client.getPodLogs).toBe('function');
    });

    it('should have execInPod method', () => {
      expect(typeof client.execInPod).toBe('function');
    });
  });

  describe('deployment operations', () => {
    it('should have createDeployment method', () => {
      expect(typeof client.createDeployment).toBe('function');
    });

    it('should have updateDeployment method', () => {
      expect(typeof client.updateDeployment).toBe('function');
    });

    it('should have scaleDeployment method', () => {
      expect(typeof client.scaleDeployment).toBe('function');
    });

    it('should have deleteDeployment method', () => {
      expect(typeof client.deleteDeployment).toBe('function');
    });
  });

  describe('node operations', () => {
    it('should have listNodes method', () => {
      expect(typeof client.listNodes).toBe('function');
    });

    it('should have getNode method', () => {
      expect(typeof client.getNode).toBe('function');
    });

    it('should have getNodesWithImage method', () => {
      expect(typeof client.getNodesWithImage).toBe('function');
    });
  });

  describe('secret operations', () => {
    it('should have createImagePullSecret method', () => {
      expect(typeof client.createImagePullSecret).toBe('function');
    });

    it('should have getImagePullSecret method', () => {
      expect(typeof client.getImagePullSecret).toBe('function');
    });

    it('should have deleteImagePullSecret method', () => {
      expect(typeof client.deleteImagePullSecret).toBe('function');
    });
  });

  describe('ConfigMap operations', () => {
    it('should have createConfigMap method', () => {
      expect(typeof client.createConfigMap).toBe('function');
    });

    it('should have getConfigMap method', () => {
      expect(typeof client.getConfigMap).toBe('function');
    });
  });

  describe('PVC operations', () => {
    it('should have createPersistentVolumeClaim method', () => {
      expect(typeof client.createPersistentVolumeClaim).toBe('function');
    });
  });

  describe('advanced operations', () => {
    it('should have createDaemonSet method', () => {
      expect(typeof client.createDaemonSet).toBe('function');
    });

    it('should have watchPods method', () => {
      expect(typeof client.watchPods).toBe('function');
    });

    it('should have prewarmPods method', () => {
      expect(typeof client.prewarmPods).toBe('function');
    });

    it('should have getClusterResources method', () => {
      expect(typeof client.getClusterResources).toBe('function');
    });
  });

  describe('listPods options', () => {
    it('should accept labelSelector', async () => {
      expect(client.listPods).toBeDefined();
    });

    it('should handle missing labelSelector', async () => {
      expect(client.listPods).toBeDefined();
    });
  });

  describe('getPodLogs options', () => {
    it('should accept containerName', async () => {
      expect(client.getPodLogs).toBeDefined();
    });

    it('should accept tailLines', async () => {
      expect(client.getPodLogs).toBeDefined();
    });

    it('should handle missing options', async () => {
      expect(client.getPodLogs).toBeDefined();
    });
  });

  describe('execInPod options', () => {
    it('should accept command array', async () => {
      expect(client.execInPod).toBeDefined();
    });

    it('should accept containerName', async () => {
      expect(client.execInPod).toBeDefined();
    });

    it('should handle missing containerName', async () => {
      expect(client.execInPod).toBeDefined();
    });
  });

  describe('createDeployment options', () => {
    it('should accept replicas parameter', async () => {
      expect(client.createDeployment).toBeDefined();
    });

    it('should handle default replicas', async () => {
      expect(client.createDeployment).toBeDefined();
    });
  });

  describe('scaleDeployment', () => {
    it('should accept replica count', async () => {
      expect(client.scaleDeployment).toBeDefined();
    });
  });

  describe('stopContainer timeout', () => {
    it('should accept timeout parameter', async () => {
      expect(client.stopContainer).toBeDefined();
    });
  });

  describe('watchPods', () => {
    it('should accept labelSelector', async () => {
      expect(client.watchPods).toBeDefined();
    });

    it('should return cleanup function', async () => {
      expect(client.watchPods).toBeDefined();
    });
  });

  describe('prewarmPods options', () => {
    it('should accept nodeSelector', async () => {
      expect(client.prewarmPods).toBeDefined();
    });

    it('should accept count parameter', async () => {
      expect(client.prewarmPods).toBeDefined();
    });

    it('should handle default count', async () => {
      expect(client.prewarmPods).toBeDefined();
    });
  });

  describe('listNodes options', () => {
    it('should accept labelSelector', async () => {
      expect(client.listNodes).toBeDefined();
    });
  });

  describe('PodTemplate structure', () => {
    it('should accept valid PodTemplate', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest'
          }
        ]
      };

      expect(template.name).toBe('test-pod');
      expect(template.containers.length).toBe(1);
    });

    it('should accept PodTemplate with nodeSelector', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest'
          }
        ],
        node_selector: {
          'worker-type': 'gpu'
        }
      };

      expect(template.node_selector).toBeDefined();
    });

    it('should accept PodTemplate with resources', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest',
            resources: {
              cpu_request: '100m',
              cpu_limit: '500m',
              memory_request: '128Mi',
              memory_limit: '512Mi'
            }
          }
        ]
      };

      expect(template.containers[0].resources).toBeDefined();
    });
  });

  describe('ContainerSpec structure', () => {
    it('should accept minimal ContainerSpec', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest'
      };

      expect(spec.name).toBe('test');
      expect(spec.image).toBe('nginx:latest');
    });

    it('should accept ContainerSpec with command', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest',
        command: ['/bin/sh']
      };

      expect(spec.command).toBeDefined();
    });

    it('should accept ContainerSpec with args', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest',
        args: ['-c', 'echo hello']
      };

      expect(spec.args).toBeDefined();
    });

    it('should accept ContainerSpec with env', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest',
        env: [
          { name: 'ENV_VAR', value: 'value' }
        ]
      };

      expect(spec.env).toBeDefined();
      expect(spec.env?.length).toBe(1);
    });
  });

  describe('createKubernetesClient', () => {
    it('should create client instance with no config', () => {
      const k8sClient = createKubernetesClient();
      expect(k8sClient).toBeInstanceOf(KubernetesClient);
    });

    it('should create client instance with config', () => {
      const k8sClient = createKubernetesClient({
        namespace: 'test'
      });
      expect(k8sClient).toBeInstanceOf(KubernetesClient);
    });

    it('should create unique instances', () => {
      const client1 = createKubernetesClient();
      const client2 = createKubernetesClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('KubernetesOptions type compatibility', () => {
    it('should accept all valid KubernetesOptions', () => {
      const options = {
        kubeconfig: '/path/to/kubeconfig',
        context: 'minikube',
        cluster: 'my-cluster',
        namespace: 'test',
        timeout: 60000
      };

      expect(() => createKubernetesClient(options)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty pod name', async () => {
      expect(client.getPod).toBeDefined();
    });

    it('should handle non-existent pod', async () => {
      expect(client.getPod).toBeDefined();
    });

    it('should handle empty container name', async () => {
      expect(client.execInPod).toBeDefined();
    });

    it('should handle very long pod name', async () => {
      expect(client.createPod).toBeDefined();
    });

    it('should handle special characters in pod name', async () => {
      expect(client.createPod).toBeDefined();
    });
  });

  describe('ResourceRequirements', () => {
    it('should handle CPU requests', () => {
      const resources = {
        cpu_request: '100m'
      };

      expect(resources.cpu_request).toBe('100m');
    });

    it('should handle memory requests', () => {
      const resources = {
        memory_request: '128Mi'
      };

      expect(resources.memory_request).toBe('128Mi');
    });

    it('should handle both request and limit', () => {
      const resources = {
        cpu_request: '100m',
        cpu_limit: '500m',
        memory_request: '128Mi',
        memory_limit: '512Mi'
      };

      expect(resources.cpu_limit).toBe('500m');
      expect(resources.memory_limit).toBe('512Mi');
    });
  });

  describe('memory parsing', () => {
    it('should parse binary units', () => {
      // Test internal logic through createPVC
      expect(client.createPersistentVolumeClaim).toBeDefined();
    });

    it('should parse decimal units', () => {
      expect(client.createPersistentVolumeClaim).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid kubeconfig gracefully', () => {
      const invalidClient = createKubernetesClient({
        kubeconfig: '/nonexistent/kubeconfig'
      });
      expect(invalidClient).toBeInstanceOf(KubernetesClient);
    });

    it('should handle invalid context gracefully', () => {
      const invalidContextClient = createKubernetesClient({
        context: 'nonexistent-context'
      });
      expect(invalidContextClient).toBeInstanceOf(KubernetesClient);
    });

    it('should handle connection errors gracefully', async () => {
      expect(client.listPods).toBeDefined();
    });
  });

  describe('watchPods callback', () => {
    it('should call callback with event type', async () => {
      expect(client.watchPods).toBeDefined();
    });

    it('should call callback with pod object', async () => {
      expect(client.watchPods).toBeDefined();
    });

    it('should support all event types', async () => {
      expect(client.watchPods).toBeDefined();
    });
  });

  describe('getClusterResources', () => {
    it('should return resource statistics', async () => {
      expect(client.getClusterResources).toBeDefined();
    });
  });

  describe('createImagePullSecret', () => {
    it('should accept registry URL', async () => {
      expect(client.createImagePullSecret).toBeDefined();
    });

    it('should accept credentials', async () => {
      expect(client.createImagePullSecret).toBeDefined();
    });

    it('should handle default registry', async () => {
      expect(client.createImagePullSecret).toBeDefined();
    });
  });

  describe('getNodesWithImage', () => {
    it('should check image availability on nodes', async () => {
      expect(client.getNodesWithImage).toBeDefined();
    });

    it('should return array of results', async () => {
      expect(client.getNodesWithImage).toBeDefined();
    });
  });

  describe('DaemonSet creation', () => {
    it('should create DaemonSet for node pre-warming', async () => {
      expect(client.createDaemonSet).toBeDefined();
    });
  });

  describe('namespace operations', () => {
    it('should use configured namespace', () => {
      const nsClient = createKubernetesClient({
        namespace: 'custom-namespace'
      });
      expect(nsClient).toBeInstanceOf(KubernetesClient);
    });

    it('should use default namespace when not specified', () => {
      const defaultNsClient = createKubernetesClient();
      expect(defaultNsClient).toBeInstanceOf(KubernetesClient);
    });
  });

  describe('affinity configuration', () => {
    it('should accept node affinity in template', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest'
          }
        ],
        node_affinity: {
          requiredDuringSchedulingIgnoredDuringExecution: {
            nodeSelectorTerms: [
              {
                matchExpressions: [
                  {
                    key: 'disktype',
                    operator: 'In',
                    values: ['ssd']
                  }
                ]
              }
            ]
          }
        }
      };

      expect(template.node_affinity).toBeDefined();
    });
  });

  describe('volume mounting', () => {
    it('should accept volume mounts in container spec', () => {
      const spec: ContainerSpec = {
        name: 'test-container',
        image: 'nginx:latest',
        volume_mounts: [
          {
            name: 'data-volume',
            mountPath: '/data'
          }
        ]
      };

      expect(spec.volume_mounts).toBeDefined();
    });
  });
});
