# Tucor NLP Auth CLI & Client

A Node.js library and command-line tool for authenticating with **Tucor NLP controllers**
via the Tucor Cloud JSON-RPC API.

This project implements the full authentication flow required by the NLP platform:

1. `users.login` (email + password)
2. `users.admin` (exchange session token → admin token)
3. `interface.search` (list all controllers)
4. `users.interface` (authenticate to a specific controller)
5. Optional proxy calls (example: `GET /if`)

The CLI lets a user **log in, view all controllers, select one**, and immediately verify
connectivity to that controller.

---

## Why this exists

The Tucor NLP API uses a multi-step authentication flow involving:
- session cookies
- admin tokens
- interface-level tokens

This project wraps that complexity into:
- a reusable JavaScript client (`TucorClient`)
- a friendly interactive CLI

It is intended for:
- internal tools
- diagnostics
- integration projects (e.g. Losant, dashboards, automation scripts)

---

## Requirements

- Node.js **18.18+**
- Internet access to `https://tucor.irrigation.online`

---

## Install

Clone the repository and install dependencies:

```bash
npm install
```

---

## Run the CLI

```bash
npm start
```

You will be prompted for:
- Email
- Password (hidden)

Then you can:
- view all available controllers
- select one
- authenticate to it
- see a live `/if` response from the controller

---

## Example CLI Flow

```text
Email: user@example.com
Password: ********

Fetching interfaces...

🟢 id=79054  tucor-test-nlp   state=3  ip=192.0.1.44
⚫ id=12345  field-backup     state=0  ip=

Select a controller/interface:
> tucor-test-nlp

GET /if ...
{
  "hostname": "tucor-test-nlp",
  "ethIp": "192.0.1.44",
  ...
}
```

---

## Library Usage

You can also use this as a library in your own Node.js code.

```js
import { TucorClient } from "tucor-nlp-auth";

const client = new TucorClient({
  rpcUrl: "https://tucor.irrigation.online/rpc"
});

const sessionToken = await client.login(email, password);
const adminToken   = await client.admin(sessionToken);

const interfaces = await client.listInterfaces(adminToken);

const { interface_token, proxyUrl } =
  await client.interfaceAuth(sessionToken, interfaces[0].id);

const info = await client.proxyGetJson(proxyUrl, "/if", interface_token);
console.log(info);
```

---

## Security Notes

- Credentials are **never stored**.
- Passwords are read securely from the terminal.
- Session, admin, and interface tokens are held in memory only.

**Do not commit credentials or tokens to GitHub.**

---

## Project Structure

```text
bin/
  tucor-nlp.js        # CLI entrypoint
src/
  tucorClient.js      # Core RPC + auth logic
  index.js            # Library exports
```

---

## Roadmap

Planned improvements:
- CLI flags (`--list`, `--select <id>`, `--json`)
- Machine-readable output for automation
- Optional polling helpers for telemetry
- Integration examples (Losant, dashboards)

---

## License

MIT
