import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "REVISION_CONFLICT"
  | "IN_USE"
  | "STOCK_INSUFFICIENT"
  | "UPLOAD_REJECTED"
  | "WRITE_NOT_VERIFIED"
  | "RATE_LIMITED"
  | "ORDER_IN_PROGRESS"
  | "COUPON_USAGE_LIMIT_REACHED"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

export interface ApiSuccessPayload<T> {
  ok: true;
  data: T;
  revision?: number;
  published?: {
    topic: string;
    topicRevision: number;
    liveClients?: number;
  };
}

export interface ApiErrorPayload {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    field?: string | null;
  };
}

export type ApiResponse<T> = ApiSuccessPayload<T> | ApiErrorPayload;

export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    revision?: number;
    topic?: string;
    topicRevision?: number;
    liveClients?: number;
    headers?: Record<string, string>;
  }
) {
  const body: ApiSuccessPayload<T> = {
    ok: true,
    data,
    ...(typeof options?.revision === "number" ? { revision: options.revision } : {}),
    ...(options?.topic && typeof options.topicRevision === "number"
      ? {
          published: {
            topic: options.topic,
            topicRevision: options.topicRevision,
            liveClients: options.liveClients ?? 1,
          },
        }
      : {}),
  };

  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: options?.headers,
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number = 400,
  field: string | null = null,
  headers?: Record<string, string>
) {
  const body: ApiErrorPayload = {
    ok: false,
    error: {
      code,
      message,
      field,
    },
  };

  return NextResponse.json(body, {
    status,
    headers,
  });
}
