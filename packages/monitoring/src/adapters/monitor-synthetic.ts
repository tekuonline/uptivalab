import { firefox, type BrowserType, type Page, type Browser } from "playwright-core";
import { promises as fs } from "fs";
import path from "path";
import type {
  BaseMonitor,
  MonitorAdapter,
  MonitorResult,
  SyntheticConfig,
  SyntheticStep,
  MonitorResultMeta,
} from "../types.js";

const browsers: Record<string, BrowserType> = {
  firefox,
};

const toConfig = (config: Record<string, unknown>): SyntheticConfig => {
  const steps = Array.isArray(config.steps) ? (config.steps as SyntheticStep[]) : [];
  if (!steps.length) {
    throw new Error("Synthetic monitor requires steps");
  }
  return {
    steps,
    browser: "firefox",
    baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : undefined,
    remoteBrowserId: typeof config.remoteBrowserId === "string" ? config.remoteBrowserId : undefined,
    useLocalBrowser: typeof config.useLocalBrowser === "boolean" ? config.useLocalBrowser : true,
    ignoreHTTPSErrors: typeof config.ignoreHTTPSErrors === "boolean" ? config.ignoreHTTPSErrors : true,
    captureScreenshots: typeof config.captureScreenshots === "boolean" ? config.captureScreenshots : false,
  };
};

// Helper to get remote browser WebSocket endpoint
const getRemoteBrowserEndpoint = async (remoteBrowserId?: string): Promise<string | null> => {
  try {
    // Get remote browsers from environment or settings
    const playwrightWsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
    
    // If no specific browser ID requested, use default endpoint from environment
    if (!remoteBrowserId) {
      return playwrightWsEndpoint || null;
    }
    
    // For now, return the default endpoint even if browser ID is specified
    // In the future, this could fetch from database based on remoteBrowserId
    return playwrightWsEndpoint || null;
  } catch (error) {
    return null;
  }
};

// Helper to connect to browser (embedded local or remote)
const connectToBrowser = async (
  config: SyntheticConfig,
  launchTimeout: number
): Promise<{ browser: Browser; isRemote: boolean }> => {
  const browserType = firefox;
  
  // Check if USE_REMOTE_BROWSER env is explicitly set to force remote browser
  const forceRemote = process.env.USE_REMOTE_BROWSER === 'true';
  
  // Use local embedded browser by default (unless remote is forced or explicitly requested)
  if (!forceRemote && config.useLocalBrowser !== false) {
    let executablePath = '';
    try {
      
      // Optimized Firefox launch arguments
      const launchArgs = [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-popup-blocking',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
      ];

      // Firefox browser executable path (set by playwright install)
      // Find the firefox directory dynamically
      const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright';
      
      try {
        const entries = await fs.readdir(browsersPath);
        const firefoxDir = entries.find(f => f.startsWith('firefox-'));
        if (firefoxDir) {
          executablePath = path.join(browsersPath, firefoxDir, 'firefox', 'firefox');
        }
      } catch (e) {
        // If directory read fails, use default path
      }

      if (!executablePath) {
        executablePath = '/ms-playwright/firefox-1509/firefox/firefox';
      }

      const browser = await browserType.launch({
        headless: true,
        timeout: launchTimeout,
        executablePath,
        args: launchArgs,
      });
      return { browser, isRemote: false };
    } catch (error) {
      // Fall through to try remote browser
    }
  }
  
  // Try remote browser if local fails or is explicitly disabled
  const wsEndpoint = await getRemoteBrowserEndpoint(config.remoteBrowserId);
  
  if (wsEndpoint) {
    // Retry connecting to remote browser
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await browserType.connect(wsEndpoint, { timeout: launchTimeout });
        return { browser, isRemote: true };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw new Error(
      `Failed to connect to remote Playwright browser after ${maxRetries} attempts. ` +
      `Last error: ${lastError?.message}. Please ensure the Playwright service is running or disable remote browser mode.`
    );
  }
  
  // No remote browser available
  throw new Error(
    "No browser available. Local browser failed and no remote browser endpoint configured. " +
    "Please check that Playwright browsers are installed or configure PLAYWRIGHT_WS_ENDPOINT."
  );
};

export const syntheticAdapter: MonitorAdapter = {
  kind: "synthetic",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const launchTimeout = monitor.timeout ?? 30000;

  const journeySteps: NonNullable<MonitorResultMeta["journeySteps"]> = [];
    const start = Date.now();

    // Try different browsers if HTTP/2 errors persist
    // Since we only have Firefox installed locally, prioritize it for local browser attempts
    const browsersToTry = config.useLocalBrowser 
      ? ["firefox"]  // Only try firefox if using local browser (it's the only one installed)
      : [config.browser ?? "chromium"];  // For remote, try the requested browser or default to chromium
    
    if (!config.useLocalBrowser) {
      if (config.browser === "chromium") {
        browsersToTry.push("firefox", "webkit");
      } else if (config.browser === "firefox") {
        browsersToTry.push("chromium", "webkit");
      } else {
        browsersToTry.push("chromium", "firefox");
      }
    }

    let lastBrowserError: Error | null = null;

    for (const browserType of browsersToTry) {
      try {
        // Temporarily override browser for this attempt
        const attemptConfig = { ...config, browser: browserType };
        const { browser, isRemote } = await connectToBrowser(attemptConfig, launchTimeout);
        const context = await browser.newContext({
          ignoreHTTPSErrors: attemptConfig.ignoreHTTPSErrors ?? true, // Handle SSL/TLS certificate issues
          // Additional options to handle HTTP/2 issues and avoid detection
          extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
          },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 720 },
          deviceScaleFactor: 1,
          hasTouch: false,
          isMobile: false,
          // Try to avoid headless detection
          locale: 'en-US',
          timezoneId: 'America/New_York',
        });
        const page = await context.newPage();
        
        // Add a small delay to let the browser initialize
        await page.waitForTimeout(1000);

        let browserFailed = false;
        for (const step of config.steps) {
          const label = step.action.toUpperCase();
          try {
            await runStep(page, step, config.baseUrl);

            // Only capture screenshots on failure - not on success for performance
            journeySteps.push({ label, status: "up" });
          } catch (error) {
            const stepError = error instanceof Error ? error : new Error(String(error));
            // Capture screenshot on failure for debugging
            let screenshot: string | undefined;
            try {
              const screenshotBuffer = await page.screenshot({
                type: 'png',
                fullPage: false, // Capture viewport only for performance
                timeout: 5000
              });
              screenshot = screenshotBuffer.toString('base64');
            } catch (screenshotError) {
              // Failed to capture screenshot, continue
            }

            journeySteps.push({
              label,
              status: "down",
              detail: stepError.message,
              screenshot: screenshot, // Include screenshot data for storage
            });
            
            // Check if this is an HTTP/2 error that should trigger browser fallback
            const isHttp2Error = stepError.message.includes('HTTP2') || 
                                stepError.message.includes('ERR_HTTP2') ||
                                stepError.message.includes('Protocol error');
            
            if (isHttp2Error && browserType !== browsersToTry[browsersToTry.length - 1]) {
              // This is an HTTP/2 error and we haven't tried all browsers yet
              browserFailed = true;
              await browser.close();
              break; // Break out of step loop to try next browser
            } else {
              // Not an HTTP/2 error or we've tried all browsers, fail the monitor
              await browser.close();
              return {
                monitorId: monitor.id,
                status: "down",
                message: `Synthetic step failed: ${label}`,
                checkedAt: new Date().toISOString(),
                meta: { journeySteps },
              };
            }
          }
        }

        if (!browserFailed) {
          // All steps succeeded with this browser
          await browser.close();
          
          const browserInfo = isRemote ? " (remote)" : ` (local, ${browserType})`;
          return {
            monitorId: monitor.id,
            status: "up",
            message: `Synthetic journey ok (${Date.now() - start}ms)${browserInfo}` ,
            checkedAt: new Date().toISOString(),
            meta: { journeySteps },
          };
        }
        
        // If we get here, browser failed with HTTP/2 error, continue to try next browser
        lastBrowserError = new Error(`Browser ${browserType} failed with HTTP/2 error`);
      } catch (error) {
        lastBrowserError = error instanceof Error ? error : new Error(String(error));
        
        // Only try next browser if this was an HTTP/2 related error
        const isHttp2Error = lastBrowserError.message.includes('HTTP2') || 
                            lastBrowserError.message.includes('ERR_HTTP2') ||
                            lastBrowserError.message.includes('Protocol error');
        
        if (!isHttp2Error || browserType === browsersToTry[browsersToTry.length - 1]) {
          // Not an HTTP/2 error or we've tried all browsers, give up
          break;
        }
        
        // Try next browser
      }
    }

    // All browsers failed
    return {
      monitorId: monitor.id,
      status: "down",
      message: lastBrowserError ? `All browsers failed: ${lastBrowserError.message}` : "Unknown error",
      checkedAt: new Date().toISOString(),
      meta: { journeySteps },
    };
  },
};

const runStep = async (page: Page, step: SyntheticStep, baseUrl?: string) => {
  switch (step.action) {
    case "goto":
      if (!step.url && !baseUrl) throw new Error("goto requires url or baseUrl");
      
      const url = step.url ?? baseUrl!;
      const timeout = step.timeout ?? 15000;
      
      // Retry logic for HTTP/2 protocol errors and other network issues
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await page.goto(url, { 
            timeout,
            waitUntil: 'domcontentloaded', // More tolerant than 'load'
          });
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Check if this is a retryable error
          const isRetryableError = lastError.message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
                                   lastError.message.includes('ERR_NETWORK_CHANGED') ||
                                   lastError.message.includes('ERR_INTERNET_DISCONNECTED') ||
                                   lastError.message.includes('ERR_CONNECTION_REFUSED') ||
                                   lastError.message.includes('ERR_SSL_PROTOCOL_ERROR') ||
                                   lastError.message.includes('ERR_HTTP2_PING_FAILED') ||
                                   lastError.message.includes('ERR_HTTP2_SERVER_REFUSED_STREAM') ||
                                   lastError.message.includes('ERR_HTTP2_STREAM_ERROR') ||
                                   lastError.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                                   lastError.message.includes('net::ERR_HTTP2_PROTOCOL_ERROR') ||
                                   lastError.message.includes('Protocol error') ||
                                   lastError.message.includes('HTTP/2');
          
          if (!isRetryableError || attempt === maxRetries) {
            throw lastError;
          }
          
          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await page.waitForTimeout(waitTime);
        }
      }
      
      throw lastError;
    case "click":
      if (!step.selector) throw new Error("click requires selector");
      await page.click(step.selector, { timeout: step.timeout ?? 15000 });
      return;
    case "fill":
      if (!step.selector) throw new Error("fill requires selector");
      await page.fill(step.selector, step.value ?? "", { timeout: step.timeout ?? 15000 });
      return;
    case "expect":
      if (step.text) {
        await page.waitForTimeout(50);
        await page.waitForSelector(`text=${step.text}`, { timeout: step.timeout ?? 15000 });
      } else if (step.selector) {
        if (step.property && step.value !== undefined) {
          // Wait for element to be present first
          await page.waitForSelector(step.selector, { timeout: step.timeout ?? 15000 });
          
          // Then check the property value
          const element = await page.$(step.selector);
          if (!element) {
            throw new Error(`Element ${step.selector} not found`);
          }
          
          const actualValue = await element.evaluate((el, prop) => {
            return (el as any)[prop];
          }, step.property);
          
          if (actualValue !== step.value) {
            throw new Error(`Expected ${step.property} "${step.value}" but got "${actualValue}"`);
          }
        } else {
          // Just wait for element presence
          await page.waitForSelector(step.selector, { timeout: step.timeout ?? 15000 });
        }
      } else {
        throw new Error("expect requires text or selector");
      }
      return;
    case "wait":
      await page.waitForTimeout(step.timeout ?? 1000);
      return;
    default:
      throw new Error(`Unknown action ${step.action}`);
  }
};
