import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET } from './firebase'; 
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendEmailVerification
} from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, onSnapshot,
  orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment
} from 'firebase/firestore';

// --- AUTHENTICATION ---
export const authStateListener = (callback) => onAuthStateChanged(auth, callback);

export const signUpUser = async (email, password, userData) => {
  // PRD REQUIREMENT: Gatekeeping NUST Emails
  if (!email.endsWith('.edu.pk')) {
    throw new Error("Access Denied: Please use your official NUST/University email (@*.edu.pk).");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Create User Profile in Database
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    ...userData,
    email: userCredential.user.email,
    uid: userCredential.user.uid,
    reputation: 5.0, // Start with 5 Stars (PRD Requirement)
    totalRatings: 0,
    createdAt: serverTimestamp()
  });
  return userCredential;
};

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);
export const resendVerificationLink = () => auth.currentUser && sendEmailVerification(auth.currentUser);

// --- PROFILE & REPUTATION ---
export const getPublicProfile = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return !snap.empty ? snap.docs[0].data() : null;
};

// Rate User Logic (1-5 Stars)
export const rateUser = async (targetUserEmail, ratingValue) => {
  const q = query(collection(db, 'users'), where('email', '==', targetUserEmail));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const currentData = userDoc.data();
    
    // Calculate new weighted average
    const currentTotal = currentData.reputation * (currentData.totalRatings || 0);
    const newCount = (currentData.totalRatings || 0) + 1;
    const newAverage = (currentTotal + ratingValue) / newCount;

    await updateDoc(doc(db, 'users', userDoc.id), {
      reputation: Number(newAverage.toFixed(1)),
      totalRatings: increment(1)
    });
  }
};

// --- IMAGES (CLOUDINARY) ---
export const uploadImageToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET); 

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, 
    { method: "POST", body: formData }
  );
  
  if (!response.ok) throw new Error("Image upload failed. Check your Cloudinary Preset.");
  const data = await response.json();
  return data.secure_url;
};

// --- MARKETPLACE DATA ---
export const createListing = (data) => addDoc(collection(db, 'listings'), { ...data, createdAt: serverTimestamp() });

export const getListings = async () => {
  const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createRequest = (data) => addDoc(collection(db, 'requests'), { ...data, createdAt: serverTimestamp() });

export const getRequests = async () => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// --- CHAT SYSTEM ---
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