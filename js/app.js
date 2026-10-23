
import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

$("menuToggle")?.addEventListener("click", () => {
  $("mainNav")?.classList.toggle("open");
});

$("logoutButton")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.reload();
});

await authPersistenceReady;

onAuthStateChanged(auth, async user => {
  if (!user) return;

  const login = $("loginLink");
  const dashboard = $("dashboardLink");
  const logout = $("logoutButton");
  const admin = $("adminLink");

  if (login) login.hidden = true;
  if (dashboard) dashboard.hidden = false;
  if (logout) logout.hidden = false;

  try {
    const ownerAccess = await getDoc(doc(db, "settings", "ownerAccess"));
    const ownerUids = ownerAccess.exists() ? ownerAccess.data().ownerUids : [];

    if (admin && Array.isArray(ownerUids) && ownerUids.includes(user.uid)) {
      admin.hidden = false;
    }
  } catch {
    // Navigation visibility is not an authorization boundary.
  }
});
