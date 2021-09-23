# Elastic APM Agent for Deno

This repository contains an [APM Agent](https://www.elastic.co/guide/en/apm/agent/index.html) for [Deno](https://deno.land/). 

## Stability

This is currently considered **unstable** and may change. However, it is used in production environments and will get updates.

## Permissions

- Use the permission flag `--allow-hrtime` to get precise values for transaction durations.
- Use the permission flag `--allow-env=ELASTIC_APM_*` to allow reading server configuration
- Use the permission flag `--allow-net=localhost:8200` to allow network access to the Elastic APM server

## Usage

```ts
import { registerAgent, captureTransaction, ApmTransaction, flush, close } from 'https://deno.land/x/elastic_apm_agent_unofficial/src/agent.ts';

function someFunction() {}
    // This initializes the APM agent using the environment variables. Alternatively, you can provide the URL and service name
    // as parameters into this function, and you will not need to --allow-env.
    // You only need to do this once per running process.
    registerAgent();
    
    // So you can use:
    // registerAgent("http://localhost:8200", "my-special-service-1");

    // Then you will want to do something. It is automatically benchmarked and afterwards sent to Elastic APM.
    // You can call your transaction something, like "request" or "my-super-duper-task".
    captureTransaction("request", async (tx: ApmTransaction) {
        // Here is your application code.

        // You have access to the APM transaction, meaning you can optionally add context:
        tx.context.user = { id: 5, username: "admin" };
        tx.context.request = { 
            method: "POST",
            cookies: { "c1": "v1", "c2": "v2" },
        };

        // Any errors you cause, will automatically get sent to Elastic APM
        throw new Error("I do not like you")
    });

    // There is no need to manually flush, as this is done in the background every two seconds:
    // flush();

    // If something happened in your application, but you want to continue, you can add the error yourself:
    captureTransaction("request", async (tx: ApmTransaction) {
        // If you catch your errors, we will not know about them.
        try {
            throw new Error("I do not like you");
        } catch (err) {
            // You can manually add them to the transaction, and they will be sent to Elastic APM as well.
            const apmErr = tx.addError(err);
            
            // Optionally, you can provide more context on the error:
            apmErr.context.user = { id: 6 };
        }

        // Continue doing stuff
    });

    // When you are done, simply close it:
    close();
}
```

## Limitations

- There is no support yet for `span`
- There is no support yet for `metrics`
- Tests are done only manually (seeing if they actually appear in the Elastic APM server)

PRs are very welcome.
