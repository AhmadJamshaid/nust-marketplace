import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBJ2q-5IKqomRzIF0X4LmVYhJJyYSXlABM",
  authDomain: "nust-market.firebaseapp.com",
  projectId: "nust-market",
  storageBucket: "nust-market.appspot.com",
  messagingSenderId: "353984015464",
  appId: "1:353984015464:web:6d77f25ffe62d674339fdd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;