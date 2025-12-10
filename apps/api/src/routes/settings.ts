import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { settingsService } from "../services/settings/service.js";

const settingsPlugin = async (fastify: FastifyInstance) => {
  // Get all settings
  fastify.get("/settings", async (request) => {
    await request.jwtVerify();
    
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc: Record<string, any>, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>);

    return settingsMap;
  });

  // Get a specific setting
  fastify.get<{ Params: { key: string } }>("/settings/:key", async (request) => {
    await request.jwtVerify();
    
    const setting = await prisma.setting.findUnique({
      where: { key: request.params.key },
    });

    if (!setting) {
      return null;
    }

    return setting.value;
  });

  // Update or create a setting
  fastify.put<{ Params: { key: string }; Body: any }>("/settings/:key", async (request) => {
    await request.jwtVerify();

    const setting = await prisma.setting.upsert({
      where: { key: request.params.key },
      update: { value: request.body },
      create: { key: request.params.key, value: request.body },
    });

    // Clear cache
    settingsService.clearCache(request.params.key);

    return setting;
  });

  // Batch update settings
  fastify.post<{ Body: Record<string, any> }>("/settings/batch", async (request) => {
    await request.jwtVerify();

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
    async (request, reply) => {
      await request.jwtVerify();
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
  fastify.get("/settings/api-keys", async (request) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return apiKeys;
  });

  fastify.post<{ Body: { label: string } }>("/settings/api-keys", async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId;

    const body = z.object({ label: z.string().min(1) }).parse(request.body);

    // Generate a random API key
    const token = `ulk_${Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2)
    ).join("")}`;

    // Hash the token before storing
    const tokenHash = await hashPassword(token);

    const apiKey = await prisma.apiKey.create({
      data: {
        label: body.label,
        tokenHash,
        userId,
      },
    });

    // Return the plain token only once
    return { id: apiKey.id, token, label: apiKey.label };
  });

  fastify.delete<{ Params: { id: string } }>("/settings/api-keys/:id", async (request, reply) => {
    await request.jwtVerify();
    const userId = (request.user as any).userId;

    await prisma.apiKey.deleteMany({
      where: { id: request.params.id, userId },
    });

    return { success: true };
  });

  // Docker Hosts management
  fastify.get("/settings/docker-hosts", async (request) => {
    await request.jwtVerify();
    
    const setting = await prisma.setting.findUnique({
      where: { key: "dockerHosts" },
    });

    return setting?.value || [];
  });

  fastify.post<{ Body: { name: string; url: string } }>("/settings/docker-hosts", async (request) => {
    await request.jwtVerify();

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
    const newHost = { id: Date.now().toString(), ...body };
    hosts.push(newHost);

    await prisma.setting.upsert({
      where: { key: "dockerHosts" },
      update: { value: hosts },
      create: { key: "dockerHosts", value: hosts },
    });

    return newHost;
  });

  fastify.delete<{ Params: { id: string } }>("/settings/docker-hosts/:id", async (request) => {
    await request.jwtVerify();

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

  // Remote Browsers management (similar to Docker Hosts)
  fastify.get("/settings/remote-browsers", async (request) => {
    await request.jwtVerify();
    
    const setting = await prisma.setting.findUnique({
      where: { key: "remoteBrowsers" },
    });

    return setting?.value || [];
  });

  fastify.post<{ Body: { name: string; url: string } }>("/settings/remote-browsers", async (request) => {
    await request.jwtVerify();

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
    const newBrowser = { id: Date.now().toString(), ...body };
    browsers.push(newBrowser);

    await prisma.setting.upsert({
      where: { key: "remoteBrowsers" },
      update: { value: browsers },
      create: { key: "remoteBrowsers", value: browsers },
    });

    return newBrowser;
  });

  fastify.delete<{ Params: { id: string } }>("/settings/remote-browsers/:id", async (request) => {
    await request.jwtVerify();

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

  // Proxies management
  fastify.get("/settings/proxies", async (request) => {
    await request.jwtVerify();
    
    const setting = await prisma.setting.findUnique({
      where: { key: "proxies" },
    });

    return setting?.value || [];
  });

  fastify.post<{ Body: { name: string; protocol: string; host: string; port: number; auth?: { username: string; password: string } } }>(
    "/settings/proxies",
    async (request) => {
      await request.jwtVerify();

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
      const newProxy = { id: Date.now().toString(), ...body };
      proxies.push(newProxy);

      await prisma.setting.upsert({
        where: { key: "proxies" },
        update: { value: proxies },
        create: { key: "proxies", value: proxies },
      });

      return newProxy;
    }
  );

  fastify.delete<{ Params: { id: string } }>("/settings/proxies/:id", async (request) => {
    await request.jwtVerify();

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
};

export default fp(settingsPlugin);
