import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendEmailVerification, updateProfile, updatePassword, sendPasswordResetEmail,
  verifyPasswordResetCode, confirmPasswordReset
} from 'firebase/auth';
import {
  collection, addDoc, getDocs, getDoc, query, where, onSnapshot,
  orderBy, serverTimestamp, doc, setDoc, updateDoc, increment, deleteDoc, limit, writeBatch, arrayUnion
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
export const validatePassword = (password) => {
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

// --- CHAT METADATA (IDENTITY SYSTEM) ---
// This ensures usernames are ALWAYS available and email addresses NEVER appear in UI

export const createOrGetChat = async (chatId, chatData) => {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    // Create new chat metadata with participant usernames
    await setDoc(chatRef, {
      ...chatData,
      chatId,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      deletedBy: [] // Initialize deletedBy array
    });
    return chatData;
  } else {
    // Update last message time AND restore visibility (clear deletedBy)
    // If a new message comes in, we want BOTH parties to see it.
    await updateDoc(chatRef, {
      lastMessageAt: serverTimestamp(),
      deletedBy: [] // RESTORE VISIBILITY ON NEW ACTIVITY
    });
    return chatSnap.data();
  }
};

export const getChatMetadata = async (chatId) => {
  const chatSnap = await getDoc(doc(db, 'chats', chatId));
  return chatSnap.exists() ? chatSnap.data() : null;
};

export const listenToUserChats = (userEmail, callback) => {
  // Listen to all chats - we'll filter client-side since Firestore doesn't support
  // array-contains queries on complex objects
  const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const allChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Filter for chats where user is a participant
    const userChats = allChats.filter(chat =>
      chat.participants?.some(p => p.email === userEmail)
    );
    callback(userChats);
  }, (error) => {
    console.error("Chat metadata listener error:", error);
    callback([]);
  });
};

// --- CHAT (OPTIMIZED FOR INSTANT DELIVERY) ---
export const sendMessage = async (chatId, sender, text, chatMetadata = null) => {
  // CRITICAL: Ensure chat metadata exists BEFORE sending message
  // This guarantees usernames are stored and email NEVER appears in UI

  // Even if metadata exists, we MUST call this to clear 'deletedBy' (restore visibility)
  // because createOrGetChat handles the "restore" logic inside its else block now.
  await createOrGetChat(chatId, chatMetadata || {});

  // Use Date.now() for instant local timestamp, serverTimestamp for ordering
  const timestamp = new Date();

  // 1. Check if this is the start of a conversation (to send System Tip)
  // We check existing messages. If 0, then this is the first one.
  const q = query(collection(db, 'messages'), where('chatId', '==', chatId), limit(1));
  const snap = await getDocs(q);
  const isFirstMessage = snap.empty;

  // 2. Add User Message
  await addDoc(collection(db, 'messages'), {
    chatId,
    sender,
    text,
    createdAt: serverTimestamp(),
    clientTimestamp: timestamp.toISOString(),
    read: false
  });

  // 3. If first message, Add System Tip
  if (isFirstMessage) {
    await addDoc(collection(db, 'messages'), {
      chatId,
      sender: "System",
      text: "👋 Tip: feel free to exchange WhatsApp numbers for faster communication! ⚡ Just remember: NUST Marketplace isn't responsible for trades outside the platform. Stay safe! 🛡️",
      createdAt: serverTimestamp(),
      clientTimestamp: new Date(timestamp.getTime() + 100).toISOString(), // slightly after
      read: false
    });
  }
};

export const listenToMessages = (chatId, callback) => {
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId)
    // orderBy('createdAt', 'asc') // Removed to avoid index issues
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Use clientTimestamp if serverTimestamp is not yet set
        createdAt: data.createdAt || new Date(data.clientTimestamp)
      };
    });

    // Sort client-side to ensure correct order without Firestore index
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



export const listenToAllMessages = (callback) => {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt || new Date(data.clientTimestamp)
      };
    });
    callback(messages);
  }, (error) => {
    console.error("All messages listener error:", error);
    callback([]);
  });
};

export const deleteChat = async (chatId, userEmail) => {
  // LOGICAL DELETION (WhatsApp Style)
  // Instead of deleting messages, we hide the chat from the specific user.
  const chatRef = doc(db, 'chats', chatId);

  // Ideally, we should check if it exists, but arrayUnion is safe (create if missing, but we expect it to exist)
  // We use setDoc with merge or updateDoc. updateDoc fails if doc missing.
  // Since we are deleting, the chat MUST exist.

  await updateDoc(chatRef, {
    deletedBy: arrayUnion(userEmail)
  }).catch(async (err) => {
    // If doc doesn't exist (legacy chat?), create it then delete it? 
    // Or just ignore.
    console.warn("Could not logical delete chat (metadata missing?):", err);

    // Fallback: If metadata missing, maybe we SHOULD delete messages?
    // But user asked for WhatsApp style. Let's create metadata if missing to support hiding.
    await setDoc(chatRef, {
      chatId,
      deletedBy: [userEmail],
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
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

  // If 'createdAt' index is missing, it might fail. Fallback without sort if needed.
  // Actually, let's just use limit for robustness first, or sort by username?
  // Sorting by username is weird if no full index. 
  // Let's just fetch limit 50.
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
  // Query ALL messages in this chat (safer to avoid compound index issues with 'read' field)
  // We will filter client-side.
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId)
  );

  const snap = await getDocs(q);
  const batch = writeBatch(db);

  let updateCount = 0;
  snap.docs.forEach((doc) => {
    const data = doc.data();
    // Check if unread AND sender is NOT me (Case-Insensitive for safety)
    const isFromOther = data.sender && userEmail && data.sender.toLowerCase() !== userEmail.toLowerCase();

    if (!data.read && isFromOther) {
      batch.update(doc.ref, { read: true });
      updateCount++;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }
};



export const verifyResetCode = async (code) => {
  return await verifyPasswordResetCode(auth, code);
};

export const confirmReset = async (code, newPassword) => {
  validatePassword(newPassword);
  await confirmPasswordReset(auth, code, newPassword);
};

