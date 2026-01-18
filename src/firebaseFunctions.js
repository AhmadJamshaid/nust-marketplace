import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendEmailVerification, updateProfile, updatePassword, sendPasswordResetEmail,
  verifyPasswordResetCode, confirmPasswordReset
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
  // Prevent enumeration by not revealing if username specifically failed
  if (snap.empty) throw new Error("Invalid username or password.");
  const userEmail = snap.docs[0].data().email;
  try {
    return await signInWithEmailAndPassword(auth, userEmail, password);
  } catch (error) {
    throw new Error("Invalid username or password.");
  }
};


// --- HELPER --
const validatePassword = (password) => {
  const regex = /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&]).{8,}/;
  if (!regex.test(password)) {
    throw new Error("Password must be 8+ chars, include Upper, Lower, Num, and Special char.");
  }
};

export const signUpUser = async (email, password, userData) => {
  if (!email.endsWith('.edu.pk')) throw new Error("Access Denied: Use official NUST email (@*.edu.pk).");
  validatePassword(password);
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
    if (newPassword) {
      validatePassword(newPassword);
      await updatePassword(auth.currentUser, newPassword);
    }
  }
};

export const logoutUser = () => signOut(auth);
export const resendVerificationLink = () => auth.currentUser && sendEmailVerification(auth.currentUser);
export const reloadUser = async () => {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser;
  }
  return null;
};
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export const getPublicProfile = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return !snap.empty ? snap.docs[0].data() : null;
};

// --- MARKETPLACE ---
export const getListings = async () => {
  const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Real-time listener for listings
export const listenToListings = (callback) => {
  const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    const listings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(listings);
  }, (error) => {
    console.error("Listings listener error:", error);
    callback([]);
  });
};

export const createListing = (data) => addDoc(collection(db, 'listings'), { ...data, status: 'ACTIVE', createdAt: serverTimestamp() });
export const updateListing = async (listingId, data) => await updateDoc(doc(db, 'listings', listingId), data);
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
export const updateRequest = async (requestId, data) => await updateDoc(doc(db, 'requests', requestId), { ...data, editedAt: serverTimestamp() });
export const deleteRequest = async (requestId) => await deleteDoc(doc(db, 'requests', requestId));
export const getRequests = async () => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Real-time listener for requests
export const listenToRequests = (callback) => {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(requests);
  }, (error) => {
    console.error("Requests listener error:", error);
    callback([]);
  });
};


// --- CHATS COLLECTION (METADATA) ---


// --- CHATS COLLECTION (METADATA) ---
export const createChat = async (chatId, chatData) => {
  const chatRef = doc(db, 'chats', chatId);
  await setDoc(chatRef, {
    ...chatData,
    createdAt: chatData.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const listenToUserChats = (userEmail, callback) => {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userEmail),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  }, (error) => {
    console.error("User chats listener error:", error);
    callback([]);
  });
};

// --- CHAT (OPTIMIZED FOR INSTANT DELIVERY) ---
export const sendMessage = async (chatId, sender, text, recipientEmail = null) => {
  const timestamp = new Date();
  await addDoc(collection(db, 'messages'), {
    chatId,
    sender,
    text,
    createdAt: serverTimestamp(),
    clientTimestamp: timestamp.toISOString(),
    read: false
  });

  // UPDATE CHAT METADATA (Last Message & Unread)
  const chatRef = doc(db, 'chats', chatId);
  const updatePayload = {
    lastMessage: { text, sender, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp()
  };

  if (recipientEmail) {
    // Sanitize Email for Map Key (Firestore interprets '.' as nested field)
    const safeEmail = recipientEmail.replace(/\./g, ',');
    updatePayload[`unreadCounts.${safeEmail}`] = increment(1);
  }

  await updateDoc(chatRef, updatePayload).catch(err => console.log("Chat metadata update skipped/failed:", err.message));
};

export const listenToMessages = (chatId, callback) => {
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId)
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt || new Date(data.clientTimestamp)
      };
    });
    messages.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return timeA - timeB;
    });
    callback(messages);
  }, (error) => {
    console.error("Messages listener error:", error);
    callback([]);
  });
};

export const sendSystemMessageIfEmpty = async (chatId, text) => {
  const q = query(collection(db, 'messages'), where('chatId', '==', chatId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(collection(db, 'messages'), {
      chatId,
      sender: "System",
      text,
      createdAt: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
      read: true
    });
  }
};
export const verifyResetCode = async (code) => {
  return await verifyPasswordResetCode(auth, code);
};

export const confirmReset = async (code, newPassword) => {
  validatePassword(newPassword);
  await confirmPasswordReset(auth, code, newPassword);
};

export const deleteChat = async (chatId) => {
  const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  // Optionally delete chat metadata doc too, but messages are the bulk.
  await deleteDoc(doc(db, 'chats', chatId));
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

export const getAllUsers = async (limitCount = 50) => {
  const simpleQ = query(collection(db, 'users'), limit(limitCount));
  const snap = await getDocs(simpleQ);
  return snap.docs.map(d => d.data());
};

export const getUserProfile = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].data();
  return null;
};

export const searchUsersInDb = async (searchTerm) => {
  const q = query(collection(db, 'users'), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data())
    .filter(u =>
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
};

export const markChatRead = async (chatId, userEmail) => {
  if (!userEmail) return;

  // 1. Mark Messages as Read (visual flag for old messages)
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId),
    where('read', '==', false)
  );

  // We can't use onSnapshot here, just a one-time update
  getDocs(q).then(snap => {
    const batch = writeBatch(db);
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.sender && data.sender.toLowerCase() !== userEmail.toLowerCase()) {
        batch.update(d.ref, { read: true });
        count++;
      }
    });
    if (count > 0) batch.commit().catch(e => console.error("Batch read update failed", e));
  });

  // 2. Reset Unread Count in Metadata (Critical for Inbox Badge)
  const chatRef = doc(db, 'chats', chatId);
  const safeEmail = userEmail.replace(/\./g, ',');
  await updateDoc(chatRef, {
    [`unreadCounts.${safeEmail}`]: 0
  }).catch(e => console.log("Metadata read reset failed:", e.message));
};
