import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- PASTE YOUR REAL KEYS BELOW ---
const firebaseConfig = {
 apiKey: "AIzaSyBJ2q-5IKqomRzIF0X4LmVYhJJyYSXlABM",
  authDomain: "nust-market-5b7c7.firebaseapp.com",
  projectId: "nust-market-5b7c7",
  storageBucket: "nust-market-5b7c7.firebasestorage.app",
  messagingSenderId: "353984015464",
  appId: "1:353984015464:web:6d77f25ffe62d674339fdd"
};

// --- PASTE CLOUDINARY KEYS BELOW ---
export const CLOUDINARY_CLOUD_NAME = "dfrein4l7"; 
export const CLOUDINARY_PRESET = "riennd44"; 

// Initialize
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);