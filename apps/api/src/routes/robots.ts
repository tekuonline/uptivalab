import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { settingsService } from "../services/settings/service.js";

const robotsPlugin = async (fastify: FastifyInstance) => {
  fastify.get("/robots.txt", async (request, reply) => {
    const visibility = await settingsService.get<string>("searchEngineVisibility", "allow");
    
    let robotsTxt = "";
    
    if (visibility === "discourage") {
      robotsTxt = `User-agent: *
Disallow: /`;
    } else {
      robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /status/`;
    }
    
    reply.type("text/plain").send(robotsTxt);
  });
};

export default fp(robotsPlugin);
