import pg from "pg";
const { Client: PgClient } = pg;
import mysql from "mysql2/promise";
import { createClient as createRedisClient } from "redis";
import { MongoClient } from "mongodb";
import type {
  BaseMonitor,
  MonitorAdapter,
  MonitorResult,
  DatabaseConfig,
} from "../types.js";

const toConfig = (config: Record<string, unknown>): DatabaseConfig => {
  if (typeof config.variant !== "string") {
    throw new Error("Database monitor requires variant");
  }
  if (typeof config.connectionString !== "string") {
    throw new Error("Database monitor requires connectionString");
  }
  return {
    variant: config.variant as DatabaseConfig["variant"],
    connectionString: config.connectionString,
    query: typeof config.query === "string" ? config.query : undefined,
  };
};

export const databaseAdapter: MonitorAdapter = {
  kind: "database",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);

    try {
      switch (config.variant) {
        case "postgres":
          await checkPostgres(config);
          break;
        case "mysql":
        case "mariadb":
          await checkMysql(config);
          break;
        case "redis":
          await checkRedis(config);
          break;
        case "mongodb":
          await checkMongo(config);
          break;
        default:
          throw new Error(`Unsupported database variant ${config.variant}`);
      }

      return {
        monitorId: monitor.id,
        status: "up",
        message: `${config.variant} connection ok`,
        checkedAt: new Date().toISOString(),
        meta: {
          dbVariant: config.variant,
        },
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        meta: {
          dbVariant: config.variant,
        },
      };
    }
  },
};

const checkPostgres = async (config: DatabaseConfig) => {
  const client = new PgClient({ connectionString: config.connectionString });
  await client.connect();
  const query = config.query ?? "SELECT 1";
  await client.query(query);
  await client.end();
};

const checkMysql = async (config: DatabaseConfig) => {
  const connection = await mysql.createConnection(config.connectionString);
  const query = config.query ?? "SELECT 1";
  await connection.query(query);
  await connection.end();
};

const checkRedis = async (config: DatabaseConfig) => {
  const client = createRedisClient({ url: config.connectionString });
  await client.connect();
  await client.ping();
  await client.quit();
};

const checkMongo = async (config: DatabaseConfig) => {
  const client = new MongoClient(config.connectionString);
  await client.connect();
  const db = client.db();
  await db.command({ ping: 1 });
  await client.close();
};
