import * as k8s from "@kubernetes/client-node";
import {
  KubernetesOptions,
  PodTemplate,
  ContainerSpec,
  ResourceRequirements,
} from "./types.js";

/**
 * Kubernetes client wrapper for container image operations
 */
export class KubernetesClient {
  private coreV1Api: k8s.CoreV1Api;
  private appsV1Api: k8s.AppsV1Api;
  private config: k8s.KubeConfig;
  private namespace: string;

  constructor(options: KubernetesOptions = {}) {
    this.config = new k8s.KubeConfig();

    if (options.kubeconfig) {
      this.config.loadFromFile(options.kubeconfig);
    } else {
      this.config.loadFromDefault();
    }

    if (options.context) {
      this.config.setCurrentContext(options.context);
    }

    this.namespace = options.namespace || "default";

    this.coreV1Api = this.config.makeApiClient(k8s.CoreV1Api);
    this.appsV1Api = this.config.makeApiClient(k8s.AppsV1Api);
  }

  /**
   * List all pods in namespace
   */
  async listPods(labelSelector?: string): Promise<k8s.V1Pod[]> {
    const response = await this.coreV1Api.listNamespacedPod(
      this.namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );
    return response.body.items;
  }

  /**
   * Get pod details
   */
  async getPod(name: string): Promise<k8s.V1Pod> {
    const response = await this.coreV1Api.readNamespacedPod(
      name,
      this.namespace
    );
    return response.body;
  }

  /**
   * Create a pod
   */
  async createPod(template: PodTemplate): Promise<k8s.V1Pod> {
    const pod: k8s.V1Pod = {
      metadata: {
        name: template.name,
        namespace: template.namespace,
      },
      spec: {
        containers: template.containers.map(this.toK8sContainer),
        nodeSelector: template.node_selector,
        affinity: template.node_affinity,
        restartPolicy: "Never",
      },
    };

    const response = await this.coreV1Api.createNamespacedPod(
      this.namespace,
      pod
    );
    return response.body;
  }

  /**
   * Delete a pod
   */
  async deletePod(name: string): Promise<void> {
    await this.coreV1Api.deleteNamespacedPod(name, this.namespace);
  }

  /**
   * Get pod logs
   */
  async getPodLogs(
    podName: string,
    containerName?: string,
    tailLines?: number
  ): Promise<string> {
    const response = await this.coreV1Api.readNamespacedPodLog(
      podName,
      this.namespace,
      containerName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      tailLines
    );
    return response.body;
  }

  /**
   * Execute command in pod
   */
  async execInPod(
    podName: string,
    command: string[],
    containerName?: string
  ): Promise<string> {
    const response = await this.coreV1Api.connectGetNamespacedPodExec(
      podName,
      this.namespace,
      containerName,
      command,
      false,
      false,
      false,
      true
    );

    return response.body as any;
  }

  /**
   * Create a deployment
   */
  async createDeployment(
    name: string,
    template: PodTemplate,
    replicas: number = 1
  ): Promise<k8s.V1Deployment> {
    const deployment: k8s.V1Deployment = {
      metadata: {
        name,
        namespace: this.namespace,
      },
      spec: {
        replicas,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: template.containers.map(this.toK8sContainer),
            nodeSelector: template.node_selector,
            affinity: template.node_affinity,
          },
        },
      },
    };

    const response = await this.appsV1Api.createNamespacedDeployment(
      this.namespace,
      deployment
    );
    return response.body;
  }

  /**
   * Update a deployment
   */
  async updateDeployment(
    name: string,
    template: PodTemplate,
    replicas?: number
  ): Promise<k8s.V1Deployment> {
    const current = await this.appsV1Api.readNamespacedDeployment(
      name,
      this.namespace
    );

    const deployment: k8s.V1Deployment = {
      ...current.body,
      spec: {
        ...current.body.spec,
        replicas: replicas ?? current.body.spec?.replicas,
        template: {
          ...current.body.spec?.template,
          spec: {
            ...current.body.spec?.template.spec,
            containers: template.containers.map(this.toK8sContainer),
            nodeSelector: template.node_selector,
            affinity: template.node_affinity,
          },
        },
      },
    };

    const response = await this.appsV1Api.replaceNamespacedDeployment(
      name,
      this.namespace,
      deployment
    );
    return response.body;
  }

  /**
   * Scale a deployment
   */
  async scaleDeployment(
    name: string,
    replicas: number
  ): Promise<k8s.V1Deployment> {
    const current = await this.appsV1Api.readNamespacedDeployment(
      name,
      this.namespace
    );

    if (current.body.spec) {
      current.body.spec.replicas = replicas;
    }

    const response = await this.appsV1Api.replaceNamespacedDeployment(
      name,
      this.namespace,
      current.body
    );
    return response.body;
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(name: string): Promise<void> {
    await this.appsV1Api.deleteNamespacedDeployment(name, this.namespace);
  }

  /**
   * Get nodes in cluster
   */
  async listNodes(labelSelector?: string): Promise<k8s.V1Node[]> {
    const response = await this.coreV1Api.listNode(
      undefined,
      undefined,
      undefined,
      labelSelector
    );
    return response.body.items;
  }

  /**
   * Get node details
   */
  async getNode(name: string): Promise<k8s.V1Node> {
    const response = await this.coreV1Api.readNode(name);
    return response.body;
  }

  /**
   * Get nodes with cached images
   */
  async getNodesWithImage(
    imageRef: string
  ): Promise<Array<{ node: string; cached: boolean }>> {
    const nodes = await this.listNodes();
    const results: Array<{ node: string; cached: boolean }> = [];

    for (const node of nodes) {
      const nodeName = node.metadata?.name;
      if (!nodeName) continue;

      // Check if node has image cached (by trying to inspect)
      try {
        // This is a simplified check - in reality, we'd query the node's container runtime
        results.push({ node: nodeName, cached: false });
      } catch (error) {
        results.push({ node: nodeName, cached: false });
      }
    }

    return results;
  }

  /**
   * Create a DaemonSet (for pre-warming on all nodes)
   */
  async createDaemonSet(
    name: string,
    template: PodTemplate
  ): Promise<k8s.V1DaemonSet> {
    const daemonSet: k8s.V1DaemonSet = {
      metadata: {
        name,
        namespace: this.namespace,
      },
      spec: {
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: template.containers.map(this.toK8sContainer),
            nodeSelector: template.node_selector,
            affinity: template.node_affinity,
          },
        },
      },
    };

    const response = await this.coreV1Api.createNamespacedDaemonSet(
      this.namespace,
      daemonSet
    );
    return response.body;
  }

  /**
   * Create image pull secret
   */
  async createImagePullSecret(
    name: string,
    registry: string,
    username: string,
    password: string
  ): Promise<k8s.V1Secret> {
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const secret: k8s.V1Secret = {
      metadata: {
        name,
        namespace: this.namespace,
      },
      type: "kubernetes.io/dockerconfigjson",
      data: {
        ".dockerconfigjson": Buffer.from(
          JSON.stringify({
            auths: {
              [registry]: {
                username,
                password,
                auth,
              },
            },
          })
        ).toString("base64"),
      },
    };

    const response = await this.coreV1Api.createNamespacedSecret(
      this.namespace,
      secret
    );
    return response.body;
  }

  /**
   * Get image pull secret
   */
  async getImagePullSecret(name: string): Promise<k8s.V1Secret | undefined> {
    try {
      const response = await this.coreV1Api.readNamespacedSecret(
        name,
        this.namespace
      );
      return response.body;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Delete image pull secret
   */
  async deleteImagePullSecret(name: string): Promise<void> {
    await this.coreV1Api.deleteNamespacedSecret(name, this.namespace);
  }

  /**
   * Create a ConfigMap
   */
  async createConfigMap(
    name: string,
    data: Record<string, string>
  ): Promise<k8s.V1ConfigMap> {
    const configMap: k8s.V1ConfigMap = {
      metadata: {
        name,
        namespace: this.namespace,
      },
      data,
    };

    const response = await this.coreV1Api.createNamespacedConfigMap(
      this.namespace,
      configMap
    );
    return response.body;
  }

  /**
   * Get ConfigMap
   */
  async getConfigMap(name: string): Promise<k8s.V1ConfigMap | undefined> {
    try {
      const response = await this.coreV1Api.readNamespacedConfigMap(
        name,
        this.namespace
      );
      return response.body;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Create a PersistentVolumeClaim
   */
  async createPersistentVolumeClaim(
    name: string,
    storageSize: string,
    accessMode: string = "ReadWriteOnce"
  ): Promise<k8s.V1PersistentVolumeClaim> {
    const pvc: k8s.V1PersistentVolumeClaim = {
      metadata: {
        name,
        namespace: this.namespace,
      },
      spec: {
        accessModes: [accessMode],
        resources: {
          requests: {
            storage: storageSize,
          },
        },
      },
    };

    const response = await this.coreV1Api.createNamespacedPersistentVolumeClaim(
      this.namespace,
      pvc
    );
    return response.body;
  }

  /**
   * Watch pods for events
   */
  watchPods(
    callback: (event: string, pod: k8s.V1Pod) => void,
    labelSelector?: string
  ): () => void {
    const watch = new k8s.Watch(this.config);

    const req = watch.watch(
      `/api/v1/namespaces/${this.namespace}/pods`,
      { labelSelector },
      (phase, obj) => {
        if (phase === "ADDED" || phase === "MODIFIED" || phase === "DELETED") {
          callback(phase, obj as k8s.V1Pod);
        }
      }
    );

    // Return cleanup function
    return () => req.abort();
  }

  /**
   * Pre-warm pod template on specific nodes
   */
  async prewarmPods(
    template: PodTemplate,
    nodeSelector?: Record<string, string>,
    count: number = 1
  ): Promise<k8s.V1Pod[]> {
    const pods: k8s.V1Pod[] = [];

    for (let i = 0; i < count; i++) {
      const podTemplate: PodTemplate = {
        ...template,
        name: `${template.name}-prewarm-${i}`,
        node_selector: nodeSelector,
      };

      const pod = await this.createPod(podTemplate);
      pods.push(pod);
    }

    return pods;
  }

  /**
   * Get cluster resource usage
   */
  async getClusterResources(): Promise<{
    nodes: number;
    totalCpu: number;
    totalMemory: number;
    usedCpu: number;
    usedMemory: number;
  }> {
    const nodes = await this.listNodes();
    let totalCpu = 0;
    let totalMemory = 0;
    let usedCpu = 0;
    let usedMemory = 0;

    for (const node of nodes) {
      const allocatable = node.status?.allocatable;
      const capacity = node.status?.capacity;

      if (allocatable?.["cpu"]) {
        totalCpu += parseFloat(allocatable["cpu"]);
      }
      if (allocatable?.["memory"]) {
        totalMemory += this.parseMemory(allocatable["memory"]);
      }
    }

    // Note: Getting actual usage would require Metrics Server
    // This is a simplified implementation

    return {
      nodes: nodes.length,
      totalCpu,
      totalMemory,
      usedCpu,
      usedMemory,
    };
  }

  /**
   * Convert ContainerSpec to k8s container
   */
  private toK8sContainer(spec: ContainerSpec): k8s.V1Container {
    return {
      name: spec.name,
      image: spec.image,
      command: spec.command,
      args: spec.args,
      env: spec.env,
      resources: this.toK8sResources(spec.resources),
    };
  }

  /**
   * Convert ResourceRequirements to k8s resources
   */
  private toK8sResources(
    resources?: ResourceRequirements
  ): k8s.V1ResourceRequirements | undefined {
    if (!resources) {
      return undefined;
    }

    const result: k8s.V1ResourceRequirements = {};

    if (resources.cpu_request || resources.memory_request) {
      result.requests = {};
      if (resources.cpu_request) {
        result.requests.cpu = resources.cpu_request;
      }
      if (resources.memory_request) {
        result.requests.memory = resources.memory_request;
      }
    }

    if (resources.cpu_limit || resources.memory_limit) {
      result.limits = {};
      if (resources.cpu_limit) {
        result.limits.cpu = resources.cpu_limit;
      }
      if (resources.memory_limit) {
        result.limits.memory = resources.memory_limit;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Parse memory string (e.g., "1Gi" -> 1073741824)
   */
  private parseMemory(memory: string): number {
    const units: Record<string, number> = {
      Ki: 1024,
      Mi: 1024 ** 2,
      Gi: 1024 ** 3,
      Ti: 1024 ** 4,
      K: 1000,
      M: 1000 ** 2,
      G: 1000 ** 3,
      T: 1000 ** 4,
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseFloat(memory.slice(0, -unit.length)) * multiplier;
      }
    }

    return parseFloat(memory);
  }
}

/**
 * Create a Kubernetes client instance
 */
export function createKubernetesClient(
  options?: KubernetesOptions
): KubernetesClient {
  return new KubernetesClient(options);
}
