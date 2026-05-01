import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "payload",
      "*.payload",
      "metadata.phi",
      "*.metadata.phi",
      "encryptedAccessToken",
      "encryptedRefreshToken",
      "accessToken",
      "refreshToken"
    ],
    censor: "[redacted]"
  }
});
