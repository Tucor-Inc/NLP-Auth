import { CookieJar } from "tough-cookie";
import makeFetchCookie from "fetch-cookie";

/**
 * Tucor NLP JSON-RPC + proxy helper.
 * Handles cookie "st" (session_token) via a cookie jar, like Postman/browser.
 */
export class TucorClient {
  constructor({ rpcUrl }) {
    this.rpcUrl = rpcUrl;
    this.jar = new CookieJar();
    this.fetch = makeFetchCookie(globalThis.fetch, this.jar);
  }

  async rpc(method, params = {}, { bearer } = {}) {
    const body = {
      jsonrpc: "2.0",
      id: Math.floor(Date.now() / 1000),
      method,
      params
    };

    const headers = {
      "Content-Type": "application/json;charset=utf-8"
    };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const res = await this.fetch(this.rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`RPC ${method}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    if (!res.ok) {
      throw new Error(`RPC ${method}: HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (json?.error) {
      throw new Error(`RPC ${method}: code=${json.error.code} msg=${json.error.msg}`);
    }
    return json;
  }

  /** Reads the session_token from cookie "st" after users.login */
  async getSessionToken() {
    const cookies = await this.jar.getCookies(this.rpcUrl);
    const st = cookies.find(c => c.key === "st");
    if (!st?.value) throw new Error(`Cookie "st" not found; users.login may have failed or cookie not set.`);
    return st.value;
  }

  async login(email, password) {
    await this.rpc("users.login", { email, password });
    return this.getSessionToken();
  }

  async admin(session_token) {
    const resp = await this.rpc("users.admin", { session_token });
    const admin_token = resp?.result?.token;
    if (!admin_token) throw new Error("users.admin did not return result.token (admin_token).");
    return admin_token;
  }

  async listInterfaces(admin_token) {
    const resp = await this.rpc("interface.search", {}, { bearer: admin_token });
    const items = resp?.result?.items ?? [];
    return items;
  }

  async interfaceAuth(session_token, interface_id) {
    const resp = await this.rpc("users.interface", { session_token, interface_id });
    const interface_token = resp?.result?.token;
    const proxyUrl = resp?.result?.proxyUrl;
    if (!interface_token || !proxyUrl) {
      throw new Error("users.interface did not return result.token and result.proxyUrl.");
    }
    return { interface_token, proxyUrl };
  }

  async proxyGetJson(proxyUrl, path, interface_token) {
    const url = proxyUrl.replace(/\/$/, "") + path;
    const res = await this.fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${interface_token}` }
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Proxy GET ${path}: HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      // Some proxy endpoints might not be JSON; /if is JSON in your testing.
      return { raw: text };
    }
  }
}
