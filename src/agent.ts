// ApmEvent contains all important information that the API needs to represent an event.
export class ApmEvent {
}

// ApmAgent is reponsible for communicating with the APM API.
export class ApmAgent {
  ServerUrl: string;
  ServiceName: string;

  constructor(ServerUrl: string, ServiceName: string) {
    this.ServerUrl = ServerUrl;
    this.ServiceName = ServiceName;
  }

  /** init opens the (persistent) HTTP connection to the APM Server. */
  init() {
  }

  sendError(error: Error): void {
    // TODO: actually handle the error and send it to the API.
    console.warn("sendError is not yet implemented with", error);
  }

  sendEvent(event: ApmEvent): void {
    // TODO: actually handle the event and send it to the API.
    console.warn("sendEvent is not yet implemented with", event);
  }
}

export function registerAgent(): ApmAgent {
  const apm = new ApmAgent(
    Deno.env.get("ELASTIC_APM_SERVER_URL") ?? "http://localhost:8200",
    Deno.env.get("ELASTIC_APM_SERVICE_NAME") ?? "",
  );

  // TODO: enable this to actually "capture" errors.

  return apm;
}
