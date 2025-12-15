import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

const recorderPlugin = async (fastify: FastifyInstance) => {
  // Get codegen command for manual recording
  fastify.post("/recorder/codegen", async (request, reply) => {
    await request.jwtVerify();

    const Body = z.object({
      url: z.string().url(),
      browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
    });

    const body = Body.parse(request.body);

    return {
      command: `npx playwright codegen --browser=${body.browser} ${body.url}`,
      instructions: [
        "1. Copy the command above",
        "2. Run it in your terminal",
        "3. A browser window will open with Playwright Inspector",
        "4. Interact with the website - Playwright records your actions",
        "5. Copy the generated code from the Inspector",
        "6. Use the 'Parse Playwright Code' button to convert it to steps",
      ],
      note: "The browser will open on your local machine, not in Docker",
    };
  });

  // Parse Playwright-generated code into steps
  fastify.post("/recorder/parse", async (request, reply) => {
    await request.jwtVerify();

    const Body = z.object({
      code: z.string(),
    });

    const body = Body.parse(request.body);

    try {
      // Parse Playwright code to extract steps
      const steps: any[] = [];
      const lines = body.code.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();

        // goto
        if (trimmed.includes("page.goto(")) {
          const match = trimmed.match(/goto\(['"](.+?)['"]\)/);
          if (match) {
            steps.push({ action: "goto", url: match[1] });
          }
        }

        // click (supports page.click, page.locator().click, page.getByRole().click)
        else if (trimmed.includes(".click(")) {
          // Handle page.click('selector')
          let match = trimmed.match(/page\.click\(['"](.+?)['"]\)/);
          if (match) {
            steps.push({ action: "click", selector: match[1] });
          } else {
            // Handle page.locator('selector').click()
            match = trimmed.match(/page\.locator\(['"](.+?)['"]\)/);
            if (match) {
              steps.push({ action: "click", selector: match[1] });
            } else {
              // Handle page.getByRole('role', { name: 'Name' }).click()
              match = trimmed.match(/page\.getByRole\(['"](.+?)['"](?:,\s*\{\s*name:\s*['"](.+?)['"]\s*\})?\)/);
              if (match) {
                const selector = match[2] ? `role=${match[1]}[name="${match[2]}"]` : `role=${match[1]}`;
                steps.push({ action: "click", selector });
              }
            }
          }
        }

        // fill (supports page.fill, page.locator().fill)
        else if (trimmed.includes(".fill(")) {
          // Handle page.fill('selector', 'value')
          let match = trimmed.match(/page\.fill\(['"](.+?)['"],[\s]*['"](.+?)['"]\)/);
          if (match) {
            steps.push({ action: "fill", selector: match[1], value: match[2] });
          } else {
            // Handle page.locator('selector').fill('value')
            const locatorMatch = trimmed.match(/page\.locator\(['"](.+?)['"]\)\.fill\(['"](.+?)['"]\)/);
            if (locatorMatch) {
              steps.push({ action: "fill", selector: locatorMatch[1], value: locatorMatch[2] });
            }
          }
        }

        // waitForSelector (also handle as "expect" action for compatibility)
        else if (trimmed.includes("page.waitForSelector(")) {
          const match = trimmed.match(/waitForSelector\(['"](.+?)['"]\)/);
          if (match) {
            steps.push({ action: "expect", selector: match[1] });
          }
        }

        // screenshot
        else if (trimmed.includes("page.screenshot(")) {
          steps.push({ action: "screenshot" });
        }
      }

      if (steps.length === 0) {
        return reply.status(400).send({
          error: "No steps found",
          message: "Could not parse any Playwright actions from the provided code. Make sure you copied code that includes actions like page.goto(), page.click(), etc.",
        });
      }

      return { steps, count: steps.length };
    } catch (error: any) {
      return reply.status(400).send({
        error: "Failed to parse Playwright code",
        message: error.message,
      });
    }
  });
};

export default fp(recorderPlugin, { name: "recorder" });
