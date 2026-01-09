import { auth, db } from './firebase'; 
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

// --- AUTH FUNCTIONS ---
export const signUpUser = async (email, password, userData) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await setDoc(doc(db, 'users', user.uid), {
    ...userData,
    email: user.email,
    createdAt: serverTimestamp(),
    verified: true
  });
  return { uid: user.uid, email: user.email, ...userData };
};

export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  return { uid: user.uid, email: user.email, ...userDoc.data() };
};

export const logoutUser = async () => {
  await signOut(auth);
};

// --- LISTING FUNCTIONS (Optimized for Free Tier) ---
export const createListing = async (listingData) => {
  try {
    console.log("Firebase Function: Sending data to Firestore...");
    const docRef = await addDoc(collection(db, 'listings'), {
      ...listingData,
      createdAt: serverTimestamp()
    });
    console.log("Firebase Function: Success! ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Firebase Function Error:", error);
    throw error;
  }
};

export const getListings = async () => {
  try {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const listings = [];
    querySnapshot.forEach((doc) => {
      listings.push({ id: doc.id, ...doc.data() });
    });
    return listings;
  } catch (error) {
    console.error("Error fetching listings:", error);
    return [];
  }
};

// --- REQUEST FUNCTIONS ---
export const createRequest = async (requestData) => {
  const docRef = await addDoc(collection(db, 'requests'), {
    ...requestData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getRequests = async () => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const requests = [];
  querySnapshot.forEach((doc) => {
    requests.push({ id: doc.id, ...doc.data() });
  });
  return requests;
};export const authStateListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};
// email verfication
import { getAuth, sendEmailVerification } from "firebase/auth";

// ... keep all your existing code (getListings, etc.) ...

// ADD THIS EXACTLY:
export const resendVerificationLink = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    return await sendEmailVerification(auth.currentUser);
  }
  throw new Error("No active user session found. Please login again.");
};