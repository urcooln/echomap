import { createHash, createHmac } from "node:crypto";
import type { S3CompatibleClient } from "./audio-object-store";

type S3HttpClientConfig = {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle: boolean;
};

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const timestamp = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

/**
 * Tiny SigV4 client intentionally limited to private Put/Get/Delete/Head
 * operations. It avoids coupling the API to a cloud-vendor SDK while staying
 * compatible with standard S3 endpoints.
 */
export class S3HttpClient implements S3CompatibleClient {
  constructor(private readonly config: S3HttpClientConfig) {}

  async putObject(input: { Bucket: string; Key: string; Body: Buffer; ContentType: string }) {
    await this.request(input.Bucket, input.Key, "PUT", input.Body, input.ContentType);
  }

  async getObject(input: { Bucket: string; Key: string }) {
    const response = await this.request(input.Bucket, input.Key, "GET");
    if (!response.body) return { Body: undefined };
    return { Body: this.stream(response.body) };
  }

  async deleteObject(input: { Bucket: string; Key: string }) {
    await this.request(input.Bucket, input.Key, "DELETE");
  }

  async headBucket(bucket: string) {
    await this.request(bucket, "", "HEAD");
  }

  private async *stream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async request(bucket: string, key: string, method: "PUT" | "GET" | "DELETE" | "HEAD", body?: Buffer, contentType?: string) {
    const now = new Date();
    const amzDate = timestamp(now);
    const dateStamp = amzDate.slice(0, 8);
    const endpoint = new URL(this.config.endpoint ?? `https://s3.${this.config.region}.amazonaws.com`);
    const usesPathStyle = this.config.forcePathStyle || Boolean(this.config.endpoint);
    const host = usesPathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
    const canonicalUri = usesPathStyle
      ? `/${encodeURIComponent(bucket)}${key ? `/${encodeKey(key)}` : ""}`
      : `/${encodeKey(key)}`;
    const payloadHash = hash(body ?? "");
    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;
    if (this.config.sessionToken) headers["x-amz-security-token"] = this.config.sessionToken;
    const canonicalHeaders = Object.entries(headers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}:${value.trim()}\n`)
      .join("");
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hash(canonicalRequest)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, dateStamp), this.config.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const url = `${endpoint.protocol}//${host}${canonicalUri}`;
    const response = await fetch(url, {
      method,
      headers: { ...headers, authorization },
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`S3 ${method} request failed with HTTP ${response.status}.`);
    return response;
  }
}