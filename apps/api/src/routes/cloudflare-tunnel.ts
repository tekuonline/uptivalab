import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { cloudflareTunnel } from "../services/cloudflare-tunnel/service.js";

const cloudflareTunnelPlugin = async (fastify: FastifyInstance) => {
  // Get tunnel status
  fastify.get("/cloudflare-tunnel/status", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request) => {
    
    const status = cloudflareTunnel.getStatus();
    const installed = await cloudflareTunnel.isInstalled();
    
    return {
      running: status.running,
      installed,
    };
  });

  // Start tunnel
  fastify.post("/cloudflare-tunnel/start", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    
    const result = await cloudflareTunnel.start();
    return result;
  });

  // Stop tunnel
  fastify.post("/cloudflare-tunnel/stop", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    
    const result = await cloudflareTunnel.stop();
    return result;
  });

  // Restart tunnel
  fastify.post("/cloudflare-tunnel/restart", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    
    const result = await cloudflareTunnel.restart();
    return result;
  });
};

export default fp(cloudflareTunnelPlugin);
