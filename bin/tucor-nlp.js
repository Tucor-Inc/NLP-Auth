#!/usr/bin/env node
import inquirer from "inquirer";
import { TucorClient } from "../src/tucorClient.js";

const RPC_URL = process.env.TUCOR_RPC_URL || "https://tucor.irrigation.online/rpc";

function stateToOnline(state) {
  return Number(state) !== 0; // your rule
}

function stateIcon(state) {
  switch (Number(state)) {
    case 0: return "⚫"; // offline
    case 1: return "🟢"; // online
    case 2: return "🟡"; // online with warning
    case 3: return "🔴"; // online with error
    default: return "❓";
  }
}


function toRow(item) {
  return {
    id: item.id,
    hostname: item?.data?.hostname ?? "",
    state: item.state,
    online: stateToOnline(item.state),
    org: item.organization_id,
    ip: item?.data?.ipAddress ?? item?.data?.ethIp ?? "",
    sw: item?.data?.swVersion ?? "",
    hw: item?.data?.hwVersion ?? ""
  };
}

(async () => {
  const client = new TucorClient({ rpcUrl: RPC_URL });

  const { email, password } = await inquirer.prompt([
    { type: "input", name: "email", message: "Email:" },
    { type: "password", name: "password", message: "Password:", mask: "*" }
  ]);

  console.log("\nLogging in...");
  const session_token = await client.login(email, password);

  console.log("Getting admin token...");
  const admin_token = await client.admin(session_token);

  console.log("Fetching interfaces...");
  const interfaces = await client.listInterfaces(admin_token);
  if (!interfaces.length) {
    console.log("No interfaces returned.");
    process.exit(1);
  }

  const rows = interfaces.map(toRow);

  // Online first, then hostname, then id
  rows.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const ha = (a.hostname || "").toLowerCase();
    const hb = (b.hostname || "").toLowerCase();
    if (ha < hb) return -1;
    if (ha > hb) return 1;
    return a.id - b.id;
  });

  const { interface_id } = await inquirer.prompt([
    {
      type: "list",
      name: "interface_id",
      message: "Select a controller/interface:",
      pageSize: 20,
      choices: rows.map(r => ({
      name: `${stateIcon(r.state)} id=${r.id}  ${r.hostname}  state=${r.state}  ip=${r.ip}`,
      value: r.id
      }))

    }
  ]);

  const picked = rows.find(r => r.id === interface_id);
  console.log(`\nSelected: id=${interface_id} hostname=${picked?.hostname ?? ""} state=${picked?.state ?? ""}`);

  console.log("Authenticating interface (users.interface)...");
  const { interface_token, proxyUrl } = await client.interfaceAuth(session_token, interface_id);

  console.log(`proxyUrl: ${proxyUrl}`);

  console.log("\nGET /if ...");
  const ifResp = await client.proxyGetJson(proxyUrl, "/if", interface_token);
  console.log(JSON.stringify(ifResp, null, 2));

  console.log("\n--- Outputs ---");
  console.log(`interface_id: ${interface_id}`);
  console.log(`hostname: ${picked?.hostname ?? ""}`);
  console.log(`proxyUrl: ${proxyUrl}`);
  console.log(`interface_token: ${interface_token}`);
})().catch(err => {
  console.error("\nERROR:", err?.message ?? err);
  process.exit(1);
});
