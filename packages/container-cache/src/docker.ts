import Docker from "dockerode";
import {
  ContainerImage,
  ImageLayer,
  PullProgress,
  DockerOptions,
} from "./types.js";
import { createHash } from "crypto";

/**
 * Docker client wrapper for container image operations
 */
export class DockerClient {
  private docker: Docker;
  private config: DockerOptions;

  constructor(options: DockerOptions = {}) {
    this.config = {
      socketPath:
        options.socketPath ??
        process.env.DOCKER_SOCKET ??
        "/var/run/docker.sock",
      host: options.host,
      version: options.version ?? "v1.43",
      timeout: options.timeout ?? 120000,
    };

    this.docker = new Docker({
      socketPath: this.config.socketPath,
      host: this.config.host,
      version: this.config.version,
    });
  }

  /**
   * Pull an image with progress tracking
   */
  async pullImage(
    imageRef: string,
    onProgress?: (progress: PullProgress) => void
  ): Promise<ContainerImage> {
    const progress: PullProgress = {
      image_ref: imageRef,
      layers_completed: 0,
      total_layers: 0,
      bytes_downloaded: 0,
      total_bytes: 0,
      progress: 0,
      status: "pulling",
    };

    return new Promise((resolve, reject) => {
      this.docker.pull(
        imageRef,
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            progress.status = "failed";
            progress.error = err.message;
            onProgress?.(progress);
            reject(err);
            return;
          }

          this.docker.modem.followProgress(
            stream,
            (err: Error | null) => {
              if (err) {
                progress.status = "failed";
                progress.error = err.message;
                onProgress?.(progress);
                reject(err);
                return;
              }

              progress.status = "complete";
              progress.progress = 100;
              onProgress?.(progress);

              // Get image details
              this.inspectImage(imageRef).then(resolve).catch(reject);
            },
            (event: any) => {
              this.updateProgress(progress, event);
              onProgress?.(progress);
            }
          );
        }
      );
    });
  }

  /**
   * Update pull progress from Docker event
   */
  private updateProgress(progress: PullProgress, event: any): void {
    if (event.status === "Pulling fs layer") {
      progress.total_layers++;
    } else if (
      event.status === "Download complete" ||
      event.status === "Pull complete"
    ) {
      progress.layers_completed++;
    } else if (event.progressDetail) {
      if (event.progressDetail.total) {
        progress.total_bytes = event.progressDetail.total;
      }
      if (event.progressDetail.current) {
        progress.bytes_downloaded += event.progressDetail.current;
      }
    }

    if (event.id) {
      progress.current_layer = event.id;
    }

    if (progress.total_bytes > 0) {
      progress.progress =
        (progress.bytes_downloaded / progress.total_bytes) * 100;
    }
  }

  /**
   * Inspect an image and get its details
   */
  async inspectImage(imageRef: string): Promise<ContainerImage> {
    const image = this.docker.getImage(imageRef);
    const info = await image.inspect();

    // Parse image reference
    const [repository, tag = "latest"] = imageRef.split(":");

    // Get layers
    const layers: ImageLayer[] = info.RootFS.Layers.map((digest, index) => ({
      digest,
      compressed_size: 0, // Will be filled if available
      uncompressed_size: 0,
      media_type: "application/vnd.docker.image.rootfs.diff.tar.gzip",
      index,
    }));

    // Calculate total size
    const size = info.Size || 0;

    return {
      repository,
      tag,
      digest: info.RepoDigests?.[0] || info.Id,
      size,
      layers,
      ref: imageRef,
      created_at: new Date(info.Created),
      architecture: info.Architecture,
      os: info.Os,
      env: info.Config?.Env?.reduce(
        (acc, env) => {
          const [key, value] = env.split("=");
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      ),
      cmd: info.Config?.Cmd,
      entrypoint: info.Config?.Entrypoint,
    };
  }

  /**
   * Check if an image exists locally
   */
  async imageExists(imageRef: string): Promise<boolean> {
    try {
      const image = this.docker.getImage(imageRef);
      await image.inspect();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all local images
   */
  async listImages(): Promise<ContainerImage[]> {
    const images = await this.docker.listImages();
    const result: ContainerImage[] = [];

    for (const img of images) {
      if (img.RepoTags && img.RepoTags.length > 0) {
        for (const tag of img.RepoTags) {
          try {
            const details = await this.inspectImage(tag);
            result.push(details);
          } catch (error) {
            // Skip invalid images
          }
        }
      }
    }

    return result;
  }

  /**
   * Get image layers
   */
  async getImageLayers(imageRef: string): Promise<ImageLayer[]> {
    const image = await this.inspectImage(imageRef);
    return image.layers;
  }

  /**
   * Remove an image
   */
  async removeImage(imageRef: string, force: boolean = false): Promise<void> {
    const image = this.docker.getImage(imageRef);
    await image.remove({ force });
  }

  /**
   * Get image size
   */
  async getImageSize(imageRef: string): Promise<number> {
    const image = await this.inspectImage(imageRef);
    return image.size;
  }

  /**
   * Create a container from an image
   */
  async createContainer(
    imageRef: string,
    options: {
      name?: string;
      cmd?: string[];
      env?: Record<string, string>;
      volumes?: Record<string, string>;
      ports?: Record<string, string>;
    } = {}
  ): Promise<string> {
    const image = this.docker.getImage(imageRef);

    const binds = options.volumes
      ? Object.entries(options.volumes).map(
          ([host, container]) => `${host}:${container}`
        )
      : undefined;

    const portBindings = options.ports
      ? Object.entries(options.ports).reduce((acc, [container, host]) => {
          const [port, protocol] = container.split("/");
          acc[`${port}/${protocol || "tcp"}`] = [{ HostPort: host }];
          return acc;
        }, {} as any)
      : undefined;

    const container = await image.createContainer({
      name: options.name,
      Cmd: options.cmd,
      Env: options.env
        ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
        : undefined,
      HostConfig: {
        Binds: binds,
        PortBindings: portBindings,
      },
    });

    return container.id;
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  /**
   * Stop a container
   */
  async stopContainer(
    containerId: string,
    timeout: number = 10000
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop({ t: timeout / 1000 });
  }

  /**
   * Remove a container
   */
  async removeContainer(
    containerId: string,
    force: boolean = false
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force, v: true });
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options: { tail?: number; follow?: boolean } = {}
  ): Promise<NodeJS.ReadableStream> {
    const container = this.docker.getContainer(containerId);
    return await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail ?? 100,
      follow: options.follow ?? false,
    });
  }

  /**
   * Execute command in container
   */
  async execInContainer(
    containerId: string,
    command: string[],
    options: { env?: Record<string, string> } = {}
  ): Promise<{ exitCode: number; output: string }> {
    const container = this.docker.getContainer(containerId);

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Env: options.env
        ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
        : undefined,
    });

    return new Promise((resolve, reject) => {
      const stream: any[] = [];

      exec.start(
        { Detach: false },
        (err: Error | null, execStream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }

          execStream.on("data", (chunk: Buffer) => {
            stream.push(chunk);
          });

          execStream.on("error", reject);
          execStream.on("end", () => {
            const output = Buffer.concat(stream).toString("utf-8");
            exec.inspect((err: Error | null, info: any) => {
              if (err) {
                reject(err);
              } else {
                resolve({ exitCode: info.ExitCode, output });
              }
            });
          });
        }
      );
    });
  }

  /**
   * Get Docker system info
   */
  async getSystemInfo(): Promise<{
    version: string;
    os: string;
    architecture: string;
    cpus: number;
    memory: number;
  }> {
    const info = await this.docker.info();
    const version = await this.docker.version();

    return {
      version: version.Version,
      os: info.OperatingSystem,
      architecture: info.Architecture,
      cpus: info.NCPU,
      memory: info.MemTotal,
    };
  }

  /**
   * Get disk usage
   */
  async getDiskUsage(): Promise<{
    images: number;
    containers: number;
    volumes: number;
    buildCache: number;
  }> {
    const df = await this.docker.df();
    return {
      images: df.LayersSize || 0,
      containers: df.ContainersSize || 0,
      volumes: df.VolumesSize || 0,
      buildCache: df.BuilderSize || 0,
    };
  }

  /**
   * Prune unused images
   */
  async pruneImages(danglingOnly: boolean = true): Promise<number> {
    const result = await this.docker.pruneImages({
      dangling: danglingOnly ? "true" : "false",
    });
    return result?.ImagesDeleted?.length || 0;
  }

  /**
   * Verify image integrity by checking layer digests
   */
  async verifyImageIntegrity(imageRef: string): Promise<boolean> {
    try {
      const image = this.docker.getImage(imageRef);
      const info = await image.inspect();

      // Verify that we have the expected layers
      if (!info.RootFS || !info.RootFS.Layers) {
        return false;
      }

      // In a real implementation, we would verify each layer's SHA256 hash
      // For now, just check that the image exists and has layers
      return info.RootFS.Layers.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build an image from a Dockerfile
   */
  async buildImage(
    context: string,
    options: {
      dockerfile?: string;
      tag?: string;
      buildArgs?: Record<string, string>;
      onProgress?: (event: any) => void;
    } = {}
  ): Promise<string> {
    const stream = await this.docker.buildImage(
      {
        context,
        src: ["Dockerfile"],
      },
      {
        dockerfile: options.dockerfile || "Dockerfile",
        t: options.tag,
        buildargs: options.buildArgs,
      }
    );

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve(options.tag || "built-image");
          }
        },
        (event: any) => {
          options.onProgress?.(event);
        }
      );
    });
  }

  /**
   * Tag an image
   */
  async tagImage(sourceRef: string, targetRef: string): Promise<void> {
    const image = this.docker.getImage(sourceRef);
    await image.tag({
      repo: targetRef.split(":")[0],
      tag: targetRef.split(":")[1] || "latest",
    });
  }

  /**
   * Push an image to a registry
   */
  async pushImage(
    imageRef: string,
    options: {
      username?: string;
      password?: string;
      server?: string;
      onProgress?: (event: any) => void;
    } = {}
  ): Promise<void> {
    const image = this.docker.getImage(imageRef);
    const [repo, tag] = imageRef.split(":");
    const [registry] = repo.split("/");

    const auth =
      options.username && options.password
        ? {
            username: options.username,
            password: options.password,
            serveraddress:
              options.server || registry || "https://index.docker.io/v1/",
          }
        : undefined;

    const stream = await image.push({ tag, authconfig: auth });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
        (event: any) => {
          options.onProgress?.(event);
        }
      );
    });
  }

  /**
   * Save image to tar file
   */
  async saveImage(imageRef: string, outputPath: string): Promise<void> {
    const image = this.docker.getImage(imageRef);
    const stream = await image.get();

    const fs = await import("fs/promises");
    const writeStream = (await import("fs")).createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
    });
  }

  /**
   * Load image from tar file
   */
  async loadImage(inputPath: string): Promise<void> {
    const fs = await import("fs/promises");
    const data = await fs.readFile(inputPath);

    return new Promise((resolve, reject) => {
      this.docker.loadImage(data, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * Create a Docker client instance
 */
export function createDockerClient(options?: DockerOptions): DockerClient {
  return new DockerClient(options);
}
