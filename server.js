const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "company.com").toLowerCase();
const ALLOWED_USER_EMAILS = (process.env.ALLOWED_USER_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_USER_DISPLAY_NAMES = parseAllowedUserDisplayNames(process.env.ALLOWED_USER_DISPLAY_NAMES || "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TICKETS_TABLE = process.env.SUPABASE_TICKETS_TABLE || "it_support_tickets";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TICKETS_FILE);
  } catch {
    await fs.writeFile(TICKETS_FILE, "[]", "utf8");
  }
}

async function readTickets() {
  await ensureDataFile();
  const raw = await fs.readFile(TICKETS_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeTickets(tickets) {
  await fs.writeFile(TICKETS_FILE, JSON.stringify(tickets, null, 2), "utf8");
}

function toDbRow(ticket) {
  return {
    id: ticket.id,
    created_at: ticket.createdAt,
    status: ticket.status,
    name: ticket.name,
    email: ticket.email,
    department: ticket.department,
    issue_type: ticket.issueType,
    priority: ticket.priority,
    description: ticket.description,
    device: ticket.device,
    location: ticket.location,
  };
}

function fromDbRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    name: row.name,
    email: row.email,
    department: row.department,
    issueType: row.issue_type,
    priority: row.priority,
    description: row.description,
    device: row.device,
    location: row.location,
  };
}

async function insertTicketSupabase(ticket) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TICKETS_TABLE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(toDbRow(ticket)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${text}`);
  }
}

async function readTicketsSupabase() {
  const query = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TICKETS_TABLE}?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase read failed (${response.status}): ${text}`);
  }

  const rows = await response.json();
  return rows.map(fromDbRow);
}

async function updateTicketStatusSupabase(ticketId, status) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TICKETS_TABLE}?id=eq.${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase status update failed (${response.status}): ${text}`);
  }
}

async function saveTicket(ticket) {
  if (USE_SUPABASE) {
    await insertTicketSupabase(ticket);
    return;
  }

  const tickets = await readTickets();
  tickets.unshift(ticket);
  await writeTickets(tickets);
}

async function getTickets() {
  if (USE_SUPABASE) {
    return readTicketsSupabase();
  }
  return readTickets();
}

async function updateTicketStatus(ticketId, status) {
  if (USE_SUPABASE) {
    await updateTicketStatusSupabase(ticketId, status);
    return;
  }

  const tickets = await readTickets();
  const ticket = tickets.find((item) => item.id === ticketId);
  if (!ticket) {
    return false;
  }

  ticket.status = status;
  await writeTickets(tickets);
  return true;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function isAllowedEmail(email) {
  const parts = String(email || "")
    .trim()
    .toLowerCase()
    .split("@");
  return parts.length === 2 && parts[1] === ALLOWED_EMAIL_DOMAIN;
}

function isAllowedUser(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!isAllowedEmail(normalizedEmail)) return false;
  return ALLOWED_USER_EMAILS.length === 0 || ALLOWED_USER_EMAILS.includes(normalizedEmail);
}

function parseAllowedUserDisplayNames(value) {
  return String(value || "")
    .split(",")
    .reduce((names, entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) return names;

      const email = entry.slice(0, separatorIndex).trim().toLowerCase();
      const displayName = entry.slice(separatorIndex + 1).trim();
      if (email && displayName) {
        names[email] = displayName;
      }
      return names;
    }, {});
}

function titleCaseName(value) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getDisplayName(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (ALLOWED_USER_DISPLAY_NAMES[normalizedEmail]) {
    return ALLOWED_USER_DISPLAY_NAMES[normalizedEmail];
  }

  return titleCaseName(normalizedEmail.split("@")[0] || "User");
}

async function parseBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function requireAdminToken(req) {
  if (!ADMIN_TOKEN) return true;
  const provided = req.headers["x-admin-token"];
  return provided && String(provided) === ADMIN_TOKEN;
}

function normalizeTicket(input) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "open",
    name: String(input.name || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    department: String(input.department || "").trim(),
    issueType: String(input.issueType || "").trim(),
    priority: String(input.priority || "").trim(),
    description: String(input.description || "").trim(),
    device: String(input.device || "").trim(),
    location: String(input.location || "").trim(),
  };
}

function validateTicket(ticket) {
  const requiredFields = ["name", "email", "department", "issueType", "priority", "description"];
  for (const field of requiredFields) {
    if (!ticket[field]) {
      return `${field} is required`;
    }
  }

  if (!isAllowedEmail(ticket.email)) {
    return `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed`;
  }

  if (!isAllowedUser(ticket.email)) {
    return "This email is not on the allowed user list";
  }

  const validPriorities = new Set(["low", "medium", "high", "critical"]);
  if (!validPriorities.has(ticket.priority.toLowerCase())) {
    return "priority must be one of: low, medium, high, critical";
  }

  return null;
}

function validateStatus(status) {
  const validStatuses = new Set(["open", "in progress", "resolved", "closed"]);
  return validStatuses.has(status) ? null : "status must be one of: open, in progress, resolved, closed";
}

function safeJoin(base, target) {
  const targetPath = path.resolve(base, target);
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

async function serveStatic(req, res) {
  const reqPath = req.url === "/" ? "index.html" : req.url.replace(/\?.*$/, "").replace(/^\/+/, "");
  const targetPath = safeJoin(PUBLIC_DIR, reqPath);
  if (!targetPath) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(targetPath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fs.readFile(targetPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/config") {
      sendJson(res, 200, {
        allowedEmailDomain: ALLOWED_EMAIL_DOMAIN,
        allowedUserListEnabled: ALLOWED_USER_EMAILS.length > 0,
        adminTokenEnabled: Boolean(ADMIN_TOKEN),
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/identity") {
      const payload = await parseBody(req);
      const email = String(payload.email || "").trim().toLowerCase();
      if (!isAllowedEmail(email)) {
        sendJson(res, 400, { error: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed` });
        return;
      }

      if (!isAllowedUser(email)) {
        sendJson(res, 403, { error: "This email is not on the allowed user list" });
        return;
      }

      sendJson(res, 200, { ok: true, email, displayName: getDisplayName(email) });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tickets") {
      const payload = await parseBody(req);
      const ticket = normalizeTicket(payload);
      const validationError = validateTicket(ticket);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      await saveTicket(ticket);
      sendJson(res, 201, { ok: true, ticketId: ticket.id, createdAt: ticket.createdAt });
      return;
    }

    if (req.method === "GET" && req.url === "/api/tickets") {
      if (!requireAdminToken(req)) {
        sendJson(res, 401, { error: "Unauthorized. Supply x-admin-token header." });
        return;
      }
      const tickets = await getTickets();
      sendJson(res, 200, { tickets });
      return;
    }

    const statusMatch = req.url.match(/^\/api\/tickets\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      if (!requireAdminToken(req)) {
        sendJson(res, 401, { error: "Unauthorized. Supply x-admin-token header." });
        return;
      }

      const payload = await parseBody(req);
      const status = String(payload.status || "").trim().toLowerCase();
      const validationError = validateStatus(status);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const updated = await updateTicketStatus(decodeURIComponent(statusMatch[1]), status);
      if (updated === false) {
        sendJson(res, 404, { error: "Ticket not found" });
        return;
      }

      sendJson(res, 200, { ok: true, status });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: "Internal server error", details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`IT support ticket app running on http://localhost:${PORT}`);
  console.log(`Allowed email domain: @${ALLOWED_EMAIL_DOMAIN}`);
  console.log(`Allowed user list: ${ALLOWED_USER_EMAILS.length ? `${ALLOWED_USER_EMAILS.length} email(s)` : "domain-only mode"}`);
  console.log(`Storage mode: ${USE_SUPABASE ? `Supabase (${SUPABASE_TICKETS_TABLE})` : "Local JSON file"}`);
  if (!ADMIN_TOKEN) {
    console.log("ADMIN_TOKEN is not set. /api/tickets is publicly readable.");
  }
});
