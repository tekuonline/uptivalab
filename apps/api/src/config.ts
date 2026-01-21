import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  BASE_URL: z.string().default("http://localhost:4173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  APPRISE_URL: z.string().optional(),
  PLAYWRIGHT_WS_ENDPOINT: z.string().optional(),
  DOCKER_SOCKET_PATH: z.string().optional(),
});

const parsed = schema.parse(process.env);

export const appConfig = {
  ...parsed,
  isProduction: parsed.NODE_ENV === "production",
};
