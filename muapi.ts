// 浮生矩陣 — MuAPI 媒體生成模組（Open Generative AI 整合）
//
// 透過 MuAPI（https://muapi.ai，200+ 圖像／影片模型：Flux、Nano Banana、
// Kling、Seedance、Veo…）生成媒體，回傳託管輸出 URL，可用於報告配圖、
// 社群圖卡等。供 Supabase Edge Function（Deno）匯入使用。
//
// ⚠️ 金鑰走 Secret：Deno.env.get("MUAPI_KEY")，不寫死在程式裡。
// 可選：MUAPI_BASE_URL 覆寫端點。
//
// 協定（對齊 Open-Generative-AI 的 studio client）：
//   送出  POST {base}/api/v1/{model-endpoint}          -> { request_id }
//   輪詢  GET  {base}/api/v1/predictions/{id}/result    -> { status, outputs[] }
//   餘額  GET  {base}/api/v1/account/balance            -> { balance }

const DEFAULT_BASE_URL = "https://api.muapi.ai";

/** 預設模型端點（可傳入任一 MuAPI 端點 id 覆寫）。 */
export const MUAPI_DEFAULT_MODELS = {
  textToImage: "flux-dev",
  imageToImage: "nano-banana",
  textToVideo: "seedance-lite-t2v",
  imageToVideo: "wan2.1-image-to-video",
} as const;

export interface MuapiClientOptions {
  apiKey?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface MuapiGenerateResult {
  requestId: string | null;
  status: string;
  url: string | null;
  outputs: string[];
  raw: Record<string, unknown>;
}

export interface ImageGenerateParams {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  imageUrl?: string;
  imagesList?: string[];
  seed?: number;
}

export interface VideoGenerateParams {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  duration?: number;
  mode?: string;
  imageUrl?: string;
  imagesList?: string[];
}

export class MuapiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "MuapiError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MuapiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(options: MuapiClientOptions = {}) {
    // 金鑰延後到請求時才驗（見 headers）：Edge Function 可能在載入時就
    // 建立 client，缺金鑰不該讓整個函式掛掉，只在真正發請求時才報錯。
    this.apiKey = options.apiKey ?? Deno.env.get("MUAPI_KEY") ?? "";
    this.baseUrl = (options.baseUrl ?? Deno.env.get("MUAPI_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.maxPollAttempts = options.maxPollAttempts ?? 900;
  }

  private get headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new MuapiError("MUAPI_KEY 環境變數（或 apiKey 選項）為必填");
    }
    return { "Content-Type": "application/json", "x-api-key": this.apiKey };
  }

  /** 查詢 MuAPI 帳戶餘額。 */
  async getBalance(): Promise<{ balance: number } & Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/api/v1/account/balance`, { headers: this.headers });
    if (!res.ok) {
      throw new MuapiError(`查詢餘額失敗：${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
    }
    return res.json();
  }

  /** 送出生成請求並輪詢至完成。payload 原樣傳給 MuAPI（prompt、aspect_ratio…）。 */
  async generate(
    modelEndpoint: string,
    payload: Record<string, unknown>,
    opts: { maxPollAttempts?: number } = {},
  ): Promise<MuapiGenerateResult> {
    const submitRes = await fetch(`${this.baseUrl}/api/v1/${modelEndpoint}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    if (!submitRes.ok) {
      throw new MuapiError(
        `MuAPI 請求失敗：${submitRes.status} ${(await submitRes.text()).slice(0, 200)}`,
        submitRes.status,
      );
    }
    const submit = (await submitRes.json()) as Record<string, unknown>;
    const requestId = (submit.request_id ?? submit.id) as string | undefined;
    if (!requestId) return this.normalize(null, submit);
    const result = await this.pollForResult(requestId, opts.maxPollAttempts ?? this.maxPollAttempts);
    return this.normalize(requestId, result);
  }

  /** 文字生圖；提供 imageUrl / imagesList 時走圖生圖。 */
  async generateImage(params: ImageGenerateParams): Promise<MuapiGenerateResult> {
    const model =
      params.model ?? (params.imageUrl || params.imagesList?.length ? MUAPI_DEFAULT_MODELS.imageToImage : MUAPI_DEFAULT_MODELS.textToImage);
    const payload: Record<string, unknown> = { prompt: params.prompt };
    if (params.aspectRatio) payload.aspect_ratio = params.aspectRatio;
    if (params.resolution) payload.resolution = params.resolution;
    if (params.quality) payload.quality = params.quality;
    if (params.imagesList?.length) payload.images_list = params.imagesList;
    else if (params.imageUrl) payload.image_url = params.imageUrl;
    if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;
    return this.generate(model, payload, { maxPollAttempts: 120 });
  }

  /** 文字生影片；提供 imageUrl 時走圖生影片。 */
  async generateVideo(params: VideoGenerateParams): Promise<MuapiGenerateResult> {
    const model = params.model ?? (params.imageUrl ? MUAPI_DEFAULT_MODELS.imageToVideo : MUAPI_DEFAULT_MODELS.textToVideo);
    const payload: Record<string, unknown> = {};
    if (params.prompt) payload.prompt = params.prompt;
    if (params.aspectRatio) payload.aspect_ratio = params.aspectRatio;
    if (params.resolution) payload.resolution = params.resolution;
    if (params.quality) payload.quality = params.quality;
    if (params.duration) payload.duration = params.duration;
    if (params.mode) payload.mode = params.mode;
    if (params.imageUrl) payload.image_url = params.imageUrl;
    if (params.imagesList?.length) payload.images_list = params.imagesList;
    return this.generate(model, payload);
  }

  private async pollForResult(requestId: string, maxAttempts: number): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/api/v1/predictions/${requestId}/result`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await sleep(this.pollIntervalMs);
      try {
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) {
          if (res.status >= 500) continue; // 上游暫時性錯誤，繼續輪詢
          throw new MuapiError(`輪詢失敗：${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
        }
        const data = (await res.json()) as Record<string, unknown>;
        const status = String(data.status ?? "").toLowerCase();
        if (status === "completed" || status === "succeeded" || status === "success") return data;
        if (status === "failed" || status === "error") {
          throw new MuapiError(`生成失敗：${(data.error as string) || "未知錯誤"}`);
        }
      } catch (err) {
        // 終端 MuapiError 直接拋出；輪詢期間的暫時性網路／JSON 錯誤容忍，
        // 避免短暫斷線讓長達 30 分鐘的影片工作中斷——直到用完次數。
        if (err instanceof MuapiError) throw err;
        if (attempt === maxAttempts) {
          throw new MuapiError(`輪詢失敗：${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    throw new MuapiError("生成逾時（輪詢結果超過上限）");
  }

  private normalize(requestId: string | null, raw: Record<string, unknown>): MuapiGenerateResult {
    // 不同模型輸出格式不一：outputs（陣列）、output（字串或陣列）、頂層 url，全部正規化。
    const outputsRaw = (raw.outputs as unknown) ?? (Array.isArray(raw.output) ? raw.output : []);
    const outputs = Array.isArray(outputsRaw) ? outputsRaw.filter((o): o is string => typeof o === "string") : [];
    const single =
      outputs[0] ??
      (raw.url as string | undefined) ??
      (typeof raw.output === "string" ? raw.output : (raw.output as { url?: string } | undefined)?.url) ??
      null;
    return {
      requestId,
      status: String(raw.status ?? (single ? "completed" : "unknown")),
      url: single,
      outputs: single && !outputs.length ? [single] : outputs,
      raw,
    };
  }
}

/** 便利工廠：從 Secret（MUAPI_KEY）建立 client。 */
export function createMuapiClient(options: MuapiClientOptions = {}): MuapiClient {
  return new MuapiClient(options);
}
