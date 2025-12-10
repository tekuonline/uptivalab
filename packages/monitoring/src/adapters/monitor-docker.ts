import Docker from "dockerode";
import type { BaseMonitor, MonitorAdapter, MonitorResult, DockerConfig } from "../types.js";

const DEFAULT_SOCKET = "/var/run/docker.sock";

const toConfig = (config: Record<string, unknown>): DockerConfig => {
  if (typeof config.containerName !== "string") {
    throw new Error("Docker monitor requires containerName");
  }
  return {
    containerName: config.containerName,
    image: typeof config.image === "string" ? config.image : undefined,
    socketPath: typeof config.socketPath === "string" ? config.socketPath : DEFAULT_SOCKET,
    registryImage: typeof config.registryImage === "string" ? config.registryImage : undefined,
  };
};

export const dockerAdapter: MonitorAdapter = {
  kind: "docker",
  supports: () => Boolean(process.env.DOCKER_HOST || true),
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const docker = new Docker({ socketPath: config.socketPath ?? DEFAULT_SOCKET });

    try {
      const container = docker.getContainer(config.containerName);
      const inspect = await container.inspect();
      const state = inspect.State?.Status ?? "unknown";
      const image = inspect.Config?.Image;
      const needsUpdate = await checkImageUpdate(config.registryImage ?? image);

      return {
        monitorId: monitor.id,
        status: state === "running" ? "up" : "down",
        message: `Container ${state}`,
        checkedAt: new Date().toISOString(),
        meta: {
          docker: {
            containerId: inspect.Id,
            state,
            image,
            needsUpdate,
          },
        },
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  },
};

const parseImageRef = (image?: string) => {
  if (!image) return null;
  const [name, tag = "latest"] = image.split(":");
  const parts = name.split("/");
  const hasRegistry = parts.length > 1 && parts[0].includes(".");
  const repository = hasRegistry ? name : `library/${name}`;
  return { repository, tag };
};

const checkImageUpdate = async (image?: string) => {
  try {
    const reference = parseImageRef(image);
    if (!reference) return false;
    const url = `https://registry.hub.docker.com/v2/repositories/${reference.repository}/tags/${reference.tag}`;
    const response = await fetch(url);
    if (!response.ok) return false;
    const data = (await response.json()) as { images?: Array<{ digest?: string }>; digest?: string };
    const digest = data?.images?.[0]?.digest ?? data.digest;
    return Boolean(digest);
  } catch {
    return false;
  }
};
