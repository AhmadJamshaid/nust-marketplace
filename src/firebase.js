import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 1. FIREBASE CONFIG (Paste from Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2. CLOUDINARY CONFIG (Paste from Cloudinary Dashboard)
// Cloud Name: Top left of dashboard
export const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME"; 
// Preset Name: Settings > Upload > Upload presets > Name (Mode: Unsigned)
export const CLOUDINARY_PRESET = "YOUR_PRESET_NAME"; 

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);