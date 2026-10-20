import { defineWranglerConfig } from "wrangler/experimental-config";

// Static files only; produced by web-app/scripts/build-site.mjs.
export default defineWranglerConfig({
  assetsDirectory: "../web-app/dist",
});
