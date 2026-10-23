
import { auth, db, googleProvider, authPersistenceReady } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  reload
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let signupMode = false;

function notice(message, isError = false) {
  const el = $("authNotice");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.className = `notice ${isError ? "error" : "success"}`;
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "Is email ka account pehle se bana hua hai.",
    "auth/invalid-email": "Email address check karo.",
    "auth/invalid-credential": "Email ya password sahi nahi hai.",
    "auth/weak-password": "Password kam az kam 8 characters ka rakho.",
    "auth/too-many-requests": "Bohat zyada attempts hue. Kuch dair baad try karo.",
    "auth/popup-closed-by-user": "Google sign-in cancel ho gaya.",
    "auth/network-request-failed": "Internet connection check karo."
  };
  return messages[error.code] || error.message || "Request complete nahi ho saki.";
}

function setMode(isSignup) {
  signupMode = isSignup;
  $("authTitle").textContent = isSignup ? "Create your account." : "Welcome back.";
  $("authDescription").textContent = isSignup
    ? "Create an account to submit and track projects."
    : "Sign in to manage your digital projects.";
  $("nameField").hidden = !isSignup;
  $("displayName").required = isSignup;
  $("authSubmit").textContent = isSignup ? "Create account" : "Sign in";
  $("modeSwitch").innerHTML = isSignup
    ? 'Already registered? <a class="inline-link" href="#" id="toggleMode">Sign in</a>'
    : 'New here? <a class="inline-link" href="#" id="toggleMode">Create account</a>';
  $("forgotPassword").hidden = isSignup;
  $("password").autocomplete = isSignup ? "new-password" : "current-password";
  $("toggleMode").addEventListener("click", (event) => {
    event.preventDefault();
    setMode(!signupMode);
  });
}

async function ensureUserRecord(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      role: "client",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  // Never trust a client-editable role field to grant owner privileges.
}

async function routeUser(user) {
  await ensureUserRecord(user);

  if (user.email && !user.emailVerified && user.providerData.some(
    provider => provider.providerId === "password"
  )) {
    notice("Account bana hua hai, lekin email verify nahi hui. Verification email check karo.");
    return;
  }

  window.location.replace("dashboard.html");
}

await authPersistenceReady;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    await routeUser(user);
  } catch (error) {
    notice(friendlyError(error), true);
  }
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("authSubmit").disabled = true;

  try {
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;

    if (signupMode) {
      const name = $("displayName").value.trim();
      if (name.length < 2) throw new Error("Apna full name enter karo.");

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await ensureUserRecord(result.user);
      await sendEmailVerification(result.user);

      notice("Account create ho gaya. Email verification link open karo, phir login karo.");
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await reload(result.user);

      if (!result.user.emailVerified && result.user.providerData.some(
        provider => provider.providerId === "password"
      )) {
        await sendEmailVerification(result.user);
        await auth.signOut();
        notice("Email verify nahi hui. Naya verification link email par bhej diya hai.");
        return;
      }

      await routeUser(result.user);
    }
  } catch (error) {
    notice(friendlyError(error), true);
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("googleButton").addEventListener("click", async () => {
  $("googleButton").disabled = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserRecord(result.user);
    window.location.replace("dashboard.html");
  } catch (error) {
    notice(friendlyError(error), true);
  } finally {
    $("googleButton").disabled = false;
  }
});

$("forgotPassword").addEventListener("click", async () => {
  const email = $("email").value.trim().toLowerCase();
  if (!email) {
    notice("Pehle email address enter karo.", true);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    notice("Agar account maujood hai to password reset email bhej di gayi hai.");
  } catch (error) {
    notice(friendlyError(error), true);
  }
});

setMode(false);
