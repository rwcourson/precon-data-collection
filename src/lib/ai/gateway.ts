import "server-only";
import { gateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

/**
 * Magnus AI — Claude Opus 5 + Zero Data Retention only.
 *
 * Opus 5 is the strongest ZDR-eligible Anthropic model on AI Gateway
 * (Fable/Mythos require 30-day retention and are blocked).
 * Every request forces `zeroDataRetention: true`.
 */

export const AI_MODEL_ID = "anthropic/claude-opus-5" as const;
export const AI_MODEL_LABEL = "Claude Opus 5 · ZDR";

export type GatewayZdrOptions = {
  providerOptions: {
    gateway: {
      zeroDataRetention: true;
      disallowPromptTraining: true;
    };
  };
};

/** Force ZDR + no training on every gateway call. Do not pin `only`. */
export function gatewayZdrOptions(): GatewayZdrOptions {
  return {
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
        disallowPromptTraining: true,
      },
    },
  };
}

export function getZdrModel(): LanguageModel {
  const requested = process.env.AI_MODEL?.trim();
  if (requested && requested !== AI_MODEL_ID) {
    throw new Error(
      `AI model must be ${AI_MODEL_ID} (ZDR). Refusing "${requested}".`,
    );
  }
  return gateway(AI_MODEL_ID);
}

/** @deprecated use getZdrModel */
export const getOpus5Model = getZdrModel;

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}
