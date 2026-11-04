# lpthub-cli

Command-line client for the [LPT Hub](https://lyphucthien.vercel.app) public API. Zero dependencies, Node 18 or newer.

```sh
npx lpthub-cli games
npx lpthub-cli games --status on --query minecraft --json
npx lpthub-cli key-info
```

Install globally with `npm install -g lpthub-cli`, then run `lpthub --help`.

Keys are only issued in your own browser, so the CLI cannot fetch a key for you; `key-info` prints the steps and the key page link.

Exit codes: `0` success, `1` request or API error, `2` invalid usage. API errors are printed with their `error` message and `hint`.

API reference: https://lyphucthien.vercel.app/docs and https://lyphucthien.vercel.app/openapi.json
