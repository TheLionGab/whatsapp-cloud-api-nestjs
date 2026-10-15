import { Inject, Injectable } from "@nestjs/common";
import { MissingCredentialsError, ProviderError } from "../common/api-error.js";
import { APP_CONFIG } from "../config/config.constants.js";
import type { AppConfig } from "../config/config.schema.js";
import { FETCH, type FetchLike } from "./fetch.token.js";
import type { SendTextInput } from "./schemas.js";

export interface SendResult {
  providerId: string;
  provider: unknown;
}

function errorMessage(status: number, payload: unknown): string {
  if (payload !== null && typeof payload === "object" && "error" in payload) {
    const err = (payload as { error?: { message?: unknown } }).error;
    if (err !== null && typeof err === "object" && typeof err.message === "string") {
      return err.message;
    }
  }
  return `Graph API respondeu HTTP ${status}`;
}

/** Provider externo: fala com a Graph API da Meta. */
@Injectable()
export class WhatsappService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetchImpl: FetchLike,
  ) {}

  async sendText(input: SendTextInput): Promise<SendResult> {
    if (this.config.dryRun) {
      return {
        providerId: "dry-run-wamid.123",
        provider: { dryRun: true, to: input.to, body: input.body },
      };
    }
    if (this.config.whatsappToken === "" || this.config.phoneNumberId === "") {
      throw new MissingCredentialsError();
    }
    try {
      return await this.callGraphApi(input);
    } catch (err) {
      throw new ProviderError(err instanceof Error ? err.message : "falha no envio");
    }
  }

  private async callGraphApi(input: SendTextInput): Promise<SendResult> {
    const { graphVersion, phoneNumberId, whatsappToken } = this.config;
    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: { body: input.body, preview_url: input.previewUrl },
      }),
    });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(errorMessage(res.status, payload));
    }
    const id =
      payload !== null &&
      typeof payload === "object" &&
      "messages" in payload &&
      Array.isArray((payload as { messages: unknown }).messages) &&
      (payload as { messages: Array<{ id?: unknown }> }).messages[0]?.id;
    return { providerId: typeof id === "string" ? id : "", provider: payload };
  }
}
