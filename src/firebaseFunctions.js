import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET } from './firebase'; 
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendEmailVerification, updateProfile, updatePassword
} from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, onSnapshot,
  orderBy, serverTimestamp, doc, setDoc, updateDoc, increment, deleteDoc, limit, writeBatch
} from 'firebase/firestore';

export const authStateListener = (callback) => onAuthStateChanged(auth, callback);

// --- AUTH & USER ---
export const checkUsernameUnique = async (username) => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  return snap.empty;
};

export const loginWithUsername = async (username, password) => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Username not found. Please Sign Up.");
  const userEmail = snap.docs[0].data().email;
  return await signInWithEmailAndPassword(auth, userEmail, password);
};

export const signUpUser = async (email, password, userData) => {
  if (!email.endsWith('.edu.pk')) throw new Error("Access Denied: Use official NUST email (@*.edu.pk).");
  const isUnique = await checkUsernameUnique(userData.username);
  if (!isUnique) throw new Error("Username taken. Choose another.");

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName: userData.username, photoURL: userData.photoURL });
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    ...userData, email: userCredential.user.email, uid: userCredential.user.uid,
    reputation: 5.0, totalRatings: 0, createdAt: serverTimestamp()
  });
  return userCredential;
};

export const updateUserProfile = async (uid, data, newPassword) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
  if (auth.currentUser) {
    if (data.username || data.photoURL) {
      await updateProfile(auth.currentUser, {
        displayName: data.username || auth.currentUser.displayName,
        photoURL: data.photoURL || auth.currentUser.photoURL
      });
    }
    if (newPassword) await updatePassword(auth.currentUser, newPassword);
  }
};

export const logoutUser = () => signOut(auth);
export const resendVerificationLink = () => auth.currentUser && sendEmailVerification(auth.currentUser);

export const getPublicProfile = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return !snap.empty ? snap.docs[0].data() : null;
};

// --- MARKETPLACE & FEED (PERSISTENT LISTENER OPTION) ---
// Note: We use getDocs for the feed to save reads, but if you want real-time feed, switch to onSnapshot here.
// For now, we fix the "Race Condition" by calling this immediately after auth in App.js
export const getListings = async () => {
  const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createListing = (data) => addDoc(collection(db, 'listings'), { ...data, status: 'ACTIVE', createdAt: serverTimestamp() });
export const markListingSold = async (listingId) => await updateDoc(doc(db, 'listings', listingId), { status: 'SOLD' });
export const deleteListing = async (listingId) => await deleteDoc(doc(db, 'listings', listingId));
export const reportListing = async (listingId, reason) => await updateDoc(doc(db, 'listings', listingId), { reports: increment(1) });

export const uploadImageToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET); 
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Image upload failed.");
  const data = await response.json();
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
};

// --- REQUESTS ---
export const createRequest = (data) => addDoc(collection(db, 'requests'), { ...data, createdAt: serverTimestamp() });
export const deleteRequest = async (requestId) => await deleteDoc(doc(db, 'requests', requestId));
export const getRequests = async () => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// --- REAL-TIME CHAT ARCHITECTURE (SOCKET LOGIC) ---

export const sendMessage = async (chatId, sender, text) => {
  // This triggers the onSnapshot listener immediately for optimistic UI
  await addDoc(collection(db, 'messages'), { 
    chatId, 
    sender, 
    text, 
    createdAt: serverTimestamp() // Server assigns time, local listener handles latency
  });
};

// THE FIX: Returns the Unsubscribe function for useEffect cleanup
export const listenToMessages = (chatId, callback) => {
  const q = query(
    collection(db, 'messages'), 
    where('chatId', '==', chatId), 
    orderBy('createdAt', 'asc') // Chronological order
  );
  
  // onSnapshot opens the WebSocket connection
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
};

export const listenToAllMessages = (callback) => {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
};

export const deleteChat = async (chatId) => {
  const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
};

export const rateUser = async (targetUserEmail, ratingValue) => {
  const q = query(collection(db, 'users'), where('email', '==', targetUserEmail));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const { reputation, totalRatings } = userDoc.data();
    const newCount = (totalRatings || 0) + 1;
    const newAverage = ((reputation * (totalRatings || 0)) + ratingValue) / newCount;
    await updateDoc(doc(db, 'users', userDoc.id), { reputation: Number(newAverage.toFixed(1)), totalRatings: increment(1) });
  }
};