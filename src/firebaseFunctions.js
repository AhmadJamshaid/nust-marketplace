import { auth, db, storage } from './firebase';
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
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

// --- AUTH FUNCTIONS ---

export const signUpUser = async (email, password, userData) => {
  try {
    // 1. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Send verification email (Only works if user has access to that inbox)
    await sendEmailVerification(user);
    
    // 3. Save additional info (Dept, Semester) to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      ...userData,
      email: user.email,
      createdAt: serverTimestamp(),
      verified: false // Becomes true once they click the link in their email
    });
    
    return user;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch the extra info (Dept/Semester) we saved earlier
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return { ...user, ...userDoc.data() };
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// --- LISTING FUNCTIONS (Selling/Renting) ---

export const uploadImage = async (imageFile) => {
  try {
    // Create a unique name for the image
    const storageRef = ref(storage, `listings/${Date.now()}_${imageFile.name}`);
    // Upload it
    await uploadBytes(storageRef, imageFile);
    // Get the public link to the photo
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Image upload failed", error);
    return "https://via.placeholder.com/150"; // Fallback image if upload fails
  }
};

export const createListing = async (listingData) => {
  try {
    const docRef = await addDoc(collection(db, 'listings'), {
      ...listingData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
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

// --- REQUEST FUNCTIONS (Request Component) ---

export const createRequest = async (requestData) => {
  try {
    const docRef = await addDoc(collection(db, 'requests'), {
      ...requestData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getRequests = async () => {
  try {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    return requests;
  } catch (error) {
    return [];
  }
};

// --- AUTH LISTENER ---

export const authStateListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};