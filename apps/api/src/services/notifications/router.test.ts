/**
 * Unit tests for notification router
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitorResult } from '@uptivalab/monitoring';

// Mock dependencies
vi.mock('../../db/prisma.js', () => ({
  prisma: {
    monitor: {
      findUnique: vi.fn(),
    },
    checkResult: {
      findMany: vi.fn(),
    },
    notificationChannel: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('./smtp.js', () => ({
  emailNotifier: {
    send: vi.fn(),
  },
}));

vi.mock('./webhook.js', () => ({
  webhookNotifier: {
    send: vi.fn(),
  },
}));

vi.mock('./ntfy.js', () => ({
  ntfyNotifier: {
    send: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../config.js', () => ({
  appConfig: {
    BASE_URL: 'http://localhost:4173',
  },
}));

describe('Notification Router', () => {
  // Import after mocks are set up
  let notificationRouter: any;
  let prisma: any;
  let emailNotifier: any;
  let webhookNotifier: any;
  let log: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Re-import to get fresh instances with mocks
    const routerModule = await import('./router.js');
    const prismaModule = await import('../../db/prisma.js');
    const emailModule = await import('./smtp.js');
    const webhookModule = await import('./webhook.js');
    const logModule = await import('../../utils/logger.js');
    
    notificationRouter = routerModule.notificationRouter;
    prisma = prismaModule.prisma;
    emailNotifier = emailModule.emailNotifier;
    webhookNotifier = webhookModule.webhookNotifier;
    log = logModule.log;
  });

  describe('route', () => {
    const mockMonitor = {
      name: 'Test Monitor',
    };

    const mockResult: MonitorResult = {
      monitorId: 'monitor-123',
      status: 'down',
      message: 'Service is down',
      timestamp: new Date(),
      responseTime: 0,
    };

    it('should skip notification when status has not changed', async () => {
      // Mock: same status in current and previous check
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'down' },
      ]);

      await notificationRouter.route(mockResult);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Status unchanged')
      );
      expect(prisma.notificationChannel.findMany).not.toHaveBeenCalled();
    });

    it('should send notification when status changes', async () => {
      // Mock: status changed from up to down
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'email',
          name: 'Email Channel',
          config: { email: 'test@example.com' },
        },
      ]);
      (emailNotifier.send as any).mockResolvedValue(undefined);

      await notificationRouter.route(mockResult);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Status changed')
      );
      expect(prisma.notificationChannel.findMany).toHaveBeenCalled();
      expect(emailNotifier.send).toHaveBeenCalled();
    });

    it('should send notification on first check', async () => {
      // Mock: only one check (first check ever)
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'webhook',
          name: 'Webhook Channel',
          config: { url: 'https://example.com/webhook' },
        },
      ]);
      (webhookNotifier.send as any).mockResolvedValue(undefined);

      await notificationRouter.route(mockResult);

      expect(prisma.notificationChannel.findMany).toHaveBeenCalled();
      expect(webhookNotifier.send).toHaveBeenCalled();
    });

    it('should warn when no notification channels are configured', async () => {
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([]);

      await notificationRouter.route(mockResult);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No notification channels configured')
      );
    });

    it('should enrich result with monitor name and link', async () => {
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'email',
          name: 'Email Channel',
          config: {},
        },
      ]);
      (emailNotifier.send as any).mockResolvedValue(undefined);

      await notificationRouter.route(mockResult);

      expect(emailNotifier.send).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          monitorName: 'Test Monitor',
          message: expect.stringContaining('http://localhost:4173/monitors/monitor-123'),
        })
      );
    });

    it('should add emoji based on status', async () => {
      const upResult: MonitorResult = {
        ...mockResult,
        status: 'up',
        message: 'Service is up',
      };

      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'up' },
        { status: 'down' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'email',
          name: 'Email Channel',
          config: {},
        },
      ]);
      (emailNotifier.send as any).mockResolvedValue(undefined);

      await notificationRouter.route(upResult);

      expect(emailNotifier.send).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: expect.stringContaining('🟢'),
        })
      );
    });

    it('should handle notification send failures gracefully', async () => {
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'email',
          name: 'Email Channel',
          config: {},
        },
      ]);
      (emailNotifier.send as any).mockRejectedValue(new Error('Send failed'));

      // Should not throw
      await expect(notificationRouter.route(mockResult)).resolves.not.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send notification'),
        expect.any(Object)
      );
    });

    it('should send to multiple channels in parallel', async () => {
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'email',
          name: 'Email Channel',
          config: {},
        },
        {
          id: 'channel-2',
          type: 'webhook',
          name: 'Webhook Channel',
          config: {},
        },
      ]);
      (emailNotifier.send as any).mockResolvedValue(undefined);
      (webhookNotifier.send as any).mockResolvedValue(undefined);

      await notificationRouter.route(mockResult);

      expect(emailNotifier.send).toHaveBeenCalledTimes(1);
      expect(webhookNotifier.send).toHaveBeenCalledTimes(1);
    });

    it('should warn when adapter is not found for channel type', async () => {
      (prisma.monitor.findUnique as any).mockResolvedValue(mockMonitor);
      (prisma.checkResult.findMany as any).mockResolvedValue([
        { status: 'down' },
        { status: 'up' },
      ]);
      (prisma.notificationChannel.findMany as any).mockResolvedValue([
        {
          id: 'channel-1',
          type: 'unknown-type',
          name: 'Unknown Channel',
          config: {},
        },
      ]);

      await notificationRouter.route(mockResult);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No adapter found for channel type')
      );
    });
  });
});
