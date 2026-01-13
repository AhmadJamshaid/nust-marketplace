import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET } from './firebase'; 
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendEmailVerification, updateProfile
} from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, onSnapshot,
  orderBy, serverTimestamp, doc, setDoc, updateDoc, increment, deleteDoc, limit
} from 'firebase/firestore';

export const authStateListener = (callback) => onAuthStateChanged(auth, callback);

// --- 1. SECURITY: USERNAME LOGIN LOGIC ---

// Helper: Check if username exists
export const checkUsernameUnique = async (username) => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  return snap.empty; // Returns true if unique
};

// Login using Username (Not Email)
export const loginWithUsername = async (username, password) => {
  // First, find the email attached to this username
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    throw new Error("Username not found. Please Sign Up.");
  }

  const userEmail = snap.docs[0].data().email;
  
  // Then, sign in using that email and the APP password
  return await signInWithEmailAndPassword(auth, userEmail, password);
};

export const signUpUser = async (email, password, userData) => {
  // Gatekeeping
  if (!email.endsWith('.edu.pk')) {
    throw new Error("Access Denied: Please use your official NUST/University email (@*.edu.pk).");
  }
  
  // Enforce Unique Username
  const isUnique = await checkUsernameUnique(userData.username);
  if (!isUnique) throw new Error("Username already taken. Please choose another.");

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update Profile
  await updateProfile(userCredential.user, {
    displayName: userData.username,
    photoURL: userData.photoURL
  });

  // Save detailed profile to DB
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    ...userData,
    email: userCredential.user.email,
    uid: userCredential.user.uid,
    reputation: 5.0,
    totalRatings: 0,
    createdAt: serverTimestamp()
  });
  return userCredential;
};

export const logoutUser = () => signOut(auth);
export const resendVerificationLink = () => auth.currentUser && sendEmailVerification(auth.currentUser);

export const getPublicProfile = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return !snap.empty ? snap.docs[0].data() : null;
};

// --- 2. MARKETPLACE ACTIONS ---

// Performance: Limit to 50 items for speed
export const getListings = async () => {
  const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createListing = (data) => addDoc(collection(db, 'listings'), { ...data, status: 'ACTIVE', createdAt: serverTimestamp() });

// Option A: Sold (Keeps item, marks as sold)
export const markListingSold = async (listingId) => {
  await updateDoc(doc(db, 'listings', listingId), { status: 'SOLD' });
};

// Option B: Delete (Removes item)
export const deleteListing = async (listingId) => {
  await deleteDoc(doc(db, 'listings', listingId));
};

export const reportListing = async (listingId, reason) => {
  await updateDoc(doc(db, 'listings', listingId), { reports: increment(1) });
};

// --- 3. IMAGES & CHAT ---

export const uploadImageToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET); 

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, 
    { method: "POST", body: formData }
  );
  if (!response.ok) throw new Error("Image upload failed.");
  const data = await response.json();
  // Optimization: Request compressed web-ready version
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
};

export const createRequest = (data) => addDoc(collection(db, 'requests'), { ...data, createdAt: serverTimestamp() });

export const getRequests = async () => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const sendMessage = async (chatId, sender, text) => {
  await addDoc(collection(db, 'messages'), { chatId, sender, text, createdAt: serverTimestamp() });
};

export const listenToMessages = (chatId, callback) => {
  const q = query(collection(db, 'messages'), where('chatId', '==', chatId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

export const listenToAllMessages = (callback) => {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

export const rateUser = async (targetUserEmail, ratingValue) => {
  const q = query(collection(db, 'users'), where('email', '==', targetUserEmail));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const currentData = userDoc.data();
    const currentTotal = currentData.reputation * (currentData.totalRatings || 0);
    const newCount = (currentData.totalRatings || 0) + 1;
    const newAverage = (currentTotal + ratingValue) / newCount;
    await updateDoc(doc(db, 'users', userDoc.id), {
      reputation: Number(newAverage.toFixed(1)),
      totalRatings: increment(1)
    });
  }
};