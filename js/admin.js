
import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, orderBy, limit,
  updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
let owner = null;
let projectsCache = [];
let ticketsCache = [];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function notify(text, error = false) {
  const el = $("adminNotice");
  el.hidden = false;
  el.textContent = text;
  el.className = `notice ${error ? "error" : "success"}`;
}

function dateText(value) {
  return value?.toDate ? value.toDate().toLocaleDateString() : "Pending";
}

async function verifyOwner(user) {
  // Only an existing trusted owner should manage ownerUids.
  const allowlist = await getDoc(doc(db, "settings", "ownerAccess"));
  if (!allowlist.exists()) return false;
  const uids = allowlist.data().ownerUids;
  return Array.isArray(uids) && uids.includes(user.uid);
}

async function loadProjects() {
  const snapshot = await getDocs(query(
    collection(db, "projects"),
    orderBy("createdAt", "desc"),
    limit(200)
  ));

  projectsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  $("totalProjects").textContent = projectsCache.length;
  $("submittedProjects").textContent =
    projectsCache.filter(p => p.status === "submitted").length;
  $("inProgressProjects").textContent =
    projectsCache.filter(p => p.status === "in_progress").length;

  $("projectsTable").innerHTML = projectsCache.length ? `
    <table>
      <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Update</th></tr></thead>
      <tbody>${projectsCache.map(p => `
        <tr>
          <td>
            <strong>${escapeHTML(p.title)}</strong>
            <p>${escapeHTML(p.serviceType || "")}</p>
            <p class="small-text">${escapeHTML(p.description || "")}</p>
          </td>
          <td>${escapeHTML(p.clientEmail || p.clientId || "")}</td>
          <td>
            <select data-project-status="${escapeHTML(p.id)}">
              ${["submitted","quoted","approved","in_progress","review","completed","cancelled"]
                .map(s => `<option value="${s}" ${p.status === s ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </td>
          <td>
            <textarea data-project-note="${escapeHTML(p.id)}" maxlength="2000"
              placeholder="Client update">${escapeHTML(p.adminNote || "")}</textarea>
            <button class="button button-small" data-save-project="${escapeHTML(p.id)}">Save</button>
          </td>
        </tr>`).join("")}</tbody>
    </table>
  ` : '<p class="empty-state">No project requests yet.</p>';

  document.querySelectorAll("[data-save-project]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.saveProject;
      const status = document.querySelector(`[data-project-status="${CSS.escape(id)}"]`).value;
      const note = document.querySelector(`[data-project-note="${CSS.escape(id)}"]`).value.trim();

      button.disabled = true;
      try {
        await updateDoc(doc(db, "projects", id), {
          status,
          adminNote: note,
          updatedAt: serverTimestamp()
        });
        notify("Project update save ho gayi.");
        await loadProjects();
      } catch (error) {
        notify(error.message || "Project update fail ho gayi.", true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadTickets() {
  const snapshot = await getDocs(query(
    collection(db, "supportTickets"),
    orderBy("createdAt", "desc"),
    limit(200)
  ));

  ticketsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  $("totalTickets").textContent = ticketsCache.filter(t => t.status === "open").length;

  $("supportTable").innerHTML = ticketsCache.length ? ticketsCache.map(t => `
    <article class="list-item">
      <div class="item-head">
        <strong>${escapeHTML(t.subject)}</strong>
        <span class="badge">${escapeHTML(t.status || "open")}</span>
      </div>
      <p>Client: ${escapeHTML(t.clientEmail || t.clientId || "")}</p>
      <p>${escapeHTML(t.message || "")}</p>
      <p class="small-text">Created: ${dateText(t.createdAt)}</p>
      <div class="stack">
        <label for="reply-${escapeHTML(t.id)}">Admin reply</label>
        <textarea id="reply-${escapeHTML(t.id)}" maxlength="4000">${escapeHTML(t.adminReply || "")}</textarea>
        <div class="form-actions">
          <button class="button button-small" data-reply="${escapeHTML(t.id)}">Save reply</button>
          <button class="button button-ghost button-small" data-close="${escapeHTML(t.id)}">Close ticket</button>
        </div>
      </div>
    </article>
  `).join("") : '<p class="empty-state">No support tickets yet.</p>';

  document.querySelectorAll("[data-reply]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.reply;
      const reply = $(`reply-${id}`).value.trim();
      await saveTicket(id, { adminReply: reply, status: "answered" });
    });
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", async () => {
      await saveTicket(button.dataset.close, { status: "closed" });
    });
  });
}

async function saveTicket(id, values) {
  try {
    await updateDoc(doc(db, "supportTickets", id), {
      ...values,
      updatedAt: serverTimestamp()
    });
    notify("Support ticket update save ho gayi.");
    await loadTickets();
  } catch (error) {
    notify(error.message || "Ticket update fail ho gayi.", true);
  }
}

$("logoutButton").addEventListener("click", () => signOut(auth));

await authPersistenceReady;
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  owner = user;

  try {
    if (!(await verifyOwner(user))) {
      notify("Access denied. Ye account authorized owner nahi hai.", true);
      await signOut(auth);
      window.location.replace("dashboard.html");
      return;
    }

    await Promise.all([loadProjects(), loadTickets()]);
  } catch (error) {
    notify(`Owner data load nahi hua: ${error.message}`, true);
  }
});
