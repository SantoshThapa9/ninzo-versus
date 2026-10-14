import type { CapacitorConfig } from "@capacitor/cli";

const developmentServerUrl = process.env.CAPACITOR_SERVER_URL;
const productionServerUrl = process.env.CAPACITOR_PRODUCTION_URL;
if (developmentServerUrl && productionServerUrl) {
  throw new Error(
    "Set only one of CAPACITOR_SERVER_URL or CAPACITOR_PRODUCTION_URL.",
  );
}

const serverUrl = productionServerUrl ?? developmentServerUrl;
const parsedServerUrl = serverUrl ? new URL(serverUrl) : undefined;

if (
  parsedServerUrl &&
  (!["http:", "https:"].includes(parsedServerUrl.protocol) ||
    parsedServerUrl.username ||
    parsedServerUrl.password)
) {
  throw new Error(
      "The Capacitor server URL must be an HTTP(S) URL without embedded credentials.",
  );
}

if (productionServerUrl && parsedServerUrl?.protocol !== "https:") {
  throw new Error("CAPACITOR_PRODUCTION_URL must use HTTPS.");
}

const config: CapacitorConfig = {
  appId: "com.ninzoversus.app",
  appName: "Ninzo Versus",
  webDir: "android-shell",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: parsedServerUrl?.protocol === "http:",
        },
      }
    : {}),
};

export default config;
