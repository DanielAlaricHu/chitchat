import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Note: This is not secret information, safe to expose in client-side code
const firebaseConfig = {
  apiKey: "AIzaSyCyuAQwFE7m7BZ472DvEvqRYVP31SY79Sg",
  authDomain: "chitchat-ce06a.firebaseapp.com",
  projectId: "chitchat-ce06a",
  storageBucket: "chitchat-ce06a.firebasestorage.app",
  messagingSenderId: "763944012416",
  appId: "1:763944012416:web:53822b31576e31d1ff7465",
  measurementId: "G-YG09LG0QRF"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);