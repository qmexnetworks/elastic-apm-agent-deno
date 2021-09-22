import { randomHex } from "./util.ts";

export const APM_AGENT_VERSION = "0.0.2"; // TODO: automatically update with git tag/release

function throwException(message: string): never {
  throw new Error(message);
}

/**
 * @link https://github.com/elastic/apm-server/blob/v7.14.1/docs/spec/v2/metadata.json
 */
export class ApmMetadata {
  service: {
    agent: {
      name: string;
      version: string;
    };
    environment?: string;
    language?: {
      name: string;
      version?: string;
    };
    runtime?: {
      name: string;
      version: string;
    };
    system?: {
      detected_hostname?: string;
    };
    name: string;
  };

  constructor(serviceName: string) {
    this.service = {
      agent: {
        name: "deno-unofficial",
        version: APM_AGENT_VERSION,
      },
      language: {
        name: "deno",
        version: Deno.version.deno,
      },
      runtime: {
        name: "V8",
        version: Deno.version.v8,
      },
      system: {
        detected_hostname: Deno.env.get("HOSTNAME"),
      },
      name: serviceName,
    };
  }
}

/**
 * @link https://github.com/elastic/apm-server/blob/v7.14.1/docs/spec/v2/transaction.json
 */
export class ApmTransaction {
  id: string;
  trace_id: string;

  duration: number; // in milliseconds with 3 decimal points
  span_count: {
    dropped?: number;
    started: number;
  };
  type: string;
  context: ApmContext = {};

  constructor(duration: number, txType: string, spanCount = 1) {
    this.id = randomHex(8);
    this.trace_id = randomHex(16);

    // TODO: remove these lines
    lastTx = this.id;
    lastTrace = this.trace_id;

    this.duration = duration;
    this.type = txType;
    this.span_count = {
      started: spanCount,
    };
  }
}

/**
 * @link https://github.com/elastic/apm-server/blob/v7.14.1/docs/spec/v2/error.json
 */
export class ApmError {
  id: string;
  trace_id?: string;
  transaction_id?: string;
  parent_id?: string;
  timestamp: number;

  // culprit?: string;
  log?: {
    message: string;
    //     param_message: string;
    //     level: string;
  };
  culprit?: string;
  exception?: {
    message: string;
    stacktrace: Array<{
      abs_path?: string;
      filename?: string;
      classname?: string;
      function?: string;
      colno?: number;
      lineno?: number;
      vars?: Record<string, string>;
    }>;
  };
  context?: ApmContext;

  constructor(err: Error) {
    this.id = randomHex(8);
    // this.trace_id = randomHex(16); // TODO: use "current" trace?
    // TODO: current transaction id?

    if (lastTx && lastTrace) {
      // this.transaction_id = lastTx
      // this.trace_id = lastTrace
    }
    this.timestamp = Date.now() * 1000; // UTC based and formatted as microseconds since Unix epoch

    const trace = err.stack?.split("\n") ?? [];
    trace.splice(0, 1); // Remove the first line

    const fullStacktrace = [
      ...trace.map((line) => {
        // "line" equals for example: "    at ApmAgent.init (file:///home/etiennebruines/workspaces/deno/elastic-apm-agent-deno/src/agent.ts:156:34)"
        line = line.substr(7); // Remove the 4 spaces and "at "
        if (line.startsWith("async")) {
          line = line.substr(6);
        }

        // const firstSpace = line.indexOf(" ")
        // let functionName = line.startsWith("file://") ? undefined : line.substr(0, firstSpace)
        let fileNameResults = line.match(
          /(.+)\ \((file:\/\/)?(.+):(\d+):(\d+)\)/,
        );
        if (fileNameResults === null) {
          fileNameResults = line.match(/()(file:\/\/)?(.+):(\d+):(\d+)/);
          if (fileNameResults === null) {
            return { filename: line }; // No idea what the format is, so let's send at least something
          }
        }

        let functionName = fileNameResults[1];

        let className = undefined;
        const functionNameDot = functionName?.indexOf(".");
        if (functionName && functionNameDot) {
          className = functionName.substr(0, functionNameDot);
          functionName = functionName.substr(functionNameDot + 1);
        }

        return {
          classname: className,
          function: functionName,
          filename: fileNameResults ? fileNameResults[3] : undefined,
          lineno: fileNameResults ? Number(fileNameResults[4]) : undefined,
          colno: fileNameResults ? Number(fileNameResults[5]) : undefined,
        };
      }),
    ];

    this.exception = {
      message: err.message,
      stacktrace: fullStacktrace,
    };
    this.culprit = fullStacktrace[0]?.classname
      ? `${fullStacktrace[0].classname}.${fullStacktrace[0].function}()`
      : undefined;
  }
}

export class ApmContext {
  // deno-lint-ignore no-explicit-any
  request?: any; // TODO: describe

  // deno-lint-ignore no-explicit-any
  response?: any; // TODO: describe

  user?: ApmUser;

  // deno-lint-ignore no-explicit-any
  custom?: Record<string, any>;
}

export class ApmUser {
  domain?: string;
  email?: string;
  id?: number | string;
  username?: string;
}

let lastTx: string;
let lastTrace: string;

// ApmAgent is reponsible for communicating with the APM API.
export class ApmAgent {
  serverUrl: string;
  serviceName: string;

  // deno-lint-ignore no-explicit-any
  _queue: Array<{ [msgType: string]: any }> = [];

  constructor(serverUrl: string, serviceName: string) {
    this.serverUrl = serverUrl;
    this.serviceName = serviceName;
  }

  /** Sends all messages that are in the queue to the Elastic APM server. */
  flush(): Promise<void> {
    if (this._queue.length === 0) {
      return Promise.resolve(); // Nothing to flush
    }

    const messages = [
      { "metadata": new ApmMetadata(this.serviceName) },
      ...this._queue,
    ];
    this._queue = [];

    return fetch(`${this.serverUrl}/intake/v2/events`, {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      // deno-lint-ignore no-explicit-any
      body: messages.map((msg: any) => JSON.stringify(msg)).join("\n") + "\n",
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await res.body?.cancel();
      return;
    }).catch((err) => {
      console.error("[APM]", err);
      throw err; // TODO: allow disabling this
    });
  }

  sendError(error: ApmError): void {
    this._queue.push({ "error": error });
  }

  sendTransaction(tx: ApmTransaction): void {
    this._queue.push({ "transaction": tx });
  }
}

let currentAgent: ApmAgent | undefined;

export function registerAgent(
  url = "http://localhost:8200",
  serviceName?: string,
): ApmAgent {
  if (currentAgent) {
    return currentAgent;
  }

  currentAgent = new ApmAgent(
    Deno.env.get("ELASTIC_APM_SERVER_URL") ?? url,
    Deno.env.get("ELASTIC_APM_SERVICE_NAME") ?? serviceName ??
      throwException(
        "ELASTIC_APM_SERVICE_NAME environment variable is required but was empty",
      ),
  );

  return currentAgent;
}

/**
 * captureTransaction will execute the given function and send benchmark results to Elastic APM. If any error occurs, then this is also
 * sent to the Elastic APM server.
 *
 * @param type Type expresses the transaction's type as keyword that has specific relevance within the service's domain, eg: 'request', 'backgroundjob'.
 * @param fn The function to execute and benchmark.
 * @param throwAgain If set to true, any (uncaught) exceptions thrown while executing, will be re-thrown for additional handling.
 */
export async function captureTransaction(
  type: string,
  // deno-lint-ignore no-explicit-any
  fn: (tx: ApmTransaction) => any,
  ctx?: ApmContext,
  throwAgain = false,
): Promise<void> {
  let error: Error | undefined;
  try {
    if (!currentAgent) {
      console.warn(
        "[APM]",
        "Unable to capture transaction: APM agent not registered. Running anyways.",
      );
    }

    const begin = globalThis.performance.now();
    const tx = new ApmTransaction(0, type, 1);
    if (ctx) {
      tx.context = ctx;
    }

    try {
      await fn(tx);
    } catch (err) {
      error = err;
    }

    const duration = globalThis.performance.now() - begin;
    tx.duration = duration;

    if (currentAgent) {
      currentAgent.sendTransaction(tx);
      if (error) {
        const apmError = new ApmError(error);
        apmError.transaction_id = tx.id;
        apmError.trace_id = tx.trace_id;
        apmError.parent_id = tx.id;
        apmError.context = tx.context;
        currentAgent.sendError(apmError);
      }

      // In future versions, we may flush regularly in the background?
      await currentAgent.flush();
    }
  } catch (err) {
    console.warn("[APM] registered error in application:", err, err.stack);
  }

  if (throwAgain) {
    throw error;
  }
}