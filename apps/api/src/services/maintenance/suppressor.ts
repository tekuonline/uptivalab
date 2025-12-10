import { prisma } from "../../db/prisma.js";

export const maintenanceService = {
  async getActiveWindow(monitorId: string, at = new Date()) {
    return prisma.maintenanceWindow.findFirst({
      where: {
        monitors: { some: { id: monitorId } },
        startsAt: { lte: at },
        endsAt: { gte: at },
      },
    });
  },

  async isSuppressed(monitorId: string, at = new Date()) {
    const window = await this.getActiveWindow(monitorId, at);
    return Boolean(window);
  },
};
