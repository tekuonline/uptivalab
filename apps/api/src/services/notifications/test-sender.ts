/**
 * Test notification sender - sends test notifications to verify channel configuration
 */

import { emailNotifier } from "./smtp.js";
import { webhookNotifier } from "./webhook.js";
import { ntfyNotifier } from "./ntfy.js";

type NotificationType = "email" | "ntfy" | "webhook" | "discord" | "slack" | "telegram" | "gotify" | "pushover" | "apprise";

interface TestResult {
  success: boolean;
  error?: string;
}

/**
 * Send a test notification to verify channel configuration
 */
export async function sendTestNotification(
  type: NotificationType,
  config: Record<string, any>
): Promise<TestResult> {
  try {
    // Create a mock notification channel
    const mockChannel = {
      id: "test",
      name: "Test Channel",
      type,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create a test result
    const testResult = {
      monitorId: "test-monitor",
      monitorName: "Test Monitor",
      status: "up" as const,
      message: "🧪 This is a test notification from UptivaLab",
      responseTime: 123,
      statusCode: 200,
      timestamp: new Date(),
      checkedAt: new Date().toISOString(),
    };

    // Route to appropriate sender based on type
    switch (type) {
      case "email":
        await emailNotifier.send(mockChannel as any, testResult);
        break;
      case "ntfy":
        await ntfyNotifier.send(mockChannel as any, testResult);
        break;
      case "webhook":
      case "discord":
      case "slack":
        await webhookNotifier.send(mockChannel as any, testResult);
        break;
      case "telegram":
        await sendTelegramTest(config);
        break;
      case "gotify":
        await sendGotifyTest(config);
        break;
      case "pushover":
        await sendPushoverTest(config);
        break;
      case "apprise":
        await sendAppriseTest(config);
        break;
      default:
        return { success: false, error: `Unsupported notification type: ${type}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Test notification failed:", error);
    return { 
      success: false, 
      error: error.message || "Unknown error occurred" 
    };
  }
}

// Helper functions for notification types not yet implemented
async function sendTelegramTest(config: Record<string, any>): Promise<void> {
  const { botToken, chatId } = config;
  if (!botToken || !chatId) {
    throw new Error("Missing botToken or chatId");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🧪 This is a test notification from UptivaLab",
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.description || `Telegram API error: ${response.status}`);
  }
}

async function sendGotifyTest(config: Record<string, any>): Promise<void> {
  const { serverUrl, appToken } = config;
  if (!serverUrl || !appToken) {
    throw new Error("Missing serverUrl or appToken");
  }

  const url = `${serverUrl.replace(/\/$/, '')}/message?token=${appToken}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Notification",
      message: "🧪 This is a test notification from UptivaLab",
      priority: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gotify API error: ${response.status} ${response.statusText}`);
  }
}

async function sendPushoverTest(config: Record<string, any>): Promise<void> {
  const { userKey, apiToken } = config;
  if (!userKey || !apiToken) {
    throw new Error("Missing userKey or apiToken");
  }

  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: apiToken,
      user: userKey,
      title: "Test Notification",
      message: "🧪 This is a test notification from UptivaLab",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0] || `Pushover API error: ${response.status}`);
  }
}

async function sendAppriseTest(config: Record<string, any>): Promise<void> {
  const { url } = config;
  if (!url) {
    throw new Error("Missing Apprise URL");
  }

  // Apprise URLs are self-contained (e.g., discord://webhook_id/webhook_token)
  // We would need an Apprise server to handle this properly
  throw new Error("Apprise testing requires an Apprise server setup. Please configure and test manually.");
}
