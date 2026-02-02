import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { settingsService } from "../services/settings/service.js";
import { log } from "../utils/logger.js";

// Helper function to get array value from a setting
async function getSettingArrayValue<T = unknown>(key: string): Promise<T[]> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return (setting?.value as T[]) || [];
}

// Helper function to find item by id in a setting array
async function findSettingArrayItem<T extends { id: string }>(
  key: string,
  id: string
): Promise<{ items: T[]; item: T | undefined }> {
  const items = await getSettingArrayValue<T>(key);
  const item = items.find((i) => i.id === id);
  return { items, item };
}

const settingsPlugin = async (fastify: FastifyInstance) => {
  // Get all settings
  fastify.get("/settings", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc: Record<string, any>, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>);

    return settingsMap;
  });

  // Get a specific setting
  fastify.get<{ Params: { key: string } }>("/settings/:key", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    const setting = await prisma.setting.findUnique({
      where: { key: request.params.key },
    });

    if (!setting) {
      return null;
    }

    return setting.value;
  });

  // Update or create a setting
  fastify.put<{ Params: { key: string }; Body: any }>("/settings/:key", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const setting = await prisma.setting.upsert({
      where: { key: request.params.key },
      update: { value: request.body as any },
      create: { key: request.params.key, value: request.body as any },
    });

    // Clear cache
    settingsService.clearCache(request.params.key);

    return setting;
  });

  // Batch update settings
  fastify.post<{ Body: Record<string, any> }>("/settings/batch", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const updates = Object.entries(request.body);
    
    await Promise.all(
      updates.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    // Clear entire cache
    settingsService.clearCache();

    return { success: true };
  });

  // Change password
  fastify.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/settings/change-password",
    { preHandler: fastify.authenticateAnyWithPermission('WRITE') },
    async (request, reply) => {
      const userId = (request.user as any).userId;

      const body = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8),
        })
        .parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.code(404).send({ message: "User not found" });
      }

      if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
        return reply.code(401).send({ message: "Current password is incorrect" });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(body.newPassword) },
      });

      return { success: true };
    }
  );

  // API Keys management
  fastify.get("/settings/api-keys", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    const userId = (request.user as any).userId;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        permissions: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return apiKeys;
  });

  fastify.post<{ Body: { label: string; permissions?: string } }>("/settings/api-keys", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    const userId = (request.user as any).userId;
    
    // Fetch user data from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });
    
    if (!user) {
      return reply.code(401).send({ message: "User not found" });
    }
    
    const userRole = user.role;

    const body = z.object({ 
      label: z.string().min(1),
      permissions: z.enum(["READ", "WRITE"]).optional().default("READ")
    }).parse(request.body);

    // Check permissions: Viewers can only create READ API keys, Admins can create both
    if (body.permissions === "WRITE" && userRole !== "ADMIN") {
      return reply.code(403).send({ message: "Only administrators can create API keys with write permissions" });
    }
    
    // Viewers can only create READ API keys
    if (userRole === "VIEWER" && body.permissions !== "READ") {
      return reply.code(403).send({ message: "Viewers can only create read-only API keys" });
    }

    // Generate a random API key using cryptographically secure random bytes
    const crypto = await import('crypto');
    const token = `ulk_${crypto.randomBytes(24).toString('hex')}`;

    // Hash the token before storing
    const tokenHash = await hashPassword(token);

    const apiKey = await prisma.apiKey.create({
      data: {
        label: body.label,
        tokenHash,
        permissions: body.permissions,
        userId,
      },
      select: {
        id: true,
        label: true,
        permissions: true,
        createdAt: true,
      },
    });

    // Return the plain token only once
    return { id: apiKey.id, token, label: apiKey.label, permissions: apiKey.permissions };
  });

  fastify.delete<{ Params: { id: string } }>("/settings/api-keys/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    const userId = (request.user as any).userId;

    await prisma.apiKey.deleteMany({
      where: { id: request.params.id, userId },
    });

    return { success: true };
  });

  // Docker Hosts management
  fastify.get("/settings/docker-hosts", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    return await getSettingArrayValue("dockerHosts");
  });

  fastify.post<{ Body: { name: string; url: string } }>("/settings/docker-hosts", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const body = z
      .object({
        name: z.string().min(1),
        url: z.string().url(),
      })
      .parse(request.body);

    const setting = await prisma.setting.findUnique({
      where: { key: "dockerHosts" },
    });

    const hosts = (setting?.value as any[]) || [];
    const { randomUUID } = await import('crypto');
    const newHost = { id: randomUUID(), ...body };
    hosts.push(newHost);

    await prisma.setting.upsert({
      where: { key: "dockerHosts" },
      update: { value: hosts },
      create: { key: "dockerHosts", value: hosts },
    });

    return newHost;
  });

  fastify.delete<{ Params: { id: string } }>("/settings/docker-hosts/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const setting = await prisma.setting.findUnique({
      where: { key: "dockerHosts" },
    });

    if (!setting) {
      return { success: true };
    }

    const hosts = ((setting.value as any[]) || []).filter(
      (h: any) => h.id !== request.params.id
    );

    await prisma.setting.update({
      where: { key: "dockerHosts" },
      data: { value: hosts },
    });

    return { success: true };
  });

  // Docker API - Test connection
  fastify.post<{ Params: { id: string }; Body: { dockerHostId: string } }>("/settings/docker-hosts/:id/test", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "dockerHosts" },
      });

      const hosts = (setting?.value as any[]) || [];
      const host = hosts.find((h: any) => h.id === request.params.id);

      if (!host) {
        return reply.code(404).send({ message: "Docker host not found" });
      }

      const { createDockerClient } = await import("../services/docker/client.js");
      const client = createDockerClient(host.url);
      
      const isAlive = await client.ping();
      if (!isAlive) {
        return reply.code(503).send({ message: "Docker host is not reachable" });
      }

      const version = await client.version();
      return { success: true, version: version.Version, apiVersion: version.ApiVersion };
    } catch (error: any) {
      return reply.code(500).send({ message: error.message || "Failed to connect to Docker host" });
    }
  });

  // Docker API - Get containers, networks, volumes
  fastify.get<{ Params: { id: string } }>("/settings/docker-hosts/:id/resources", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "dockerHosts" },
      });

      const hosts = (setting?.value as any[]) || [];
      const host = hosts.find((h: any) => h.id === request.params.id);

      if (!host) {
        return reply.code(404).send({ message: "Docker host not found" });
      }

      const { createDockerClient } = await import("../services/docker/client.js");
      const client = createDockerClient(host.url);
      
      const info = await client.getInfo();
      
      return {
        containers: info.containers.map((c: any) => ({
          id: c.Id.substring(0, 12),
          name: c.Names[0]?.replace(/^\//, '') || 'unknown',
          image: c.Image,
          state: c.State,
          status: c.Status,
        })),
        networks: info.networks.map((n: any) => ({
          id: n.Id.substring(0, 12),
          name: n.Name,
          driver: n.Driver,
          scope: n.Scope,
        })),
        volumes: info.volumes.map((v: any) => ({
          name: v.Name,
          driver: v.Driver,
        })),
        serverVersion: info.serverVersion,
      };
    } catch (error: any) {
      return reply.code(500).send({ message: error.message || "Failed to get Docker resources" });
    }
  });

  // Remote Browsers management (similar to Docker Hosts)
  fastify.get("/settings/remote-browsers", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    const setting = await prisma.setting.findUnique({
      where: { key: "remoteBrowsers" },
    });

    return setting?.value || [];
  });

  fastify.post<{ Body: { name: string; url: string } }>("/settings/remote-browsers", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const body = z
      .object({
        name: z.string().min(1),
        url: z.string().url(),
      })
      .parse(request.body);

    const setting = await prisma.setting.findUnique({
      where: { key: "remoteBrowsers" },
    });

    const browsers = (setting?.value as any[]) || [];
    const { randomUUID } = await import('crypto');
    const newBrowser = { id: randomUUID(), ...body };
    browsers.push(newBrowser);

    await prisma.setting.upsert({
      where: { key: "remoteBrowsers" },
      update: { value: browsers },
      create: { key: "remoteBrowsers", value: browsers },
    });

    return newBrowser;
  });

  fastify.delete<{ Params: { id: string } }>("/settings/remote-browsers/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const setting = await prisma.setting.findUnique({
      where: { key: "remoteBrowsers" },
    });

    if (!setting) {
      return { success: true };
    }

    const browsers = ((setting.value as any[]) || []).filter(
      (b: any) => b.id !== request.params.id
    );

    await prisma.setting.update({
      where: { key: "remoteBrowsers" },
      data: { value: browsers },
    });

    return { success: true };
  });

  // Test remote browser connection
  fastify.post<{ Body: { url: string } }>("/settings/remote-browsers/test", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {

    const body = z
      .object({
        url: z.string().url(),
      })
      .parse(request.body);

    try {
      // Import playwright-core dynamically
      const { chromium } = await import("playwright-core");
      
      // Try to connect with a 10 second timeout
      const browser = await chromium.connect(body.url, { timeout: 10000 });
      
      // Get browser version info
      const version = browser.version();
      
      // Close the connection
      await browser.close();
      
      return {
        success: true,
        message: `Connected successfully! Browser version: ${version}`,
      };
    } catch (error) {
      log.error("Failed to connect to remote browser:", error);
      return reply.code(400).send({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    }
  });

  // Proxies management
  fastify.get("/settings/proxies", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    const setting = await prisma.setting.findUnique({
      where: { key: "proxies" },
    });

    return setting?.value || [];
  });

  fastify.post<{ Body: { name: string; protocol: string; host: string; port: number; auth?: { username: string; password: string } } }>(
    "/settings/proxies",
    { preHandler: fastify.authenticateAnyWithPermission('WRITE') },
    async (request) => {

      const body = z
        .object({
          name: z.string().min(1),
          protocol: z.enum(["http", "https", "socks4", "socks5"]),
          host: z.string().min(1),
          port: z.number().min(1).max(65535),
          auth: z.object({
            username: z.string(),
            password: z.string(),
          }).optional(),
        })
        .parse(request.body);

      const setting = await prisma.setting.findUnique({
        where: { key: "proxies" },
      });

      const proxies = (setting?.value as any[]) || [];
      const { randomUUID } = await import('crypto');
      const newProxy = { id: randomUUID(), ...body };
      proxies.push(newProxy);

      await prisma.setting.upsert({
        where: { key: "proxies" },
        update: { value: proxies },
        create: { key: "proxies", value: proxies },
      });

      return newProxy;
    }
  );

  fastify.delete<{ Params: { id: string } }>("/settings/proxies/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {

    const setting = await prisma.setting.findUnique({
      where: { key: "proxies" },
    });

    if (!setting) {
      return { success: true };
    }

    const proxies = ((setting.value as any[]) || []).filter(
      (p: any) => p.id !== request.params.id
    );

    await prisma.setting.update({
      where: { key: "proxies" },
      data: { value: proxies },
    });

    return { success: true };
  });

  // Check for updates
  fastify.get("/settings/check-updates", async () => {
    const { updateChecker } = await import("../services/updates/checker.js");
    const versionInfo = await updateChecker.checkForUpdates();
    return versionInfo;
  });

  // Export all settings and configuration
  fastify.post<{ Body: { encrypt?: boolean; password?: string } }>("/settings/export", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {

    try {
      const { encrypt = false, password } = request.body;
      // Gather all data to export
      const [
        settings,
        monitors,
        monitorGroups,
        tags,
        notificationChannels,
        maintenanceWindows,
        statusPages,
        apiKeys,
        dockerHosts,
        remoteBrowsers,
        proxies,
        users,
        invitations,
      ] = await Promise.all([
        prisma.setting.findMany().catch((error) => {
          log.error("Failed to fetch settings for export:", error);
          return [];
        }),
        prisma.monitor.findMany({
          include: {
            tags: { include: { tag: true } },
            notificationChannels: true,
            statusPages: true,
            group: true,
          },
        }).catch((error) => {
          log.error("Failed to fetch monitors for export:", error);
          return [];
        }),
        prisma.monitorGroup.findMany().catch((error) => {
          log.error("Failed to fetch monitor groups for export:", error);
          return [];
        }),
        prisma.tag.findMany().catch((error) => {
          log.error("Failed to fetch tags for export:", error);
          return [];
        }),
        prisma.notificationChannel.findMany().catch((error) => {
          log.error("Failed to fetch notification channels for export:", error);
          return [];
        }),
        prisma.maintenanceWindow.findMany({
          include: { monitors: true },
        }).catch((error) => {
          log.error("Failed to fetch maintenance windows for export:", error);
          return [];
        }),
        prisma.publicStatusPage.findMany({
          include: { monitors: true },
        }).catch((error) => {
          log.error("Failed to fetch status pages for export:", error);
          return [];
        }),
        prisma.apiKey.findMany({
          include: { user: { select: { email: true } } },
        }).catch((error) => {
          log.error("Failed to fetch API keys for export:", error);
          return [];
        }),
        prisma.setting.findUnique({ where: { key: "dockerHosts" } }).catch((error) => {
          log.error("Failed to fetch docker hosts setting for export:", error);
          return null;
        }),
        prisma.setting.findUnique({ where: { key: "remoteBrowsers" } }).catch((error) => {
          log.error("Failed to fetch remote browsers setting for export:", error);
          return null;
        }),
        prisma.setting.findUnique({ where: { key: "proxies" } }).catch((error) => {
          log.error("Failed to fetch proxies setting for export:", error);
          return null;
        }),
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        }).catch((error) => {
          log.error("Failed to fetch users for export:", error);
          return [];
        }),
        prisma.userInvitation.findMany({
          include: { createdBy: { select: { email: true } } },
        }).catch((error) => {
          log.error("Failed to fetch user invitations for export:", error);
          return [];
        }),
      ]);

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: settings.reduce((acc: Record<string, any>, s: any) => {
          acc[s.key] = s.value;
          return acc;
        }, {}),
        monitors: monitors.map(m => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          config: m.config,
          interval: m.interval,
          timeout: m.timeout,
          paused: m.paused,
          tags: m.tags.map(mt => mt.tag.name),
          notificationChannelIds: m.notificationChannels.map(nc => nc.id),
          statusPageIds: m.statusPages.map(sp => sp.id),
          groupName: m.group?.name,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        monitorGroups,
        tags,
        notificationChannels,
        maintenanceWindows: maintenanceWindows.map(mw => ({
          id: mw.id,
          name: mw.name,
          startsAt: mw.startsAt,
          endsAt: mw.endsAt,
          monitorIds: mw.monitors.map(m => m.id),
          createdAt: mw.createdAt,
        })),
        statusPages: statusPages.map(sp => ({
          id: sp.id,
          name: sp.name,
          slug: sp.slug,
          monitorIds: sp.monitors.map(m => m.id),
          createdAt: sp.createdAt,
        })),
        // apiKeys: apiKeys.map(ak => ({
        //   id: ak.id,
        //   label: ak.label,
        //   userEmail: ak.user.email,
        //   createdAt: ak.createdAt,
        // })),
        dockerHosts: dockerHosts?.value || [],
        remoteBrowsers: remoteBrowsers?.value || [],
        proxies: proxies?.value || [],
        users,
        invitations: invitations.map(inv => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          // Token excluded for security - user can recreate invitations if needed
          expiresAt: inv.expiresAt,
          createdByEmail: inv.createdBy.email,
          createdAt: inv.createdAt,
        })),
      };

      let jsonData = JSON.stringify(exportData, null, 2);

      // Encrypt if requested and password provided
      if (encrypt && password) {
        const crypto = await import("crypto");
        const algorithm = "aes-256-gcm";
        const key = crypto.scryptSync(password, "salt", 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key as any);
        (cipher as any).setAAD(Buffer.from("uptivalab-export"));
        
        let encrypted = cipher.update(jsonData, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const authTag = cipher.getAuthTag();
        
        jsonData = JSON.stringify({
          encrypted: true,
          data: encrypted,
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
        }, null, 2);
      }

      reply
        .header("Content-Type", "application/json")
        .header("Content-Disposition", `attachment; filename="uptivalab-settings-${new Date().toISOString().split('T')[0]}.json"`)
        .send(jsonData);
    } catch (error) {
      log.error("Export error:", error);
      return reply.code(500).send({ message: "Failed to export settings" });
    }
  });

  // Import settings and configuration
  fastify.post<{ Body: { data: string; password?: string } }>("/settings/import", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {

    const { data, password } = request.body;

    try {
      let importData: any;

      // Try to parse as JSON first
      try {
        importData = JSON.parse(data);
      } catch {
        return reply.code(400).send({ message: "Invalid JSON data" });
      }

      // Decrypt if needed
      if (importData.encrypted && password) {
        const crypto = await import("crypto");
        const algorithm = "aes-256-gcm";
        const key = crypto.scryptSync(password, "salt", 32);
        const iv = Buffer.from(importData.iv, "hex");
        const decipher = crypto.createDecipher(algorithm, key as any);
        (decipher as any).setAAD(Buffer.from("uptivalab-export"));
        (decipher as any).setAuthTag(Buffer.from(importData.authTag, "hex"));
        
        let decrypted = decipher.update(importData.data, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        importData = JSON.parse(decrypted);
      } else if (importData.encrypted) {
        return reply.code(400).send({ message: "Password required for encrypted data" });
      }

      // Validate import data structure
      if (!importData.version || !importData.settings) {
        return reply.code(400).send({ message: "Invalid import data format" });
      }

      // Start transaction for atomic import
      await prisma.$transaction(async (tx) => {
        // Clear existing data (optional - could be configurable)
        await tx.monitor.deleteMany();
        await tx.monitorGroup.deleteMany();
        await tx.tag.deleteMany();
        await tx.notificationChannel.deleteMany();
        await tx.maintenanceWindow.deleteMany();
        await tx.publicStatusPage.deleteMany();
        await tx.apiKey.deleteMany();
        await tx.userInvitation.deleteMany();
        // Keep users and settings for now

        // Import settings
        for (const [key, value] of Object.entries(importData.settings)) {
          await tx.setting.upsert({
            where: { key },
            update: { value: value as any },
            create: { key, value: value as any },
          });
        }

        // Import tags first (needed for monitors)
        for (const tag of importData.tags || []) {
          await tx.tag.upsert({
            where: { id: tag.id },
            update: tag,
            create: tag,
          });
        }

        // Import monitor groups
        for (const group of importData.monitorGroups || []) {
          await tx.monitorGroup.upsert({
            where: { id: group.id },
            update: group,
            create: group,
          });
        }

        // Import notification channels
        for (const channel of importData.notificationChannels || []) {
          await tx.notificationChannel.upsert({
            where: { id: channel.id },
            update: channel,
            create: channel,
          });
        }

        // Import monitors
        for (const monitor of importData.monitors || []) {
          const { tags: tagNames, notificationChannelIds, statusPageIds, groupName, ...monitorData } = monitor;
          
          const createdMonitor = await tx.monitor.upsert({
            where: { id: monitor.id },
            update: monitorData,
            create: monitorData,
          });

          // Connect tags
          if (tagNames?.length) {
            const tagIds = await Promise.all(
              tagNames.map(async (name: string) => {
                const tag = await tx.tag.findUnique({ where: { name } });
                return tag?.id;
              })
            );
            
            await tx.monitor.update({
              where: { id: createdMonitor.id },
              data: {
                tags: {
                  create: tagIds.filter(Boolean).map((id: string) => ({ tagId: id })),
                },
              },
            });
          }

          // Connect notification channels
          if (notificationChannelIds?.length) {
            // Filter to only existing channels
            const existingChannels = await Promise.all(
              notificationChannelIds.map(async (id: string) => {
                const channel = await tx.notificationChannel.findUnique({ where: { id } });
                return channel ? id : null;
              })
            );
            const validChannelIds = existingChannels.filter(Boolean);
            
            if (validChannelIds.length > 0) {
              await tx.monitor.update({
                where: { id: createdMonitor.id },
                data: {
                  notificationChannels: {
                    connect: validChannelIds.map((id: string) => ({ id })),
                  },
                },
              });
            }
          }

          // Connect group
          if (groupName) {
            const group = await tx.monitorGroup.findFirst({ where: { name: groupName } });
            if (group) {
              await tx.monitor.update({
                where: { id: createdMonitor.id },
                data: { groupId: group.id },
              });
            }
          }
        }

        // Import status pages
        for (const page of importData.statusPages || []) {
          const { monitorIds, ...pageData } = page;
          const createdPage = await tx.publicStatusPage.upsert({
            where: { id: page.id },
            update: pageData,
            create: pageData,
          });

          // Connect monitors
          if (monitorIds?.length) {
            // Filter to only existing monitors
            const existingMonitors = await Promise.all(
              monitorIds.map(async (id: string) => {
                const monitor = await tx.monitor.findUnique({ where: { id } });
                return monitor ? id : null;
              })
            );
            const validMonitorIds = existingMonitors.filter(Boolean);
            
            if (validMonitorIds.length > 0) {
              await tx.publicStatusPage.update({
                where: { id: createdPage.id },
                data: {
                  monitors: {
                    connect: validMonitorIds.map((id: string) => ({ id })),
                  },
                },
              });
            }
          }
        }

        // Import maintenance windows
        for (const window of importData.maintenanceWindows || []) {
          const { monitorIds, ...windowData } = window;
          const createdWindow = await tx.maintenanceWindow.upsert({
            where: { id: window.id },
            update: windowData,
            create: windowData,
          });

          // Connect monitors
          if (monitorIds?.length) {
            // Filter to only existing monitors
            const existingMonitors = await Promise.all(
              monitorIds.map(async (id: string) => {
                const monitor = await tx.monitor.findUnique({ where: { id } });
                return monitor ? id : null;
              })
            );
            const validMonitorIds = existingMonitors.filter(Boolean);
            
            if (validMonitorIds.length > 0) {
              await tx.maintenanceWindow.update({
                where: { id: createdWindow.id },
                data: {
                  monitors: {
                    connect: validMonitorIds.map((id: string) => ({ id })),
                  },
                },
              });
            }
          }
        }

        // Import API keys
        // for (const apiKey of importData.apiKeys || []) {
        //   const { userEmail, ...keyData } = apiKey;
        //   const user = await tx.user.findUnique({ where: { email: userEmail } });
        //   if (user) {
        //     await tx.apiKey.upsert({
        //       where: { id: keyData.id },
        //       update: { ...keyData, userId: user.id },
        //       create: { ...keyData, userId: user.id },
        //     });
        //   }
        // }

        // Import invitations
        for (const invitation of importData.invitations || []) {
          const { createdByEmail, ...invData } = invitation;
          const creator = await tx.user.findUnique({ where: { email: createdByEmail } });
          if (creator) {
            await tx.userInvitation.upsert({
              where: { id: invitation.id },
              update: { ...invData, createdById: creator.id },
              create: { ...invData, createdById: creator.id },
            });
          }
        }
      });

      // Clear settings cache
      settingsService.clearCache();

      return { success: true, message: "Settings imported successfully" };
    } catch (error) {
      const err = error as any;
      log.error("Import error details:", err);
      log.error("Error stack:", err.stack);
      return reply.code(500).send({ message: "Failed to import settings", details: err.message });
    }
  });

  // Language preference management (GET is public for status pages)
  fastify.get("/settings/language", async (request) => {
    const setting = await prisma.setting.findUnique({
      where: { key: "language" },
    });
    return setting?.value || "en";
  });

  fastify.put<{ Body: { language: string } }>("/settings/language", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    const body = z.object({
      language: z.enum(["en", "es", "de", "fr", "zh", "ja"])
    }).parse(request.body);

    const setting = await prisma.setting.upsert({
      where: { key: "language" },
      update: { value: body.language },
      create: { key: "language", value: body.language },
    });

    // Clear cache
    settingsService.clearCache("language");

    return { language: setting.value };
  });

  // Database cleanup management endpoints
  fastify.get("/settings/database/stats", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    const { databaseCleanupService } = await import("../services/database-cleanup.js");
    return await databaseCleanupService.getStats();
  });

  fastify.post("/settings/database/cleanup", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    const { databaseCleanupService } = await import("../services/database-cleanup.js");
    return await databaseCleanupService.runCleanup();
  });

  fastify.get("/settings/database/cleanup-config", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    const { databaseCleanupService } = await import("../services/database-cleanup.js");
    // Return the current configuration (this is a simple implementation)
    return {
      keepSuccessfulChecksDays: 30,
      keepFailedChecksDays: 90,
      keepScreenshotsDays: 30,
      maxChecksPerMonitor: 1000,
      cleanupIntervalHours: 24,
    };
  });
};

export default fp(settingsPlugin);
