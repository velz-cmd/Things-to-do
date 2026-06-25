type GatewayMiddlewareFn = (
  req: {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  },
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (chunk?: string) => void;
    json?: (data: unknown) => void;
    status?: (code: number) => unknown;
  },
  next: () => void
) => void | Promise<void>;

/** Run Express-style x402 Gateway middleware inside a Next.js App Router handler. */
export async function runGatewayMiddleware(
  middleware: GatewayMiddlewareFn,
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const url = new URL(request.url);
  const headerMap: Record<string, string | string[] | undefined> = {};
  request.headers.forEach((value, key) => {
    headerMap[key.toLowerCase()] = value;
  });

  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers: headerMap,
  };

  return new Promise<Response>((resolve, reject) => {
    let statusCode = 200;
    const responseHeaders = new Headers();
    let body = "";

    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(code: number) {
        statusCode = code;
      },
      setHeader(name: string, value: string) {
        responseHeaders.set(name, value);
      },
      end(chunk?: string) {
        body = chunk ?? "";
        resolve(
          new Response(body, {
            status: statusCode,
            headers: responseHeaders,
          })
        );
      },
      json(data: unknown) {
        body = JSON.stringify(data);
        responseHeaders.set("Content-Type", "application/json");
        resolve(
          new Response(body, {
            status: statusCode,
            headers: responseHeaders,
          })
        );
      },
      status(code: number) {
        statusCode = code;
        return res;
      },
    };

    const next = () => {
      handler().then(resolve).catch(reject);
    };

    Promise.resolve(middleware(req, res, next)).catch(reject);
  });
}
