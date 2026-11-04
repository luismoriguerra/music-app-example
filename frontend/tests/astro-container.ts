import { experimental_AstroContainer as AstroContainer } from "astro/container";
import reactRenderer from "@astrojs/react/server.js";

/** Render an .astro component to an HTML string for assertions. */
export async function renderAstro(
  component: Parameters<AstroContainer["renderToString"]>[0],
  options?: Parameters<AstroContainer["renderToString"]>[1],
): Promise<string> {
  const container = await AstroContainer.create();
  container.addServerRenderer({ renderer: reactRenderer });
  return container.renderToString(component, options);
}
