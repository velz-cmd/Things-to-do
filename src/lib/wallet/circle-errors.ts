/** Extract a human-readable message from Circle SDK / axios errors. */
export function circleErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== "Error") {
    return err.message;
  }
  if (!err || typeof err !== "object") return "Circle API request failed";

  const e = err as {
    message?: string;
    code?: number;
    response?: {
      data?: {
        message?: string;
        code?: number;
        errors?: Array<{ error?: string; message?: string; location?: string }>;
      };
    };
  };

  const data = e.response?.data;
  const detail = data?.errors?.map((x) => x.message ?? x.error).filter(Boolean).join("; ");
  return (
    detail ??
    data?.message ??
    e.message ??
    (e.code ? `Circle error ${e.code}` : "Circle API request failed")
  );
}
