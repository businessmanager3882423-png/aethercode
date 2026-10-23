
import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  onAuthStateChanged, signOut, reload
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, query, where,
  orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
let currentUser = null;

function message(text, error = false) {
  const el = $("pageNotice");
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.className = `notice ${error ? "error" : "success"}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function dateText(value) {
  if (!value?.toDate) return "Pending";
  return value.toDate().toLocaleDateString();
}

function friendlyError(error) {
  if (error.code === "permission-denied") {
    return "Permission denied. Firestore rules aur user access check karo.";
  }
  return error.message || "Request complete nahi ho saki.";
}

async function loadProjects() {
  const q = query(
    collection(db, "projects"),
    where("clientId", "==", currentUser.uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const snapshot = await getDocs(q);
  const projects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  $("projectCount").textContent = projects.length;
  $("activeCount").textContent = projects.filter(p =>
    ["in_progress", "approved", "review"].includes(p.status)
  ).length;
  $("completedCount").textContent = projects.filter(p => p.status === "completed").length;

  $("projectsList").innerHTML = projects.length ? projects.map(p => `
    <article class="list-item">
      <div class="item-head">
        <strong>${escapeHTML(p.title)}</strong>
        <span class="badge">${escapeHTML(p.status || "submitted")}</span>
      </div>
      <p>${escapeHTML(p.serviceType || "Project")} · ${escapeHTML(p.budget || "Budget not set")}</p>
      <p>${escapeHTML(p.description || "")}</p>
      <p>Created: ${dateText(p.createdAt)}</p>
      ${p.adminNote ? `<p>Update: ${escapeHTML(p.adminNote)}</p>` : ""}
    </article>
  `).join("") : '<p class="empty-state">Abhi koi project nahi. Apni pehli request submit karo.</p>';
}

async function loadTickets() {
  const q = query(
    collection(db, "supportTickets"),
    where("clientId", "==", currentUser.uid),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  const snapshot = await getDocs(q);

  $("ticketsList").innerHTML = snapshot.empty
    ? '<p class="empty-state">Abhi koi support ticket nahi.</p>'
    : snapshot.docs.map(d => {
      const t = d.data();
      return `
        <article class="list-item">
          <div class="item-head">
            <strong>${escapeHTML(t.subject)}</strong>
            <span class="badge">${escapeHTML(t.status || "open")}</span>
          </div>
          <p>${escapeHTML(t.message || "")}</p>
          ${t.adminReply ? `<p><strong>Support reply:</strong> ${escapeHTML(t.adminReply)}</p>` : ""}
          <p>Created: ${dateText(t.createdAt)}</p>
        </article>`;
    }).join("");
}

async function loadProfile() {
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  const profile = snap.exists() ? snap.data() : {};

  $("welcomeText").textContent = `Welcome, ${currentUser.displayName || profile.name || currentUser.email}`;
  $("accountStatus").textContent = currentUser.emailVerified ? "Verified" : "Verify email";

  $("profileInfo").innerHTML = `
    <p><strong>Name:</strong> ${escapeHTML(currentUser.displayName || profile.name || "Not set")}</p>
    <p><strong>Email:</strong> ${escapeHTML(currentUser.email || "")}</p>
    <p><strong>Account ID:</strong> ${escapeHTML(currentUser.uid)}</p>
    <p><strong>Email status:</strong> ${currentUser.emailVerified ? "Verified" : "Not verified"}</p>
    <p class="small-text">Profile updates aur owner privileges ke liye server-side validation use karo.</p>
  `;

  // This is only a navigation hint. It does not grant admin access.
  if (profile.role === "owner") $("ownerLink").hidden = false;
}

$("projectForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !currentUser.emailVerified) {
    message("Verified account se login karna zaroori hai.", true);
    return;
  }

  const button = $("projectSubmit");
  button.disabled = true;

  try {
    await addDoc(collection(db, "projects"), {
      clientId: currentUser.uid,
      clientEmail: currentUser.email || "",
      title: $("projectTitle").value.trim(),
      serviceType: $("serviceType").value,
      budget: $("budget").value,
      description: $("projectDescription").value.trim(),
      status: "submitted",
      adminNote: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $("projectForm").reset();
    message("Project request submit ho gayi.");
    await loadProjects();
  } catch (error) {
    message(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
});

$("supportForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !currentUser.emailVerified) {
    message("Support submit karne ke liye verified login zaroori hai.", true);
    return;
  }

  try {
    await addDoc(collection(db, "supportTickets"), {
      clientId: currentUser.uid,
      clientEmail: currentUser.email || "",
      subject: $("supportSubject").value.trim(),
      message: $("supportMessage").value.trim(),
      status: "open",
      adminReply: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $("supportForm").reset();
    message("Support ticket send ho gaya.");
    await loadTickets();
  } catch (error) {
    message(friendlyError(error), true);
  }
});

$("logoutButton").addEventListener("click", () => signOut(auth));

await authPersistenceReady;
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  try {
    await reload(user);
    currentUser = auth.currentUser;

    if (!currentUser.emailVerified && currentUser.providerData.some(
      p => p.providerId === "password"
    )) {
      await signOut(auth);
      window.location.replace("login.html");
      return;
    }

    await loadProfile();
    await Promise.all([loadProjects(), loadTickets()]);
  } catch (error) {
    message(friendlyError(error), true);
  }
});
