import { auth, db } from './firebase'; 
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendEmailVerification
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
export const authStateListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const signUpUser = async (email, password, userData) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await setDoc(doc(db, 'users', user.uid), {
    ...userData,
    email: user.email,
    createdAt: serverTimestamp(),
    verified: false
  });
  return userCredential;
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

export const resendVerificationLink = async () => {
  if (auth.currentUser) {
    return await sendEmailVerification(auth.currentUser);
  }
  throw new Error("No active user session found. Please login again.");
};

// --- LISTING FUNCTIONS ---
export const createListing = async (listingData) => {
  try {
    const docRef = await addDoc(collection(db, 'listings'), {
      ...listingData,
      createdAt: serverTimestamp()
    });
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
};