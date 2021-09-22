import { captureTransaction, registerAgent } from "./agent.ts";

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
});
