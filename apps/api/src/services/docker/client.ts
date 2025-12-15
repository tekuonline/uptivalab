/**
 * Docker client service for connecting to Docker hosts and retrieving information
 */

import http from 'http';

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

interface DockerNetwork {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
}

interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
}

interface DockerInfo {
  containers: DockerContainer[];
  networks: DockerNetwork[];
  volumes: DockerVolume[];
  serverVersion: string;
}

export class DockerClient {
  private baseUrl: string;
  private socketPath?: string;

  constructor(dockerHostUrl: string) {
    // Normalize URL - support both socket and TCP connections
    if (dockerHostUrl.startsWith('unix://')) {
      this.socketPath = dockerHostUrl.replace('unix://', '');
      this.baseUrl = '';
    } else if (dockerHostUrl.startsWith('tcp://') || dockerHostUrl.startsWith('http')) {
      // Ensure http:// prefix for TCP connections
      this.baseUrl = dockerHostUrl.replace('tcp://', 'http://');
      // Remove trailing slash if present
      this.baseUrl = this.baseUrl.replace(/\/$/, '');
      this.socketPath = undefined;
    } else {
      // Default to unix socket
      this.socketPath = '/var/run/docker.sock';
      this.baseUrl = '';
    }
  }

  /**
   * Test connection to Docker host
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.request('/_ping');
      return response === 'OK' || response === true;
    } catch (error) {
      console.error('Docker ping failed:', error);
      return false;
    }
  }

  /**
   * Get Docker version info
   */
  async version(): Promise<any> {
    try {
      return await this.request('/version');
    } catch (error) {
      console.error('Failed to get Docker version:', error);
      throw error;
    }
  }

  /**
   * List all containers
   */
  async listContainers(all: boolean = true): Promise<DockerContainer[]> {
    try {
      const params = all ? '?all=true' : '';
      return await this.request(`/containers/json${params}`);
    } catch (error) {
      console.error('Failed to list containers:', error);
      return [];
    }
  }

  /**
   * List all networks
   */
  async listNetworks(): Promise<DockerNetwork[]> {
    try {
      return await this.request('/networks');
    } catch (error) {
      console.error('Failed to list networks:', error);
      return [];
    }
  }

  /**
   * List all volumes
   */
  async listVolumes(): Promise<DockerVolume[]> {
    try {
      const response = await this.request('/volumes');
      return response.Volumes || [];
    } catch (error) {
      console.error('Failed to list volumes:', error);
      return [];
    }
  }

  /**
   * Get comprehensive Docker host information
   */
  async getInfo(): Promise<DockerInfo> {
    try {
      const [version, containers, networks, volumes] = await Promise.all([
        this.version(),
        this.listContainers(true),
        this.listNetworks(),
        this.listVolumes(),
      ]);

      return {
        containers,
        networks,
        volumes,
        serverVersion: version.Version || 'unknown',
      };
    } catch (error) {
      console.error('Failed to get Docker info:', error);
      throw error;
    }
  }

  /**
   * Inspect a specific container
   */
  async inspectContainer(containerId: string): Promise<any> {
    try {
      return await this.request(`/containers/${containerId}/json`);
    } catch (error) {
      console.error(`Failed to inspect container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId: string): Promise<any> {
    try {
      return await this.request(`/containers/${containerId}/stats?stream=false`);
    } catch (error) {
      console.error(`Failed to get container stats ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Docker API
   */
  private async request(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        path,
        method: 'GET',
      };

      // Use Unix socket or TCP connection
      if (this.socketPath) {
        options.socketPath = this.socketPath;
      } else {
        const url = new URL(this.baseUrl);
        options.hostname = url.hostname;
        options.port = url.port || 80;
        options.protocol = url.protocol;
      }

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Docker API error: ${res.statusCode} ${res.statusMessage}`));
          }

          try {
            // Handle plain text responses (like ping)
            if (data.trim() === 'OK') {
              return resolve('OK');
            }

            // Try to parse as JSON
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            // If not JSON, return as text
            resolve(data.trim());
          }
        });
      });

      req.on('error', (error) => {
        const endpoint = this.socketPath || this.baseUrl;
        reject(new Error(`Failed to connect to Docker at ${endpoint}: ${error.message}`));
      });

      req.end();
    });
  }
}

/**
 * Create a Docker client instance for a given host URL
 */
export function createDockerClient(dockerHostUrl: string): DockerClient {
  return new DockerClient(dockerHostUrl);
}
