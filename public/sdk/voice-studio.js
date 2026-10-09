(function (root) {
  function VoiceStudio(opts) {
    this.baseUrl = String(opts.baseUrl || "").replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.agentId = opts.agentId;
  }

  VoiceStudio.prototype.connect = async function (opts) {
    opts = opts || {};
    const res = await fetch(this.baseUrl + "/api/v1/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agentId: this.agentId,
        channel: opts.channel || "web",
        display: opts.display,
        metadata: opts.metadata,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to open session");
    return new VoiceSession(this, data);
  };

  function VoiceSession(client, data) {
    this.client = client;
    this.id = data.id;
    this.token = data.token;
    this.agent = data.agent;
    this.eventsUrl = data.eventsUrl;
    this.completeUrl = data.completeUrl;
    this.hangupUrl = data.hangupUrl;
    this._handlers = {};
    this._tools = {};
    if (this.eventsUrl && typeof EventSource !== "undefined") {
      this._source = new EventSource(this.eventsUrl);
      var self = this;
      this._source.onmessage = function (event) {
        try {
          self._emit("event", JSON.parse(event.data));
        } catch (err) {
          /* ignore */
        }
      };
    }
  }

  VoiceSession.prototype.on = function (name, handler) {
    this._handlers[name] = this._handlers[name] || [];
    this._handlers[name].push(handler);
    return this;
  };

  VoiceSession.prototype._emit = function (name, payload) {
    (this._handlers[name] || []).forEach(function (fn) {
      fn(payload);
    });
    if (name === "event" && payload && payload.turns) this._emit("transcript", payload);
  };

  /* Matches MAX_TOOL_STEPS on the server. */
  const MAX_TOOL_ROUNDS = 3;

  /*
   * Registers a tool this page can run. The name has to match the tool in the
   * studio. The handler holds the page's own data; only what it returns is sent.
   */
  VoiceSession.prototype.tool = function (name, handler) {
    this._tools[name] = handler;
    return this;
  };

  VoiceSession.prototype._post = async function (payload) {
    payload.sessionId = this.id;
    payload.token = this.token;
    const res = await fetch(this.completeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Turn failed");
    return data;
  };

  VoiceSession.prototype._runTool = async function (call) {
    try {
      const output = await this._tools[call.name](call.arguments || {});
      return typeof output === "string" ? output : JSON.stringify(output === undefined ? null : output);
    } catch (error) {
      /* The model can speak through a failed tool, so this is reported, not thrown. */
      return "The tool failed: " + (error && error.message ? error.message : "unknown error");
    }
  };

  VoiceSession.prototype.sendText = async function (text) {
    const self = this;
    let data = await this._post({ text: text });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const calls = (data.toolCalls || []).filter(function (call) {
        return typeof self._tools[call.name] === "function";
      });
      if (!calls.length) break;
      this._emit("tool", { calls: calls });
      const results = await Promise.all(
        calls.map(async function (call) {
          return { id: call.id, result: await self._runTool(call) };
        }),
      );
      data = await this._post({ toolResults: results });
    }

    this._emit("reply", data);
    return data;
  };

  VoiceSession.prototype.hangup = async function () {
    if (this._source) this._source.close();
    await fetch(this.hangupUrl, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + this.token },
    });
    this._emit("ended", { id: this.id });
  };

  VoiceStudio.mount = function (opts) {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483646;width:320px;font-family:system-ui,sans-serif";
    host.innerHTML =
      '<div style="border:1px solid #e6e1da;border-radius:12px;background:#fff;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.12)">' +
      '<div style="font-weight:650;font-size:13px;margin-bottom:8px">Voice agent</div>' +
      '<div data-status style="font-size:12px;color:#78706a;margin-bottom:8px">Idle</div>' +
      '<div data-log style="max-height:160px;overflow:auto;font-size:12px;line-height:1.45;margin-bottom:8px"></div>' +
      '<form data-form style="display:flex;gap:6px"><input data-input style="flex:1;border:1px solid #e6e1da;border-radius:6px;padding:8px;font-size:12px" placeholder="Say something"><button style="background:#e4572e;color:#fff;border:0;border-radius:6px;padding:8px 10px;font-weight:650">Send</button></form>' +
      "</div>";
    document.body.appendChild(host);
    const client = new VoiceStudio(opts);
    const status = host.querySelector("[data-status]");
    const log = host.querySelector("[data-log]");
    const form = host.querySelector("[data-form]");
    const input = host.querySelector("[data-input]");
    let session = null;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      try {
        if (!session) {
          status.textContent = "Connecting…";
          session = await client.connect({ channel: opts.channel || "web", display: opts.display });
          status.textContent = "Connected · " + (session.agent && session.agent.name ? session.agent.name : "agent");
        }
        log.innerHTML += '<div><b>You</b> ' + escapeHtml(text) + "</div>";
        const reply = await session.sendText(text);
        log.innerHTML += '<div><b>Agent</b> ' + escapeHtml(reply.reply || "") + "</div>";
        log.scrollTop = log.scrollHeight;
        if ("speechSynthesis" in window && reply.reply) {
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply.reply));
        }
      } catch (err) {
        status.textContent = err.message || "Error";
      }
    });
    return host;
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  root.VoiceStudio = VoiceStudio;
})(typeof window !== "undefined" ? window : globalThis);
