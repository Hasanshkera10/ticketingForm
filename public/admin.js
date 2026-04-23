const authCard = document.getElementById("admin-auth-card");
const authForm = document.getElementById("admin-auth-form");
const authMessage = document.getElementById("admin-auth-message");
const tokenInput = document.getElementById("admin-token-input");
const dashboard = document.getElementById("admin-dashboard");
const adminMessage = document.getElementById("admin-message");
const ticketCountHeading = document.getElementById("ticket-count-heading");
const totalCount = document.getElementById("total-count");
const openCount = document.getElementById("open-count");
const urgentCount = document.getElementById("urgent-count");
const ticketsList = document.getElementById("tickets-list");
const searchInput = document.getElementById("ticket-search");
const priorityFilter = document.getElementById("priority-filter");
const statusTabs = document.getElementById("status-tabs");
const refreshButton = document.getElementById("refresh-tickets-button");
const exportButton = document.getElementById("export-csv-button");
const ticketModal = document.getElementById("ticket-modal");
const closeTicketModalButton = document.getElementById("close-ticket-modal");
const modalTicketReference = document.getElementById("modal-ticket-reference");
const modalTicketTitle = document.getElementById("modal-ticket-title");
const modalTicketMeta = document.getElementById("modal-ticket-meta");
const modalTicketBadges = document.getElementById("modal-ticket-badges");
const modalTicketDescription = document.getElementById("modal-ticket-description");
const modalTicketDetails = document.getElementById("modal-ticket-details");

const tokenStorageKey = "ticketing-admin-token";
const ticketStatuses = ["open", "in progress", "resolved", "closed"];
let activeStatus = "open";
let adminToken = localStorage.getItem(tokenStorageKey) || "";
let tickets = [];

function setAuthMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = `message ${type || ""}`.trim();
}

function setAdminMessage(text, type) {
  adminMessage.textContent = text;
  adminMessage.className = `message ${type || ""}`.trim();
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value) {
  return String(value || "unknown")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFilteredTickets() {
  const query = searchInput.value.trim().toLowerCase();
  const priority = priorityFilter.value;

  return tickets.filter((ticket) => {
    const searchable = [
      ticket.id,
      ticket.name,
      ticket.email,
      ticket.department,
      ticket.issueType,
      ticket.priority,
      ticket.status,
      ticket.description,
      ticket.device,
      ticket.location,
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || searchable.includes(query);
    const matchesPriority = !priority || ticket.priority === priority;
    const matchesStatus = !activeStatus || ticket.status === activeStatus;
    return matchesQuery && matchesPriority && matchesStatus;
  });
}

function updateStats(filteredTickets) {
  totalCount.textContent = tickets.length;
  openCount.textContent = tickets.filter((ticket) => ticket.status === "open").length;
  urgentCount.textContent = tickets.filter((ticket) => ["high", "critical"].includes(ticket.priority)).length;

  const label = filteredTickets.length === 1 ? "ticket" : "tickets";
  ticketCountHeading.textContent = `${filteredTickets.length} ${label} shown`;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className || ""}`.trim();
  badge.textContent = text;
  return badge;
}

function createStatusSelect(ticket) {
  const statusSelect = document.createElement("select");
  statusSelect.className = "ticket-row-status";
  statusSelect.dataset.ticketId = ticket.id;
  statusSelect.setAttribute("aria-label", `Update status for ${ticket.name || "ticket"}`);

  ticketStatuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = formatLabel(status);
    option.selected = ticket.status === status;
    statusSelect.append(option);
  });

  return statusSelect;
}

function renderStatusTabs() {
  statusTabs.replaceChildren();

  ticketStatuses.forEach((status) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = status === activeStatus ? "status-tab active" : "status-tab";
    button.dataset.status = status;

    const label = document.createElement("span");
    label.textContent = formatLabel(status);
    const count = document.createElement("strong");
    count.textContent = tickets.filter((ticket) => ticket.status === status).length;
    button.append(label, count);
    statusTabs.append(button);
  });
}

function renderTicketRow(ticket) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ticket-row";
  row.dataset.ticketId = ticket.id;

  const requester = document.createElement("div");
  requester.className = "ticket-row-main";
  const name = document.createElement("strong");
  name.textContent = ticket.name || "Unnamed requester";
  const meta = document.createElement("span");
  meta.textContent = `${ticket.department || "No department"} - ${ticket.email || "No email"}`;
  requester.append(name, meta);

  const issue = document.createElement("span");
  issue.className = "ticket-row-issue";
  issue.textContent = formatLabel(ticket.issueType);

  const createdAt = document.createElement("span");
  createdAt.className = "ticket-row-date";
  createdAt.textContent = formatDate(ticket.createdAt);

  const priority = createBadge(formatLabel(ticket.priority), `priority-${ticket.priority || "unknown"}`);
  const statusSelect = createStatusSelect(ticket);

  row.append(requester, issue, createdAt, priority, statusSelect);
  return row;
}

function renderTableHeader() {
  const header = document.createElement("div");
  header.className = "ticket-table-header";
  ["Requester", "Issue", "Created", "Priority", "Status"].forEach((label) => {
    const item = document.createElement("span");
    item.textContent = label;
    header.append(item);
  });
  return header;
}

function renderTickets() {
  const filteredTickets = getFilteredTickets();
  updateStats(filteredTickets);
  ticketsList.replaceChildren();
  renderStatusTabs();

  if (!filteredTickets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = tickets.length ? "No tickets match the current filters." : "No tickets have been submitted yet.";
    ticketsList.append(empty);
    return;
  }

  const table = document.createElement("section");
  table.className = "ticket-table";
  const rows = document.createElement("div");
  rows.className = "ticket-rows";
  filteredTickets.forEach((ticket) => rows.append(renderTicketRow(ticket)));
  table.append(renderTableHeader(), rows);
  ticketsList.append(table);
}

function openTicketModal(ticket) {
  modalTicketReference.textContent = ticket.id ? `Reference ${ticket.id}` : "";
  modalTicketTitle.textContent = ticket.name || "Unnamed requester";
  modalTicketMeta.textContent = `${ticket.email || "No email"} - ${formatDate(ticket.createdAt)}`;
  modalTicketDescription.textContent = ticket.description || "No description provided.";
  modalTicketBadges.replaceChildren(
    createBadge(formatLabel(ticket.priority), `priority-${ticket.priority || "unknown"}`),
    createBadge(formatLabel(ticket.status), `status-${String(ticket.status || "unknown").replace(/\s+/g, "-")}`)
  );
  modalTicketDetails.replaceChildren();

  [
    ["Department", ticket.department],
    ["Issue type", formatLabel(ticket.issueType)],
    ["Device", ticket.device || "Not provided"],
    ["Location", ticket.location || "Not provided"],
  ].forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value || "Not provided";
    modalTicketDetails.append(term, description);
  });

  ticketModal.classList.remove("hidden");
  closeTicketModalButton.focus();
}

function closeTicketModal() {
  ticketModal.classList.add("hidden");
}

async function loadTickets() {
  setAdminMessage("Loading tickets...", "");
  const headers = {};
  if (adminToken) {
    headers["x-admin-token"] = adminToken;
  }

  const response = await fetch("/api/tickets", { headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load tickets");
  }

  tickets = Array.isArray(data.tickets) ? data.tickets : [];
  dashboard.classList.remove("hidden");
  authCard.classList.add("hidden");
  localStorage.setItem(tokenStorageKey, adminToken);
  setAdminMessage(`Last updated ${formatDate(new Date().toISOString())}`, "ok");
  renderTickets();
}

async function updateTicketStatus(ticketId, status) {
  setAdminMessage("Moving ticket...", "");
  const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not update ticket status");
  }

  const ticket = tickets.find((item) => item.id === ticketId);
  if (ticket) {
    ticket.status = status;
  }
  setAdminMessage(`Ticket moved to ${formatLabel(status)}.`, "ok");
  renderTickets();
}

function toCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const filteredTickets = getFilteredTickets();
  const headers = ["createdAt", "status", "name", "email", "department", "issueType", "priority", "device", "location", "description", "id"];
  const rows = filteredTickets.map((ticket) => headers.map((key) => toCsvValue(ticket[key])).join(","));
  const csv = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `it-support-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminToken = tokenInput.value.trim();
  setAuthMessage("Checking token...", "");

  try {
    await loadTickets();
    setAuthMessage("", "");
  } catch (error) {
    localStorage.removeItem(tokenStorageKey);
    setAuthMessage(error.message, "error");
  }
});

[searchInput, priorityFilter].forEach((control) => {
  control.addEventListener("input", renderTickets);
});

statusTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".status-tab");
  if (!tab) return;

  activeStatus = tab.dataset.status;
  renderTickets();
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadTickets();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

exportButton.addEventListener("click", exportCsv);

ticketsList.addEventListener("click", (event) => {
  const row = event.target.closest(".ticket-row");
  if (!row || event.target.matches("select")) return;

  const ticket = tickets.find((item) => item.id === row.dataset.ticketId);
  if (ticket) {
    openTicketModal(ticket);
  }
});

ticketsList.addEventListener("change", async (event) => {
  if (!event.target.matches(".ticket-row-status")) return;

  const select = event.target;
  const ticketId = select.dataset.ticketId;
  const previousTicket = tickets.find((ticket) => ticket.id === ticketId);
  const previousStatus = previousTicket ? previousTicket.status : "";
  select.disabled = true;

  try {
    await updateTicketStatus(ticketId, select.value);
  } catch (error) {
    select.value = previousStatus;
    setAdminMessage(error.message, "error");
  } finally {
    select.disabled = false;
  }
});

closeTicketModalButton.addEventListener("click", closeTicketModal);

ticketModal.addEventListener("click", (event) => {
  if (event.target === ticketModal) {
    closeTicketModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTicketModal();
  }
});

if (adminToken) {
  tokenInput.value = adminToken;
  loadTickets().catch(() => {
    localStorage.removeItem(tokenStorageKey);
    tokenInput.value = "";
    authCard.classList.remove("hidden");
    dashboard.classList.add("hidden");
    setAuthMessage("Saved token is no longer valid. Please enter it again.", "error");
  });
}
