import { chromium, firefox, webkit, type BrowserType, type Page } from "playwright-core";
import type {
  BaseMonitor,
  MonitorAdapter,
  MonitorResult,
  SyntheticConfig,
  SyntheticStep,
  MonitorResultMeta,
} from "../types.js";

const browsers: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

const toConfig = (config: Record<string, unknown>): SyntheticConfig => {
  const steps = Array.isArray(config.steps) ? (config.steps as SyntheticStep[]) : [];
  if (!steps.length) {
    throw new Error("Synthetic monitor requires steps");
  }
  return {
    steps,
    browser: (config.browser as SyntheticConfig["browser"]) ?? "chromium",
    baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : undefined,
  };
};

export const syntheticAdapter: MonitorAdapter = {
  kind: "synthetic",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const browserType = browsers[config.browser ?? "chromium"] ?? chromium;
    const launchTimeout = monitor.timeout ?? 30000;

  const journeySteps: NonNullable<MonitorResultMeta["journeySteps"]> = [];
    const start = Date.now();

    try {
      const browser = await browserType.launch({ headless: true, timeout: launchTimeout });
      const context = await browser.newContext();
      const page = await context.newPage();

      for (const step of config.steps) {
        const label = step.action.toUpperCase();
        try {
          await runStep(page, step, config.baseUrl);
          journeySteps.push({ label, status: "up" });
        } catch (error) {
          journeySteps.push({
            label,
            status: "down",
            detail: error instanceof Error ? error.message : String(error),
          });
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

      await browser.close();
      return {
        monitorId: monitor.id,
        status: "up",
        message: `Synthetic journey ok (${Date.now() - start}ms)` ,
        checkedAt: new Date().toISOString(),
        meta: { journeySteps },
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        meta: { journeySteps },
      };
    }
  },
};

const runStep = async (page: Page, step: SyntheticStep, baseUrl?: string) => {
  switch (step.action) {
    case "goto":
      if (!step.url && !baseUrl) throw new Error("goto requires url or baseUrl");
      await page.goto(step.url ?? baseUrl!, { timeout: step.timeout ?? 15000 });
      return;
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
        await page.waitForSelector(step.selector, { timeout: step.timeout ?? 15000 });
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
