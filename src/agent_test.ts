import { captureTransaction, close, flush, registerAgent } from "./agent.ts";

class myClass {
  constructor() {
  }

  crash() {
    throw new Error("oh noes!");
  }
}

Deno.test("send errors that heppen during transactions", async () => {
  registerAgent();
  await captureTransaction("test", async (tx) => {
    tx.context = { user: { username: "test-user-1" } };
    await new Promise(() => {
      const c = new myClass();
      c.crash();
    });
  });
  await close();
});

Deno.test("flushing is always OK", async () => {
  await flush();
  await flush();
  registerAgent();
  await flush();
  await flush();
  await close();
  await flush();
  await flush();
});
