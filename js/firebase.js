
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// AetherCode Digital Solutions - Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYDjp0KifTXzZ_mjX3UD_HGsMQEpx_GEU",
  authDomain: "aethercode-806a1.firebaseapp.com",
  projectId: "aethercode-806a1",
  storageBucket: "aethercode-806a1.firebasestorage.app",
  messagingSenderId: "934508511481",
  appId: "1:934508511481:web:561aa27e5ce34e8acca228"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Keep login session persistent across browser restarts
const authPersistenceReady = setPersistence(
  auth,
  browserLocalPersistence
);

// Google Sign-In provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// Firestore Database
const db = getFirestore(app);

// Export Firebase services for other JS files
export {
  app,
  auth,
  db,
  googleProvider,
  authPersistenceReady
};
