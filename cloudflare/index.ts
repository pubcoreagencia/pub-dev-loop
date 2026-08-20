import { Container } from "@cloudflare/containers";

export interface Env {
  PDL_CONTAINER: DurableObjectNamespace<PDLContainer>;
}

export class PDLContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = "10m";
  enableInternet = true;

  override onStart() {
    console.log("PDL container started");
  }

  override onStop() {
    console.log("PDL container stopped");
  }

  override onError(error: unknown) {
    console.error("PDL container error", error);
  }

  override onStartError(error: unknown) {
    console.error("PDL container start error", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const container = env.PDL_CONTAINER.getByName("pdl-production");

    if (url.pathname === "/cloudflare/health") {
      return Response.json({ status: "ok", service: "pub-dev-loop", runtime: "cloudflare-container" });
    }

    return container.fetch(request);
  },
} satisfies ExportedHandler<Env>;
