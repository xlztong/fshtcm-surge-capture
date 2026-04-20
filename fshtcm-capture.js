const STORE_KEY = "fshtcm_capture_log";
const LIMIT = 12;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(text, max = 4000) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n...[truncated]" : text;
}

function normalizeBody(body, contentType = "") {
  if (!body) return "";
  const text = String(body);
  if (/application\/json|text\/|application\/x-www-form-urlencoded/i.test(contentType)) {
    const parsed = safeJsonParse(text);
    return parsed ? JSON.stringify(parsed, null, 2) : text;
  }
  return text;
}

function pickHeaders(headers = {}) {
  const keep = [
    "content-type",
    "cookie",
    "set-cookie",
    "location",
    "user-agent",
    "referer",
    "x-token",
    "w-client",
    "authorization",
  ];
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (keep.includes(String(k).toLowerCase())) out[k] = v;
  }
  return out;
}

function readLogs() {
  const raw = $persistentStore.read(STORE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLog(entry) {
  const logs = readLogs();
  logs.unshift(entry);
  $persistentStore.write(JSON.stringify(logs.slice(0, LIMIT)), STORE_KEY);
}

function main() {
  const isResponse = typeof $response !== "undefined";
  const req = $request || {};
  const res = $response || {};
  const url = req.url || "";
  const method = req.method || "GET";
  const reqHeaders = pickHeaders(req.headers || {});
  const resHeaders = pickHeaders(res.headers || {});
  const reqType = req.headers?.["Content-Type"] || req.headers?.["content-type"] || "";
  const resType = res.headers?.["Content-Type"] || res.headers?.["content-type"] || "";

  const entry = {
    time: new Date().toISOString(),
    phase: isResponse ? "response" : "request",
    method,
    url,
    status: isResponse ? res.status : undefined,
    requestHeaders: reqHeaders,
    responseHeaders: isResponse ? resHeaders : undefined,
    requestBody: truncate(normalizeBody(req.body, reqType)),
    responseBody: isResponse ? truncate(normalizeBody(res.body, resType)) : undefined,
  };

  saveLog(entry);

  const title = isResponse ? `FSHTCM RES ${res.status || ""}` : `FSHTCM REQ ${method}`;
  const subtitle = url.replace(/^https?:\/\//, "");
  console.log("=".repeat(80));
  console.log(title);
  console.log(subtitle);
  console.log(JSON.stringify(entry, null, 2));

  const interesting = /oauth|login|bind|dept|doctor|schedule|order|register|reg\//i.test(url);
  if (interesting) {
    $notification.post(title, subtitle.slice(0, 80), isResponse ? "已记录响应到 Surge 日志" : "已记录请求到 Surge 日志");
  }

  $done({});
}

main();
