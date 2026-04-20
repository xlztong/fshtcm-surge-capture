const STORE_KEY = "fshtcm_capture_log";
const LIMIT = 12;

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function truncate(text, max = 4000) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n...[truncated]" : text;
}

function normalizeBody(body, contentType) {
  if (!body) return "";
  const text = String(body);
  if (/application\/json|text\/|application\/x-www-form-urlencoded/i.test(contentType || "")) {
    const parsed = safeJsonParse(text);
    return parsed ? JSON.stringify(parsed, null, 2) : text;
  }
  return text;
}

function pickHeaders(headers) {
  const keep = ["content-type","set-cookie","location","x-token","w-client"];
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (keep.includes(String(k).toLowerCase())) out[k] = v;
  }
  return out;
}

function readLogs() {
  const raw = $persistentStore.read(STORE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveLog(entry) {
  const logs = readLogs();
  logs.unshift(entry);
  $persistentStore.write(JSON.stringify(logs.slice(0, LIMIT)), STORE_KEY);
}

const req = $request || {};
const res = $response || {};
const reqHeaders = req.headers || {};
const resHeaders = res.headers || {};
const reqType = reqHeaders["Content-Type"] || reqHeaders["content-type"] || "";
const resType = resHeaders["Content-Type"] || resHeaders["content-type"] || "";
const url = req.url || "";
const method = req.method || "GET";

const entry = {
  time: new Date().toISOString(),
  phase: "response",
  method,
  url,
  status: res.status,
  requestHeaders: pickHeaders(reqHeaders),
  responseHeaders: pickHeaders(resHeaders),
  requestBody: truncate(normalizeBody(req.body, reqType)),
  responseBody: truncate(normalizeBody(res.body, resType)),
};

saveLog(entry);
console.log("FSHTCM RES", res.status || "", url);
console.log(JSON.stringify(entry, null, 2));

if (/oauth|login|bind|dept|doctor|schedule|order|register|reg\//i.test(url)) {
  $notification.post(`FSHTCM RES ${res.status || ""}`, url.replace(/^https?:\/\//, "").slice(0, 80), "已记录响应到 Surge 日志");
}

$done({});
