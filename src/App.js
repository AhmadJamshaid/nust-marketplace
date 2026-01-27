import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag, Plus, LogOut, User, ClipboardList, Send,
  MessageCircle, X, Mail, Camera, Eye, EyeOff,
  Search, Sliders,
  Zap, Clock, ShieldCheck, Trash2, Flag, CheckCircle, AlertCircle, Edit2, Save, XCircle, CheckCheck, Download
} from 'lucide-react';
import {
  authStateListener, logoutUser, loginWithUsername, signUpUser,
  createListing, createRequest, deleteRequest,
  resendVerificationLink, sendMessage, listenToMessages,
  listenToAllMessages, getPublicProfile, uploadImageToCloudinary,
  deleteListing, markListingSold, reportListing, updateUserProfile, deleteChat,
  listenToListings, listenToRequests, markChatRead, updateRequest, resetPassword,
  confirmReset, updateListing, reloadUser, searchUsersInDb, getAllUsers, getUserProfile,
  listenToUserChats, validatePassword
} from './firebaseFunctions';
import InstallPopup from './components/InstallPopup';
import { useInstallPrompt } from './context/InstallContext';

const CATEGORIES = ['Electronics', 'Software Related', 'Stationary', 'Sports', 'Accessories', 'Study Material', 'Other'];

// --- REUSABLE PASSWORD COMPONENT ---
const PasswordInput = ({ value, onChange, placeholder = "Password", onValidation, ...props }) => {
  const [show, setShow] = useState(false);
  const requirements = [
    { regex: /.{8,}/, label: "8+ Chars" },
    { regex: /[A-Z]/, label: "Upper" },
    { regex: /[a-z]/, label: "Lower" },
    { regex: /[0-9]/, label: "Num" },
    { regex: /[@$!%*?&]/, label: "Special" },
  ];
  const isValid = requirements.every(r => r.regex.test(value));
  const missing = requirements.filter(r => !r.regex.test(value)).map(r => r.label).join(", ");

  useEffect(() => {
    if (onValidation) onValidation(isValid);
  }, [isValid, onValidation]);

  return (
    <div className="w-full">
      {value && (
        <div className="mb-1 h-5 flex justify-end sm:justify-start">
          {isValid ? (
            <div className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-slide-up"><CheckCircle size={10} strokeWidth={3} /> Strong Password</div>
          ) : (
            <div className="text-red-400 text-[10px] font-bold animate-pulse">Missing: {missing}</div>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className="w-full bg-[#202225] text-white border-2 border-transparent focus:border-[#003366] rounded-xl px-4 py-3 placeholder-gray-500 outline-none transition-all duration-200 shadow-inner text-base pr-10"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          {...props}
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [view, setView] = useState('market');
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);


  // --- LOADING STATES ---
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // --- POLLING FOR EMAIL VERIFICATION ---
  useEffect(() => {
    let interval;
    if (user && !user.emailVerified) {
      interval = setInterval(async () => {
        const updatedUser = await reloadUser();
        if (updatedUser?.emailVerified) {
          setUser({ ...updatedUser });
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [user]);

  // --- AUTH HANDLERS ---

  // --- ADVANCED FILTERS ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]); // New Suggestion State
  const [showFilters, setShowFilters] = useState(false);
  const [activeCondition, setActiveCondition] = useState('All');
  const [activeType, setActiveType] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');

  // Chat
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inboxGroups, setInboxGroups] = useState({});
  const [newMsg, setNewMsg] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadChats, setUnreadChats] = useState({});
  // ✅ CHAT METADATA: Source of truth for usernames (NO EMAIL FALLBACKS)
  const [chatMetadataMap, setChatMetadataMap] = useState({});


  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('SEECS');
  const [name, setName] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [resetCode, setResetCode] = useState(null); // URL Code
  const [newResetPassword, setNewResetPassword] = useState(''); // For New Password Input
  const [isResetPasswordValid, setIsResetPasswordValid] = useState(false); // Valid Format?


  // Rental Management State
  const [rentalModalItem, setRentalModalItem] = useState(null);
  const [newRentalDate, setNewRentalDate] = useState('');

  // Profile Edit Inputs
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPic, setEditPic] = useState(null);

  // Listing Inputs
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [activeProduct, setActiveProduct] = useState(null); // New: for detailed product view

  // Terms Modal State
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [itemDesc, setItemDesc] = useState('');
  const [listingType, setListingType] = useState('SELL');
  const [rentalPeriod, setRentalPeriod] = useState('Week'); // Day, Week, Month
  const [condition, setCondition] = useState('Used');
  const [category, setCategory] = useState('Electronics');
  const [imageFile, setImageFile] = useState(null); // Keep for backward compat or single view
  const [productImages, setProductImages] = useState([]); // New: for multiple images
  const [isUploading, setIsUploading] = useState(false);
  // activeProduct was redeclared here, removed.


  // Request Input (Community Board)
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [isPostingReq, setIsPostingReq] = useState(false);
  const [isMarketRun, setIsMarketRun] = useState(false);
  const [isRequestUrgent, setIsRequestUrgent] = useState(false);
  // EXPIRY STATES
  const [isAutoDeleteEnabled, setIsAutoDeleteEnabled] = useState(false); // Toggle: DEFAULT OFF
  const [expiryMode, setExpiryMode] = useState('duration'); // 'duration' or 'date'
  const [expiryVal, setExpiryVal] = useState(24);
  const [expiryUnit, setExpiryUnit] = useState('hours');
  const [expiryDate, setExpiryDate] = useState('');
  // Edit Request State
  const [editingReq, setEditingReq] = useState(null);
  const [editReqText, setEditReqText] = useState('');

  // --- NEW SEARCH & COMMUNITY STATE ---
  const [marketSearchMode, setMarketSearchMode] = useState('product'); // 'product' or 'user'
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');
  const [communityTab, setCommunityTab] = useState('wanted'); // 'wanted' or 'runs'
  const [reqCategory, setReqCategory] = useState('Electronics'); // For Community Post
  const [activeCommunityCategory, setActiveCommunityCategory] = useState('All'); // New Filter State
  const [communitySearchSuggestions, setCommunitySearchSuggestions] = useState([]); // New Suggestions State
  const [userSearchResults, setUserSearchResults] = useState([]); // Search Results from DB

  // --- PROFILE VIEW STATE ---
  const [viewProfileUser, setViewProfileUser] = useState(null); // The user object/email to view
  const [profileHighlightId, setProfileHighlightId] = useState(null); // ID to scroll to



  // Modals
  const [deleteModalItem, setDeleteModalItem] = useState(null);
  const [installTrigger, setInstallTrigger] = useState(0); // Trigger for Install Popup
  const { showInstallPrompt, isInstallAvailable } = useInstallPrompt();

  const inputClass = "w-full bg-[#202225] text-white border-2 border-transparent focus:border-[#003366] rounded-xl px-4 py-3 placeholder-gray-500 outline-none transition-all duration-200 shadow-inner text-base";

  // --- INITIALIZATION WITH REAL-TIME LISTENERS ---
  useEffect(() => {
    // URL PARAM HANDLING (Reset Password)
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) {
      setResetCode(oobCode);
      setIsForgot(true); // Reuse auth UI
    }

    const unsubscribe = authStateListener(async (u) => {
      setUser(u);
      if (u) {
        const profile = await getPublicProfile(u.email);
        setUserProfileData(profile);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // --- PASSWORD RESET DEEP LINK HANDLER ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      setView('reset_password');
      // We will store oobCode in a ref or state if needed, but for now just rendering the view
    }
  }, []);

  // --- REAL-TIME LISTINGS LISTENER ---
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = listenToListings((items) => {
      setListings(items);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- REAL-TIME REQUESTS LISTENER ---
  useEffect(() => {
    if (user) {
      // Re-subscribe when user changes to ensure we have latest permissions/data
      const unsubscribe = listenToRequests((reqs) => {
        setRequests(reqs);

        // --- LAZY CLEANUP: Physically delete expired requests ---
        // This ensures Backend Deletion without a dedicated server cron job.
        reqs.forEach(req => {
          if (req.expiresAt) {
            const expiry = req.expiresAt.toDate ? req.expiresAt.toDate() : new Date(req.expiresAt);
            if (expiry < new Date()) {
              // It is expired but still in DB. Delete it physically.
              console.log(`Lazy Deleting Expired Request: ${req.id}`);
              deleteRequest(req.id);
            }
          }
        });
      });

      return () => unsubscribe();
    } else {
      setRequests([]);
    }
  }, [user]); // Added user dependency to fix "requires refresh" issue

  // --- CHAT METADATA LISTENER (CRITICAL: Source of Truth for Usernames) ---
  useEffect(() => {
    if (user) {
      const unsubscribe = listenToUserChats(user.email, (chats) => {
        const metaMap = {};
        chats.forEach(chat => {
          metaMap[chat.chatId] = chat;
        });
        setChatMetadataMap(metaMap);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // --- CHAT REAL-TIME LISTENER WITH AUTO-SCROLL ---
  useEffect(() => {
    if (activeChat) {
      const unsubscribe = listenToMessages(activeChat.id, (msgs) => {
        setChatMessages(msgs);

        // Mark as read when messages load/update and we are in the chat
        // Check if there are unread messages from others (Case-Insenstive)
        const hasUnread = msgs.some(m => !m.read && m.sender.toLowerCase() !== user.email.toLowerCase());
        if (hasUnread) {
          markChatRead(activeChat.id, user.email);
        }

        // Immediate scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      });
      return () => unsubscribe();
    } else {
      setChatMessages([]);
    }
  }, [activeChat, user]);

  // --- INBOX LISTENER WITH UNREAD DETECTION ---
  // --- INBOX LISTENER WITH UNREAD DETECTION ---
  useEffect(() => {
    if (user) {
      const unsubscribe = listenToAllMessages((msgs) => {
        // Step 1: Group messages FIRST by chatId
        const allGroups = msgs.reduce((acc, m) => {
          if (!acc[m.chatId]) acc[m.chatId] = [];
          acc[m.chatId].push(m);
          return acc;
        }, {});

        // Step 2: Filter GROUPS based on relevance
        const relevantGroups = {};
        Object.keys(allGroups).forEach(chatId => {
          const groupMsgs = allGroups[chatId];
          const isSeller = listings.find(l => l.id === chatId)?.seller === user.email;
          const isRequester = requests.find(r => r.id === chatId)?.user === user.email;
          // IMPORTANT FIX: Also include if I have sent ANY message in this chat (Participant)
          // This allows "Buyers" (who are not sellers/requesters) to see the chat and replies
          const hasParticipated = groupMsgs.some(m => m.sender === user.email);

          // ✅ METADATA FIX: Specific check for Direct Messages (Source of Truth)
          // If I am listed as a participant in the metadata, I MUST see this chat.
          const isParticipantInMetadata = chatMetadataMap[chatId]?.participants?.some(p => p.email === user.email);

          // ✅ DELETION CHECK (WhatsApp Style)
          const isDeletedByMe = chatMetadataMap[chatId]?.deletedBy?.includes(user.email);

          if ((isSeller || isRequester || hasParticipated || isParticipantInMetadata) && !isDeletedByMe) {
            relevantGroups[chatId] = groupMsgs;
          }
        });

        // Step 3: Set State
        setInboxGroups(relevantGroups);

        // Step 4: Calculate unread counts on RELEVANT chats
        const unreadCounts = {};

        Object.keys(relevantGroups).forEach(chatId => {
          const chatMsgs = relevantGroups[chatId];
          // CRITICAL FIX: Only count unread messages sent by OTHERS (not self), Case-Insensitive
          const unreadCount = chatMsgs.filter(m => !m.read && m.sender.toLowerCase() !== user.email.toLowerCase()).length;
          if (unreadCount > 0) {
            unreadCounts[chatId] = unreadCount;
          }
        });

        setUnreadChats(unreadCounts);
        setHasUnread(Object.keys(unreadCounts).length > 0);
      });
      return () => unsubscribe();
    }
  }, [user, listings, requests, chatMetadataMap]);
  // --- APP BADGING (UNREAD COUNT ON ICON) ---
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      const totalUnread = Object.values(unreadChats).reduce((a, b) => a + b, 0);
      if (totalUnread > 0) {
        navigator.setAppBadge(totalUnread).catch(e => console.error(e));
      } else {
        navigator.clearAppBadge().catch(e => console.error(e));
      }
    }
  }, [unreadChats]);

  // --- CONTACT NAME RESOLUTION REMOVED ---
  // This is now redundant because chat metadata provides usernames directly
  // The contactNames cache is kept for backward compatibility but not actively populated


  // --- FILTER LOGIC (3-Factor) ---
  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      // SEARCH LOGIC
      let matchesSearch = true;
      if (marketSearchMode === 'product') {
        matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      } else {
        // User Search: Match Seller Name
        matchesSearch = item.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      }

      let matchesCondition = true;
      if (activeCondition === 'New') matchesCondition = item.condition === 'New';
      if (activeCondition === 'Used') matchesCondition = item.condition !== 'New';

      let matchesType = true;
      if (activeType === 'Buy') matchesType = item.type === 'SELL';
      if (activeType === 'Rental') matchesType = item.type === 'RENT';

      let matchesCategory = true;
      if (activeCategory !== 'All') matchesCategory = item.category === activeCategory;

      return matchesSearch && matchesCondition && matchesType && matchesCategory;
    });
  }, [listings, searchQuery, activeCondition, activeType, activeCategory, marketSearchMode]);

  // --- PROFILE NAVIGATION HANDLER ---
  const handleViewProfile = async (target, highlightId = null) => {
    let profileData = target;
    // If target is just email string
    if (typeof target === 'string') {
      const email = target;
      // Check if it's me
      if (user && email === user.email) {
        profileData = user;
      } else {
        // Fetch public profile
        setIsLoading(true);
        try {
          const fetched = await getUserProfile(email);
          if (fetched) {
            profileData = fetched;
          } else {
            // Fallback: Check listings if DB fetch fails/empty
            const found = listings.find(l => l.seller === email);
            if (found) {
              profileData = { email: found.seller, displayName: found.sellerName, photoURL: null };
            } else {
              // Last Resort: Username-like fallback (never show raw email)
              profileData = { email, displayName: email.split('@')[0], photoURL: null };
            }
          }
        } catch (e) {
          console.error("Profile fetch error", e);
          profileData = { email, displayName: "User", photoURL: null };
        }
        setIsLoading(false);
      }
    }

    setViewProfileUser(profileData);
    setProfileHighlightId(highlightId);
    setView('profile');
    setIsEditingProfile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- AUTO SCROLL EFFECT (MOVED TO TOP LEVEL) ---
  useEffect(() => {
    if (view === 'profile' && profileHighlightId) {
      // Need a slight delay for render
      setTimeout(() => {
        const el = document.getElementById(profileHighlightId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [view, profileHighlightId, viewProfileUser]);

  // --- USER SEARCH: DEFAULT FETCH (MOVED TO TOP LEVEL) ---
  useEffect(() => {
    if (marketSearchMode === 'user' && !searchQuery.trim()) {
      getAllUsers().then(users => {
        if (user) users = users.filter(u => u.email !== user.email);
        setUserSearchResults(users);
      });
    }
  }, [marketSearchMode, searchQuery, user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isLogin) {
        await loginWithUsername(username, password);
      } else {
        if (!acceptedTerms) throw new Error("Please accept the Terms of Service.");

        // Strict Validation using Shared Logic
        try {
          validatePassword(password);
        } catch (e) {
          throw new Error("Password invalid: " + e.message);
        }

        let photoURL = `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=003366`;
        if (profilePic) photoURL = await uploadImageToCloudinary(profilePic);
        await signUpUser(email, password, { username, name, whatsapp: phone, department, photoURL });
        await resendVerificationLink();
        alert("Account Created! Check your email.");
      }
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };



  const handlePostItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrls = [];
      let mainImage = "https://via.placeholder.com/400?text=No+Image";

      // Upload multiple images
      if (productImages.length > 0) {
        // Upload all images in parallel
        const uploadPromises = Array.from(productImages).map(file => uploadImageToCloudinary(file));
        imageUrls = await Promise.all(uploadPromises);
        mainImage = imageUrls[0];
      } else if (imageFile) {
        // Fallback for single image state if used
        mainImage = await uploadImageToCloudinary(imageFile);
        imageUrls = [mainImage];
      }

      await createListing({
        name: itemName, price: Number(itemPrice), description: itemDesc,
        type: listingType, condition: condition, category: category,
        rentalPeriod: listingType === 'RENT' ? rentalPeriod : null, // RENTAL FIELD
        rentalStatus: listingType === 'RENT' ? 'Available' : null, // RENTAL FIELD
        image: mainImage, // Main image for card view backward compatibility
        images: imageUrls, // Array for valid multiple images
        seller: user.email, sellerName: user.displayName || "NUST Student",
        sellerDept: department, sellerReputation: 5.0
      });
      // No need to manually refresh - real-time listener will update
      setView('market');
      setItemName(''); setItemPrice(''); setImageFile(null); setProductImages([]); setItemDesc('');
      setInstallTrigger(Date.now()); // Trigger Install Prompt
    } catch (err) { alert(err.message); }
    finally { setIsUploading(false); }
  };

  const handleDeleteDecision = async (decision) => {
    if (!deleteModalItem) return;
    try {
      if (decision === 'delete') {
        await deleteListing(deleteModalItem);
        setListings(prev => prev.filter(i => i.id !== deleteModalItem));
      } else if (decision === 'sold') {
        await markListingSold(deleteModalItem);
      }
    } catch (err) { alert(err.message); }
    finally { setDeleteModalItem(null); }
  };

  const handleUpdateRental = async () => {
    if (!rentalModalItem) return;
    try {
      let updates = { rentalStatus: 'Available', rentedUntil: null };
      if (newRentalDate) {
        updates = { rentalStatus: 'Rented', rentedUntil: new Date(newRentalDate) };
      }
      await updateListing(rentalModalItem.id, updates);
      setRentalModalItem(null); setNewRentalDate('');
      alert("Rental status updated!");
    } catch (e) { alert(e.message); }
  };


  const handlePostRequest = async (e) => {
    e.preventDefault();
    if (!reqTitle.trim() || isPostingReq) return;
    setIsPostingReq(true);
    try {
      let expiresAt = null;
      if (isAutoDeleteEnabled) {
        if (expiryMode === 'duration') {
          // Calculate FUTURE date based on Duration
          const unitMultipliers = {
            'hours': 60 * 60 * 1000,
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000
          };
          expiresAt = new Date(Date.now() + (Number(expiryVal) * unitMultipliers[expiryUnit]));
        } else if (expiryMode === 'date' && expiryDate) {
          expiresAt = new Date(expiryDate);
        } else {
          // Fallback default 24h if something is weird
          expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
      }

      await createRequest({
        title: reqTitle, text: reqDesc, user: user.email,
        userName: user.displayName, isMarketRun, isUrgent: isRequestUrgent,
        category: reqCategory, // Added Category
        expiresAt: expiresAt // Store as timestamp object
      });
      // Reset Form
      setReqTitle(''); setReqDesc(''); setIsRequestUrgent(false);
      setExpiryVal(24); setExpiryUnit('hours'); setExpiryDate(''); setIsAutoDeleteEnabled(false);
      setInstallTrigger(Date.now()); // Trigger Install Prompt
    } catch (err) { alert(err.message); }
    finally { setIsPostingReq(false); }
  };

  const handleEditRequest = async (e) => {
    e.preventDefault();
    if (!editingReq || !editReqText.trim()) return;
    try {
      await updateRequest(editingReq.id, { text: editReqText });
      setEditingReq(null);
      setEditReqText('');
    } catch (err) { alert(err.message); }
  };

  const startEditRequest = (req) => {
    setEditingReq(req);
    setEditReqText(req.text);
  };

  const handleDeleteRequest = async (id) => {
    if (window.confirm("Remove this post from the board?")) {
      await deleteRequest(id);
      // No need to manually refresh - real-time listener will update
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      let newPhotoURL = user.photoURL;
      if (editPic) newPhotoURL = await uploadImageToCloudinary(editPic);
      const updatedData = {
        username: editName || user.displayName,
        whatsapp: editPhone || userProfileData.whatsapp,
        department: editDept || userProfileData.department,
        photoURL: newPhotoURL
      };

      // Validate Password if changing
      if (editPassword) {
        try {
          validatePassword(editPassword);
        } catch (e) {
          throw new Error("New password invalid: " + e.message);
        }
      }

      await updateUserProfile(user.uid, updatedData, editPassword);
      setIsEditingProfile(false);
      alert("Profile Updated!");
      window.location.reload();
    } catch (err) { alert("Update failed: " + err.message); }
  };

  const openEditProfile = () => {
    setEditName(user.displayName);
    setEditPhone(userProfileData?.whatsapp || '');
    setEditDept(userProfileData?.department || 'SEECS');
    setIsEditingProfile(true);
  };

  const handleDeleteChat = async (chatId) => {
    if (window.confirm("Delete this conversation?")) {
      await deleteChat(chatId, user.email);
      setInboxGroups(prev => { const n = { ...prev }; delete n[chatId]; return n; });
    }
  };

  const handleRequestClick = (req) => {
    if (req.user !== user.email) {
      const chatId = req.id;

      // ✅ CREATE CHAT METADATA WITH USERNAMES (NO EMAIL FALLBACKS)
      const chatMetadata = {
        chatId,
        type: 'request',
        sourceId: req.id,
        sourceName: req.title,
        participants: [
          {
            email: req.user,
            username: req.userName || "Requester",  // ✅ From request
            role: 'requester'
          },
          {
            email: user.email,
            username: user.displayName || "User",  // ✅ From current user
            role: 'responder'
          }
        ]
      };

      setActiveChat({
        id: chatId,
        name: req.isMarketRun ? `Run: ${req.title}` : `Req: ${req.title}`,
        seller: req.user,
        metadata: chatMetadata
      });
    }
  };



  const handleListingClick = (item) => {
    // ✅ CHECK FOR EXISTING METADATA (DIRECT MESSAGES)
    // If metadata is already provided (e.g. from User Search or Profile), use it directly.
    // This prevents overwriting sourceName with item.name (which is undefined for users)
    // and prevents re-generating the wrong chatId.
    if (item.metadata) {
      setActiveChat({
        id: item.metadata.chatId, // Use the ID from metadata (e.g. email_email)
        ...item, // Keep other props if any
        metadata: item.metadata
      });
      markChatRead(item.metadata.chatId, user.email);
      return;
    }

    // --- DEFAULT: LISTING CHAT FALLBACK ---
    const chatId = `${item.id}_${user.email}`;

    // ✅ CREATE CHAT METADATA WITH USERNAMES (NO EMAIL FALLBACKS)
    const chatMetadata = {
      chatId,
      type: 'listing',
      sourceId: item.id,
      sourceName: item.name,
      participants: [
        {
          email: item.seller,
          username: item.sellerName || "Seller",  // ✅ From listing
          role: 'seller'
        },
        {
          email: user.email,
          username: user.displayName || "User",  // ✅ From current user
          role: 'buyer'
        }
      ]
    };

    setActiveChat({ ...item, metadata: chatMetadata });
    markChatRead(chatId, user.email);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || isSendingMsg) return;
    setIsSendingMsg(true);
    try {
      // ✅ Pass chat metadata to ensure usernames are stored before first message
      await sendMessage(activeChat.id, user.email, newMsg, activeChat.metadata);
      setNewMsg('');
      setInstallTrigger(Date.now()); // Trigger Install Prompt
    } catch (err) {
      console.error("Send message error:", err);
      alert("Failed to send message. Please try again.");
    }
    finally { setIsSendingMsg(false); }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    // User requested "Time when he uploaded it". 
    // Format: "Jan 15, 10:30 PM"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ", " +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-[#202225] rounded-2xl p-4 animate-pulse border border-white/5">
          <div className="h-40 bg-white/10 rounded-xl mb-4"></div>
          <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );

  if (isAuthChecking) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );

  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="relative min-h-screen bg-[#050505] overflow-hidden flex items-center justify-center p-4">
        {/* Auth UI */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#003366] rounded-full blur-[120px] opacity-40 animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#3b82f6] rounded-full blur-[120px] opacity-30 animate-float-delayed"></div>

        {/* TERMS MODAL OVERLAY - Moved to Fixed Position */}
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#1a1c22] w-full max-w-lg max-h-[90vh] rounded-3xl p-6 flex flex-col shadow-2xl border border-white/10 animate-scale-up">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="text-blue-500" /> Terms & Conditions
                </h3>
                <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} className="text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="overflow-y-auto space-y-4 pr-2 text-sm text-gray-300 custom-scrollbar shrink">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <h4 className="font-bold text-white mb-1 text-xs uppercase text-blue-400">You Deal Yourself</h4>
                  <p>Buyers and sellers will both be from NUST. This platform's service is only to connect them. They will have to communicate and trade on their own. This platform is not responsible for payments, exchanges, or disputes.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <h4 className="font-bold text-white mb-1 text-xs uppercase text-green-400">Privacy</h4>
                  <p>Your profile (except Whatsapp no.) will be visible to other students you interact with. We don’t share your info outside the platform.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <h4 className="font-bold text-white mb-1 text-xs uppercase text-yellow-400">No Spam or Fake Posts</h4>
                  <p>Only real listings. No duplicate, misleading, or inappropriate content.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <h4 className="font-bold text-white mb-1 text-xs uppercase text-red-400">No Liability</h4>
                  <p>We provide the platform only. We do NOT guarantee items, quality, or successful trades.</p>
                </div>
              </div>
              <button onClick={() => setShowTermsModal(false)} className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shrink-0">
                I Understand
              </button>
            </div>
          </div>
        )}
        <div className="glass w-full max-w-md rounded-3xl p-8 relative z-10 border-t border-white/20 shadow-2xl animate-slide-up">


          <div className="text-center mb-8">
            <div className="mb-0 animate-float">
              {/* Logo is transparent PNG - Increased size */}
              <img src="/logo.png" className="w-32 h-32 object-contain mx-auto" alt="Logo" />
            </div>
            <h1 className="text-7xl font-bold bg-gradient-to-r from-sky-300 via-cyan-400 to-blue-600 bg-clip-text text-transparent tracking-wider mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>MHENZO</h1>
            <p className="text-gray-400 text-sm tracking-[0.2em] uppercase font-semibold">The NUST Exclusive Marketplace</p>
          </div>
          {user ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl">
                <Clock className="mx-auto text-yellow-500 mb-2 animate-pulse" />
                <h3 className="text-yellow-100 font-bold">Verification Pending</h3>
                <p className="text-xs text-yellow-500/80 mt-1">We sent a link to {user.email} (Check Spam Folder)</p>
              </div>
              <p className="text-xs text-green-400 animate-pulse">Waiting for verification... (Auto-updates)</p>
              <button onClick={() => resendVerificationLink()} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all">Resend Link</button>
              <button onClick={logoutUser} className="text-sm text-gray-500 hover:text-white">Sign Out</button>
            </div>
          ) : isForgot ? (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white">{resetCode ? "Set New Password" : "Reset Password"}</h2>
                <p className="text-sm text-gray-400">{resetCode ? "Enter your new strong password below." : "Enter your email to receive a reset link."}</p>
              </div>

              {resetCode ? (
                // --- RESET PASSWORD FORM (With Code) ---
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    validatePassword(newResetPassword);
                    await confirmReset(resetCode, newResetPassword);
                    alert("Password Reset Successful! You can now login.");
                    setIsForgot(false);
                    setResetCode(null);
                    window.location.href = window.location.origin; // Clear URL
                  } catch (err) {
                    alert(err.message);
                  }
                }} className="space-y-4">
                  <PasswordInput
                    value={newResetPassword}
                    onChange={e => setNewResetPassword(e.target.value)}
                    placeholder="New Strong Password"
                    onValidation={setIsResetPasswordValid}
                  />
                  <button
                    disabled={!isResetPasswordValid}
                    className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Change Password
                  </button>
                  <button type="button" onClick={() => { setIsForgot(false); setResetCode(null); }} className="w-full text-sm text-gray-400 hover:text-white">Cancel</button>
                </form>
              ) : (
                // --- SEND EMAIL FORM ---
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await resetPassword(email);
                  } catch (err) { console.error("Reset Password Error:", err); }
                  alert("If an account exists with this email, a reset link has been sent.");
                  setIsForgot(false);
                }} className="space-y-4">
                  <input className={inputClass} type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
                  <button className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg">Send Link</button>
                  <button type="button" onClick={() => setIsForgot(false)} className="w-full text-sm text-gray-400 hover:text-white">Back to Login</button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="flex justify-center mb-2">
                    <div className="relative group w-20 h-20 rounded-full bg-[#202225] flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-gray-600 hover:border-[#003366]">
                      <input type="file" onChange={e => setProfilePic(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {profilePic ? <img src={URL.createObjectURL(profilePic)} className="w-full h-full object-cover" alt="Profile Preview" /> : <Camera className="text-gray-500 group-hover:text-white" />}
                    </div>
                  </div>
                  <input className={inputClass} placeholder="Create Username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
                  <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Create Strong Password" autoComplete="new-password" />
                  <p className="text-[10px] text-gray-400 -mt-2 mb-2 flex items-center gap-1"><ShieldCheck size={10} /> Use a new password, NOT your NUST email password.</p>
                  <input className={inputClass} placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
                  <div>
                    <input className={inputClass} placeholder="WhatsApp (03...)" value={phone} onChange={e => setPhone(e.target.value)} required autoComplete="tel" />
                    <p className="text-[10px] text-gray-500 mt-1 ml-1 flex items-center gap-1"><ShieldCheck size={10} /> Your number won't be shared anywhere.</p>
                  </div>
                  <select className={inputClass} value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="SEECS">SEECS</option><option value="SMME">SMME</option><option value="NBS">NBS</option><option value="S3H">S3H</option><option value="SADA">SADA</option><option value="SCME">SCME</option>
                  </select>
                  <input className={inputClass} type="email" placeholder="NUST Email (std@nust.edu.pk)" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </>
              )}
              {isLogin && (
                <>
                  <input className={inputClass} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className={`${inputClass} pr-10`} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </>
              )}
              {!isLogin && (
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer mt-2 select-none">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => { setAcceptedTerms(e.target.checked); if (e.target.checked) setShowTermsModal(true); }} className="rounded border-gray-600 bg-transparent" />
                  <span>I agree to the <span className="text-blue-400 hover:underline" onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}>Terms</span> & <span className="text-blue-400 hover:underline" onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}>Privacy</span></span>
                </label>
              )}
              <button disabled={authLoading} className="w-full py-3.5 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait">
                {authLoading ? "Processing..." : (isLogin ? "Login" : "Sign Up")}
              </button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-white transition-colors">
                  {isLogin ? "New here? Sign Up" : "Have an account? Login"}
                </button>
                {isLogin && (
                  <div className="mt-2">
                    <button type="button" onClick={() => setIsForgot(true)} className="text-xs text-blue-400 hover:text-white transition-colors">Forgot Password?</button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div >
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#003366] rounded-full blur-[120px] opacity-40 animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#3b82f6] rounded-full blur-[120px] opacity-30 animate-float-delayed"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#003366]/20 to-transparent" />
      </div>
      <nav className="sticky top-0 z-50 glass border-b-0 border-b-white/5 bg-[#050505]/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('market')}>
            <img src="/logo.png" className="w-14 h-14 object-contain" alt="Logo" />
            <span className="font-bold text-3xl tracking-wide bg-gradient-to-r from-sky-300 via-cyan-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm" style={{ fontFamily: 'Rajdhani, sans-serif' }}>MHENZO</span>
          </div>
          <button onClick={logoutUser} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-red-400" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-4 space-y-6 relative z-10">

        {view === 'reset_password' && (
          <div className="flex items-center justify-center min-h-[60vh] animate-slide-up">
            <div className="glass-card p-8 rounded-3xl w-full max-w-md border border-white/20 relative overflow-hidden bg-[#1a1c22]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
              <p className="text-gray-400 text-sm mb-6">Enter a strong new password for your account.</p>

              <div className="space-y-4">
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="New Password" />
                <button onClick={async () => {
                  const code = new URLSearchParams(window.location.search).get('oobCode');
                  if (!code) return alert("Invalid or Expired Link");
                  try {
                    await confirmReset(code, password);
                    alert("Password Reset Successful! Please Login.");
                    // Clear params
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setView('market');
                    setIsLogin(true);
                    setPassword('');
                  } catch (e) { alert(e.message); }
                }} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all">
                  Set New Password
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'market' && (
          <div className="animate-slide-up space-y-5">
            <div className="flex gap-3">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder={marketSearchMode === 'product' ? "Search listings..." : "Search users..."}
                  className={`${inputClass} pl-11 pr-24`}
                  value={searchQuery}
                  onChange={async e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    // Filter Suggestions & Results
                    if (val.trim()) {
                      if (marketSearchMode === 'product') {
                        const suggestions = listings
                          .map(l => l.name)
                          .filter(n => n.toLowerCase().includes(val.toLowerCase()))
                          .slice(0, 5);
                        setSearchSuggestions([...new Set(suggestions)]); // Unique
                      } else {
                        // USER SEARCH MODE
                        // 1. Suggestions (Seller Names + DB Names)
                        const localSuggestions = listings
                          .map(l => l.sellerName)
                          .filter(n => n.toLowerCase().includes(val.toLowerCase()));

                        let dbUsers = [];
                        try {
                          // 2. Fetch Actual User Objects for Results
                          dbUsers = await searchUsersInDb(val);
                          // Filter out MYSELF
                          if (user) dbUsers = dbUsers.filter(u => u.email !== user.email);
                          setUserSearchResults(dbUsers);
                        } catch (err) { console.error(err); }

                        const dbNames = dbUsers.map(u => u.displayName || u.username);
                        const combined = [...new Set([...localSuggestions, ...dbNames])].slice(0, 5);
                        setSearchSuggestions(combined);
                      }
                    } else {
                      setSearchSuggestions([]);
                      setUserSearchResults([]);
                    }
                  }}
                />

                {/* MODE TOGGLE INSIDE SEARCH BAR */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 bg-[#1a1c22] p-1 rounded-lg border border-white/10">
                  <button onClick={() => setMarketSearchMode('product')} className={`p-1.5 rounded-md transition-all ${marketSearchMode === 'product' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`} title="Search Products"><ShoppingBag size={14} /></button>
                  <button onClick={() => setMarketSearchMode('user')} className={`p-1.5 rounded-md transition-all ${marketSearchMode === 'user' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`} title="Search Users"><User size={14} /></button>
                </div>
                {/* Search Suggestions Dropdown */}
                {searchSuggestions.length > 0 && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1c22] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {searchSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => { setSearchQuery(s); setSearchSuggestions([]); }}
                        className="px-4 py-3 hover:bg-white/5 cursor-pointer text-sm text-gray-300 hover:text-white flex items-center gap-2"
                      >
                        <Search size={14} className="opacity-50" /> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Install Button */}
              {isInstallAvailable && (
                <button onClick={showInstallPrompt} className="px-4 rounded-xl border border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center gap-2 transition-all" title="Install App">
                  <Download size={18} />
                  <span className="text-xs font-bold hidden sm:block">App</span>
                </button>
              )}

              <button onClick={() => setShowFilters(!showFilters)} className={`px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${showFilters ? 'bg-white text-black border-white' : 'bg-[#15161a] text-gray-400 border-white/10 hover:border-white/30'}`} title="Filter Options">
                <Sliders size={18} />
                <span className="text-xs font-bold hidden sm:block">Filters</span>
              </button>
            </div>

            {/* ADVANCED FILTER PANEL */}
            {showFilters && (
              <div className="glass-card p-4 rounded-2xl animate-fade-in space-y-4 border border-white/10">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Type</p>
                  <div className="flex gap-2">
                    {['All', 'Buy', 'Rental'].map(type => (
                      <button key={type} onClick={() => setActiveType(type)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeType === type ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'bg-[#15161a] text-gray-400'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Condition</p>
                  <div className="flex gap-2">
                    {['All', 'New', 'Used'].map(cond => (
                      <button key={cond} onClick={() => setActiveCondition(cond)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeCondition === cond ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'bg-[#15161a] text-gray-400'}`}>
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Category</p>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeCategory === cat ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' : 'bg-[#15161a] text-gray-400'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}



            {isLoading ? <LoadingSkeleton /> : (
              // CONDITIONAL RENDER: PRODUCTS OR USERS
              marketSearchMode === 'user' ? (
                // --- USER SEARCH RESULTS ---
                (() => {
                  let displayUsers = [];

                  if (searchQuery.trim() || userSearchResults.length > 0) {
                    // CASE 1: SEARCHING OR BROWSING (DB Results)
                    // If searchQuery is empty, userSearchResults has 'All Users' from useEffect
                    displayUsers = userSearchResults.map(u => ({
                      email: u.email,
                      name: u.displayName || u.username || "User",
                      dept: u.department || "NUSTian",
                      photoURL: u.photoURL,
                      count: u.reputation ? `${u.reputation} ⭐` : "New"
                    }));
                  } else {
                    // FALLBACK: If DB fetch hasn't finished or failed, show Loading or Empty
                    displayUsers = [];
                  }

                  if (displayUsers.length === 0) return <div className="text-center py-20 opacity-50 col-span-full"><Search size={48} className="mx-auto mb-2 text-gray-600" /><p>{searchQuery ? "No users found" : "No active sellers"}</p></div>;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayUsers.map(u => (
                        <div key={u.email} onClick={() => handleViewProfile(u.email)} className="glass-card p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 border border-white/5 transition-all group">
                          <div className="w-16 h-16 rounded-full bg-[#003366] flex items-center justify-center font-bold text-2xl text-white border-2 border-[#1a1c22] shadow-lg overflow-hidden">
                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" alt={u.name} /> : u.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-lg truncate group-hover:text-blue-400 transition-colors">{u.name}</h3>
                            <p className="text-xs text-gray-400">{u.dept} • {u.count}</p>
                          </div>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            // ✅ DIRECT MESSAGE: Create deterministic chat ID and metadata
                            const chatId = [user.email, u.email].sort().join('_');
                            const userName = u.name || u.displayName || u.username || u.email?.split('@')[0] || 'User';
                            const chatMetadata = {
                              chatId,
                              type: 'direct',
                              sourceName: `Chat with ${userName}`,
                              participants: [
                                {
                                  email: user.email,
                                  username: user.displayName || user.username || "User",
                                  role: 'user'
                                },
                                {
                                  email: u.email,
                                  username: userName,
                                  role: 'user'
                                }
                              ]
                            };
                            handleListingClick({ id: chatId, seller: u.email, sellerName: userName, metadata: chatMetadata });
                          }} className="p-3 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] rounded-full text-white transition-opacity shadow-lg shadow-blue-500/30" title="Message User">
                            <MessageCircle size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                // --- PRODUCT SEARCH RESULTS (Existing) ---
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredListings.map(item => (
                    <div key={item.id} onClick={() => setActiveProduct(item)} className="glass-card rounded-2xl overflow-hidden group hover:-translate-y-1 transition-transform duration-300 relative cursor-pointer">
                      {item.status === 'SOLD' && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/40 backdrop-blur-[2px] absolute inset-0"></div>
                          <div className="bg-red-500/80 text-white font-bold px-4 py-1 rounded-lg transform -rotate-12 border border-white/20 shadow-xl text-sm backdrop-blur-md">SOLD</div>
                        </div>
                      )}
                      <div className="relative h-48">
                        <img src={item.image} className="w-full h-full object-cover transition-transform duration-500" alt={item.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                        {/* FIXED TITLE WITH IMPROVED CONTRAST */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                          <div className="flex justify-between items-end gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-white text-lg leading-tight mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] line-clamp-2">
                                {item.name}
                              </h3>
                              <p className="text-xs text-white/90 flex items-center gap-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-medium">
                                <User size={12} /> {item.sellerName}
                              </p>
                            </div>
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold text-white border border-white/30 shadow-lg shrink-0 ${item.type === 'RENT' ? 'bg-orange-500/20 backdrop-blur-md' : 'bg-white/20 backdrop-blur-md'}`}>
                              {item.type === 'RENT' ? `Rs. ${item.price} / ${item.rentalPeriod || 'Week'}` : `Rs. ${item.price}`}
                            </span>
                          </div>
                        </div>
                        {item.isUrgent && <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse z-10"><Zap size={10} fill="white" /> URGENT</div>}
                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                          {item.type === 'RENT' && item.rentalStatus === 'Rented' && (
                            <div className="bg-orange-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                              <Clock size={10} /> Rented
                            </div>
                          )}
                          {item.type === 'RENT' && item.rentalStatus === 'Available' && (
                            <div className="bg-green-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                              Available for Rent
                            </div>
                          )}
                          <div className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">{item.condition}</div>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md">{item.category}</span>
                          <div onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Report this item?')) reportListing(item.id, 'User Report') }} className="text-gray-600 hover:text-red-500" title="Report Item"><Flag size={12} /></button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2 h-10 mb-3">{item.description}</p>
                        {item.seller !== user.email && item.status !== 'SOLD' && (
                          <button onClick={(e) => { e.stopPropagation(); handleListingClick(item); }} className="w-full py-2.5 rounded-xl bg-[#1a1c22] border border-white/5 hover:bg-[#003366] hover:text-white text-gray-400 text-sm font-medium transition-colors flex justify-center items-center gap-2" title="Message Seller">
                            <MessageCircle size={16} /> Chat Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            {!isLoading && filteredListings.length === 0 && <div className="text-center py-20 opacity-50"><Search size={48} className="mx-auto mb-2 text-gray-600" /><p>No listings found</p></div>}
          </div>
        )}

        {view === 'post' && (
          <div className="glass-card p-6 rounded-3xl animate-slide-up border-t border-white/20 bg-gradient-to-br from-[#1a1c22] to-[#0f1012] shadow-2xl relative overflow-hidden">
            {/* Sparky Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 mb-6 flex items-center gap-2 relative z-10"><Plus className="text-blue-500" /> List Item</h2>
            <form onSubmit={handlePostItem} className="space-y-5 relative z-10">

              {/* Image Upload */}
              <div className="relative w-full h-48 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-[#15161a] flex flex-col items-center justify-center cursor-pointer transition-colors group overflow-hidden shadow-inner">
                <input type="file" multiple onChange={e => {
                  const files = Array.from(e.target.files);
                  setProductImages(files);
                  // Preview first image for feedback
                  if (files.length > 0) setImageFile(files[0]);
                }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />

                {productImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 p-2 w-full h-full overflow-hidden">
                    {productImages.slice(0, 3).map((file, idx) => (
                      <img key={idx} src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded" alt={`Preview ${idx + 1}`} />
                    ))}
                    {productImages.length > 3 && <div className="flex items-center justify-center bg-black/50 text-white font-bold rounded">+{productImages.length - 3}</div>}
                  </div>
                ) : (
                  <div className="text-center group-hover:scale-105 transition-transform">
                    <Camera size={32} className="text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Tap to upload photos (Max 5)</p>
                  </div>
                )}
              </div>

              {/* Colorful Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex bg-[#15161a] p-1 rounded-xl border border-white/5">
                  {['SELL', 'RENT'].map(t => (
                    <button type="button" key={t} onClick={() => setListingType(t)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listingType === t ? (t === 'SELL' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg') : 'text-gray-500 hover:text-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex bg-[#15161a] p-1 rounded-xl border border-white/5">
                  {['Used', 'New'].map(c => (
                    <button type="button" key={c} onClick={() => setCondition(c)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${condition === c ? (c === 'New' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg') : 'text-gray-500 hover:text-white'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <input value={itemName} onChange={e => setItemName(e.target.value)} className={inputClass} placeholder="Title (e.g. Lab Coat)" />

              <div className="flex gap-3">
                <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputClass} flex-1`}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                </select>
                <div className="flex-1 flex gap-2">
                  <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className={`${inputClass} w-full`} placeholder={listingType === 'RENT' ? "Rent Price" : "Price (PKR)"} />
                  {listingType === 'RENT' && (
                    <select value={rentalPeriod} onChange={e => setRentalPeriod(e.target.value)} className={`${inputClass} w-24 px-1`}>
                      <option value="Day">/Day</option>
                      <option value="Week">/Week</option>
                      <option value="Month">/Mo</option>
                    </select>
                  )}
                </div>
              </div>

              <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className={`${inputClass} h-32 resize-none`} placeholder="Description..." />

              {/* Restored Gradient Button */}
              <button disabled={isUploading} className="w-full py-4 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-wait">
                {isUploading ? "Uploading..." : "Publish to Market"}
              </button>
            </form>
          </div>
        )}

        {view === 'requests' && (
          <div className="animate-slide-up space-y-6">
            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-yellow-500">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ClipboardList className="text-yellow-500" /> Community Board</h2>
              <form onSubmit={handlePostRequest} className="space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsMarketRun(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isMarketRun ? 'bg-yellow-500 text-black' : 'bg-[#15161a] text-gray-500'}`} title="Ask for something">I NEED ITEM</button>
                  <button type="button" onClick={() => setIsMarketRun(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isMarketRun ? 'bg-[#57F287] text-black' : 'bg-[#15161a] text-gray-500'}`} title="Offer a run">I'M GOING TO MARKET</button>
                </div>

                <div className="flex flex-col gap-2 bg-[#15161a] p-3 rounded-xl border border-white/5 transition-all">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Auto-Delete</p>
                      {/* TOGGLE SWITCH */}
                      <button type="button" onClick={() => setIsAutoDeleteEnabled(!isAutoDeleteEnabled)} className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative ${isAutoDeleteEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isAutoDeleteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {isAutoDeleteEnabled && (
                      <div className="flex gap-1 bg-black/40 rounded-lg p-0.5 animate-fade-in">
                        <button type="button" onClick={() => setExpiryMode('duration')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${expiryMode === 'duration' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Duration</button>
                        <button type="button" onClick={() => setExpiryMode('date')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${expiryMode === 'date' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Specific Date</button>
                      </div>
                    )}
                  </div>

                  {isAutoDeleteEnabled && (
                    <div className="animate-fade-in">
                      {expiryMode === 'duration' ? (
                        <div className="flex gap-2">
                          <input type="number" value={expiryVal} onChange={e => setExpiryVal(e.target.value)} className="bg-black/50 text-white text-xs p-2 rounded w-16 border border-white/10" placeholder="Val" />
                          <select value={expiryUnit} onChange={e => setExpiryUnit(e.target.value)} className="bg-black/50 text-white text-xs p-2 rounded flex-1 border border-white/10">
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                            <option value="weeks">Weeks</option>
                          </select>
                        </div>
                      ) : (
                        <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="bg-black/50 text-white text-xs p-2 rounded w-full border border-white/10" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input className={inputClass} placeholder={isMarketRun ? "Market Name / Location" : "Item Name"} value={reqTitle} onChange={e => setReqTitle(e.target.value)} />
                    {!isMarketRun && (
                      <select value={reqCategory} onChange={e => setReqCategory(e.target.value)} className={`${inputClass} w-1/3`}>
                        {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  <textarea className={`${inputClass} h-20 resize-none`} placeholder="More details..." value={reqDesc} onChange={e => setReqDesc(e.target.value)} />
                </div>

                <div className="flex justify-end items-center gap-2">
                  <button type="button" onClick={() => setIsRequestUrgent(!isRequestUrgent)} className={`px-4 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${isRequestUrgent ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-[#15161a] text-gray-500 border-white/5'}`} title="Mark as Urgent">
                    <Zap size={14} fill={isRequestUrgent ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold">URGENT</span>
                  </button>
                </div>

                <div className="flex justify-between items-center px-1">
                  {/* POST BUTTON MOVED HERE from old layout */}
                  <div />
                  <button disabled={isPostingReq} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2">
                    {isPostingReq ? <Clock size={18} className="animate-spin" /> : <><Send size={18} /> Post</>}
                  </button>
                </div>
              </form>
            </div>

            {/* COMMUNITY SEARCH & TABS */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <button onClick={() => setCommunityTab('wanted')} className={`flex-1 py-3 border-b-2 font-bold transition-all ${communityTab === 'wanted' ? 'text-yellow-500 border-yellow-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>Wanted Items</button>
                <button onClick={() => setCommunityTab('runs')} className={`flex-1 py-3 border-b-2 font-bold transition-all ${communityTab === 'runs' ? 'text-[#57F287] border-[#57F287]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>Market Runs</button>
              </div>

              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder={communityTab === 'wanted' ? "Search requests..." : "Search markets..."}
                  className={`${inputClass} pl-11`}
                  value={communitySearchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setCommunitySearchQuery(val);
                    if (val.trim()) {
                      const suggestions = requests
                        .filter(req => {
                          if (communityTab === 'wanted' && req.isMarketRun) return false;
                          if (communityTab === 'runs' && !req.isMarketRun) return false;
                          return true;
                        })
                        .map(req => req.title)
                        .filter(t => t.toLowerCase().includes(val.toLowerCase()))
                        .slice(0, 5);
                      setCommunitySearchSuggestions([...new Set(suggestions)]);
                    } else {
                      setCommunitySearchSuggestions([]);
                    }
                  }}
                />

                {/* Community Suggestions Dropdown */}
                {communitySearchSuggestions.length > 0 && communitySearchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1c22] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {communitySearchSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => { setCommunitySearchQuery(s); setCommunitySearchSuggestions([]); }}
                        className="px-4 py-3 hover:bg-white/5 cursor-pointer text-sm text-gray-300 hover:text-white flex items-center gap-2"
                      >
                        <Search size={14} className="opacity-50" /> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* COMMUNITY CATEGORY FILTERS (Wanted Only) */}
              {communityTab === 'wanted' && (
                <div className="flex gap-2 flex-wrap animate-fade-in">
                  {['All', ...CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCommunityCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeCommunityCategory === cat ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#15161a] text-gray-500 border-white/10 hover:border-white/30'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isLoading ? <LoadingSkeleton /> : (
              <div className="space-y-4 pb-20">
                {requests
                  .filter(req => {
                    // TAB FILTER
                    if (communityTab === 'wanted' && req.isMarketRun) return false;
                    if (communityTab === 'runs' && !req.isMarketRun) return false;

                    // SEARCH FILTER
                    const q = communitySearchQuery.toLowerCase();
                    const matchesText = (req.title?.toLowerCase() || "").includes(q) || (req.text?.toLowerCase() || "").includes(q);
                    const matchesCategory = !req.isMarketRun ? (req.category || "").toLowerCase().includes(q) : false;

                    // EXPIRY FILTER
                    if (!req.expiresAt) return matchesText || matchesCategory;
                    const expiry = req.expiresAt.toDate ? req.expiresAt.toDate() : new Date(req.expiresAt);
                    if (expiry < new Date()) return false;

                    return matchesText || matchesCategory;
                  })
                  .length === 0 ? <div className="text-center py-10 opacity-50"><ClipboardList size={48} className="mx-auto mb-2" /> <p>No posts found.</p></div> :
                  requests
                    .filter(req => {
                      if (communityTab === 'wanted' && req.isMarketRun) return false;
                      if (communityTab === 'runs' && !req.isMarketRun) return false;

                      // Double check expiry
                      if (req.expiresAt) {
                        const expiry = req.expiresAt.toDate ? req.expiresAt.toDate() : new Date(req.expiresAt);
                        if (expiry < new Date()) return false;
                      }

                      // CATEGORY FILTER
                      if (communityTab === 'wanted' && activeCommunityCategory !== 'All') {
                        if (req.category !== activeCommunityCategory) return false;
                      }

                      const q = communitySearchQuery.toLowerCase();
                      return (req.title?.toLowerCase() || "").includes(q) || (req.text?.toLowerCase() || "").includes(q) || (!req.isMarketRun && (req.category || "").toLowerCase().includes(q));
                    })
                    .map(req => (
                      <div key={req.id} onClick={() => handleRequestClick(req)} className="glass-card p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all group relative border border-white/5 shadow-md">
                        {/* Display Category Chips if Wanted */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-2">
                            <span className={`text-[10px] bg-black/50 px-2 py-1 rounded text-white flex items-center gap-1 border border-white/10`} onClick={(e) => { e.stopPropagation(); handleViewProfile(req.user, req.id); }}>
                              <User size={10} /> {req.userName}
                            </span>
                            {!req.isMarketRun && req.category && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/20">{req.category}</span>}
                          </div>
                        </div>

                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-lg ${req.isMarketRun ? 'text-[#57F287]' : 'text-yellow-500'}`}>
                            {req.isMarketRun ? "✈️ " + req.title : "📦 " + req.title}
                          </h3>
                          {req.isUrgent && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">URGENT</span>}
                        </div>

                        {editingReq && editingReq.id === req.id ? (
                          <div onClick={e => e.stopPropagation()} className="mt-2">
                            <textarea
                              value={editReqText}
                              onChange={e => setEditReqText(e.target.value)}
                              className="w-full bg-black/50 text-white rounded p-2 border border-white/20 text-sm"
                              rows="2"
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={handleEditRequest} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Save</button>
                              <button onClick={() => setEditingReq(null)} className="bg-gray-600 text-white px-3 py-1 rounded text-xs font-bold">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm mt-1">{req.text}</p>
                        )}

                        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                          <div className="flex flex-col items-end min-w-max ml-auto">
                            <span>{formatTime(req.createdAt)}</span>
                            {req.expiresAt && <span className="text-orange-400">• Exp: {formatTime(req.expiresAt)}</span>}
                          </div>
                        </div>

                        {req.user === user.email && !editingReq && (
                          <div className="flex flex-col gap-2 w-max">
                            <button onClick={(e) => { e.stopPropagation(); startEditRequest(req); }} className="text-gray-500 hover:text-blue-500 p-1" title="Edit Request"><Edit2 size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }} className="text-gray-500 hover:text-red-500 p-1" title="Delete Request"><Trash2 size={16} /></button>
                          </div>
                        )}

                        {req.user !== user.email && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex justify-end">
                            <button onClick={(e) => { e.stopPropagation(); handleRequestClick(req); }} className="text-xs bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-lg shadow-blue-500/20 transition-all">
                              <MessageCircle size={14} /> Chat
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
              </div>
            )}
          </div>
        )}

        {view === 'inbox' && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold">Messages</h2>
            {Object.keys(inboxGroups).length === 0 ? <p className="text-gray-500 text-center py-10">No messages yet.</p> :
              Object.keys(inboxGroups).map(id => {
                const msgs = inboxGroups[id];
                const lastMsgActual = msgs[0]; // Get last message (newest - query is DESC)

                // ✅ READ FROM CHAT METADATA (SINGLE SOURCE OF TRUTH)
                const chatMeta = chatMetadataMap[id];

                let displayName = "User";
                let productName = "Chat";
                let otherEmail = null;
                let isDirectChat = false;

                if (chatMeta) {
                  // ✅ Find the OTHER participant from metadata
                  const otherParticipant = chatMeta.participants?.find(p => p.email !== user.email);
                  if (otherParticipant) {
                    displayName = otherParticipant.username;  // ✅ NO EMAIL FALLBACK
                    otherEmail = otherParticipant.email;
                  }
                  productName = chatMeta.sourceName || "Chat";
                  if (chatMeta.type === 'direct') isDirectChat = true;
                } else {
                  // TEMPORARY FALLBACK: For chats created before migration
                  // This will only apply to old chats without metadata
                  const realId = id.split('_')[0];
                  const chatItem = listings.find(l => l.id === realId) || requests.find(r => r.id === realId);

                  if (chatItem) {
                    const ownerEmail = chatItem.seller || chatItem.user;
                    if (ownerEmail && ownerEmail !== user.email) {
                      displayName = chatItem.sellerName || chatItem.userName || "User";
                      otherEmail = ownerEmail;
                    }
                    productName = chatItem.name || chatItem.title || "Chat";
                  }
                }

                // ✅ FIX: If direct chat, ONLY show name. Else show Name (Item)
                const chatHeading = isDirectChat ? displayName : `${displayName} (${productName})`;
                const unreadCounts = unreadChats;

                return (
                  <div key={id} onClick={() => {
                    // Reconstruct chat object for setActiveChat
                    const realId = id.split('_')[0];
                    const chatItem = listings.find(l => l.id === realId) || requests.find(r => r.id === realId);
                    setActiveChat(chatItem ? { ...chatItem, metadata: chatMeta } : { id, name: chatHeading, metadata: chatMeta });
                  }} className="glass-card p-4 rounded-xl flex gap-4 cursor-pointer hover:bg-white/5 relative group" title="Open Chat">
                    <div className="relative">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (otherEmail) handleViewProfile(otherEmail);
                        }}
                        title="View Profile"
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${unreadCounts[id] ? 'bg-blue-600' : 'bg-blue-600/20'} overflow-hidden hover:scale-110 transition-transform cursor-pointer border-2 border-transparent hover:border-blue-400`}
                      >
                        <span className={`font-bold ${unreadCounts[id] ? 'text-white' : 'text-blue-400'}`}>{displayName[0]}</span>
                      </div>
                      {unreadCounts[id] > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full border-2 border-[#1a1c22] flex items-center justify-center text-[10px] font-bold text-white animate-bounce-short">{unreadCounts[id]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className={`font-bold truncate text-sm ${unreadCounts[id] ? 'text-white' : 'text-gray-300'}`}>{chatHeading}</h4>
                        <span className="text-[10px] text-gray-500">{formatTime(lastMsgActual?.createdAt || msgs[0].createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={`text-sm truncate max-w-[85%] ${unreadCounts[id] ? 'text-white font-medium' : 'text-gray-400'}`}>
                          {lastMsgActual?.sender === user.email && <span className="text-blue-400">You: </span>}
                          {lastMsgActual?.text || "Image"}
                        </p>
                        {unreadCounts[id] > 0 && (
                          <div className="min-w-[20px] h-5 px-1 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black ml-2">
                            {unreadCounts[id]}
                          </div>
                        )}

                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(id) }} className="absolute right-2 top-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Conversation">
                      <XCircle size={16} />
                    </button>
                  </div>
                );
              })
            }
          </div>
        )}

        {view === 'profile' && (
          <div className="glass-card p-4 sm:p-8 rounded-3xl text-center animate-slide-up relative overflow-hidden min-h-[80vh]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent" />

            {!viewProfileUser && user && setViewProfileUser(user)} {/* Default to self if null */}

            {/* HEADER SECTION */}
            <div className="relative z-10 mb-6">
              {/* Back Button if viewing others */}
              {viewProfileUser?.email !== user?.email && (
                <button onClick={() => setView('market')} className="absolute left-0 top-0 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <X size={20} />
                </button>
              )}

              {/* Edit Button if Me */}
              {viewProfileUser?.email === user?.email && !isEditingProfile && (
                <button onClick={openEditProfile} className="absolute right-0 top-0 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" title="Edit Profile">
                  <Edit2 size={16} />
                </button>
              )}

              <div className="w-24 h-24 mx-auto bg-[#003366] rounded-full flex items-center justify-center border-4 border-[#1a1c22] shadow-xl mb-4 overflow-hidden relative group">
                {isEditingProfile ? (
                  <div className="w-full h-full relative cursor-pointer">
                    <input type="file" onChange={e => setEditPic(e.target.files[0])} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />
                    {editPic ? <img src={URL.createObjectURL(editPic)} className="w-full h-full object-cover" alt="Preview" /> : <div className="flex items-center justify-center h-full bg-black/50"><Camera className="text-white" /></div>}
                  </div>
                ) : (
                  viewProfileUser?.photoURL ? <img src={viewProfileUser.photoURL} className="w-full h-full object-cover" alt="Profile" /> : <span className="text-3xl font-bold text-white">{(viewProfileUser?.displayName || "U")[0].toUpperCase()}</span>
                )}
              </div>

              {/* AUTO SCROLL EFFECT */}


              {isEditingProfile ? (
                <div className="max-w-xs mx-auto space-y-3">
                  <input className={inputClass} placeholder="Display Name" value={editName} onChange={e => setEditName(e.target.value)} />
                  <input className={inputClass} placeholder="WhatsApp (e.g. 0300...)" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  <PasswordInput value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="New Password (Optional)" />
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleUpdateProfile} className="flex-1 py-2 bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"><Save size={16} /> Save</button>
                    <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-2 bg-gray-700 rounded-xl font-bold text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white">{viewProfileUser?.displayName || viewProfileUser?.username || "User"}</h2>
                  {viewProfileUser?.email && <p className="text-gray-400 text-sm mt-1">{viewProfileUser.email}</p>}
                  {viewProfileUser?.department && <p className="text-blue-400 text-xs font-bold mt-1">{viewProfileUser.department}</p>}
                  <div className="flex justify-center gap-1 mt-2 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      // Placeholder for star rating logic
                      // <Star key={star} size={16} className={`text-yellow-400 ${star <= (viewProfileUser?.reputation || 0) ? 'fill-current' : ''}`} />
                      null
                    ))}
                  </div>
                  {/* Verification / Contact Actions */}
                  {viewProfileUser?.email !== user?.email && (
                    <div className="flex justify-center gap-3 mt-4">
                      <button onClick={() => {
                        // ✅ CREATE PROPER DIRECT MESSAGE CHAT WITH METADATA
                        const chatId = [user.email, viewProfileUser.email].sort().join('_');
                        const otherUserName = viewProfileUser?.displayName || viewProfileUser?.username || viewProfileUser?.email?.split('@')[0] || 'User';
                        const chatMetadata = {
                          chatId,
                          type: 'direct',
                          sourceName: `Chat with ${otherUserName}`,
                          participants: [
                            {
                              email: user.email,
                              username: user.displayName || user.username || "User",
                              role: 'user'
                            },
                            {
                              email: viewProfileUser.email,
                              username: otherUserName,
                              role: 'user'
                            }
                          ]
                        };
                        handleListingClick({
                          id: chatId,
                          seller: viewProfileUser.email,
                          sellerName: otherUserName,
                          metadata: chatMetadata
                        });
                      }} className="px-6 py-2 bg-[#252830] hover:bg-blue-600 rounded-full text-sm font-bold transition-all flex items-center gap-2 border border-white/10">
                        <MessageCircle size={16} /> Message
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CONTENT TABS */}
            {!isEditingProfile && (
              <div className="mt-8 text-left">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2 flex gap-4">
                  <span className="border-b-2 border-blue-500 pb-2">Listings & Requests</span>
                </h3>

                <div className="space-y-6">
                  {/* MARKETPLACE LISTINGS */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><ShoppingBag size={14} /> Marketplace</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {listings.filter(l => l.seller === viewProfileUser?.email).length === 0 ? <p className="text-gray-600 text-sm italic col-span-full">No active listings.</p> :
                        listings.filter(l => l.seller === viewProfileUser?.email).map(item => (
                          <div key={item.id} id={item.id} className={`bg-[#1a1c22] p-3 rounded-xl border border-white/5 flex gap-3 ${profileHighlightId === item.id ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}>
                            <img src={item.image} className="w-16 h-16 rounded-lg object-cover bg-black" alt={item.name} />
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-white text-sm truncate">{item.name}</h5>
                              <p className="text-green-400 text-xs font-bold mb-1">Rs. {item.price}</p>
                              <div className="flex justify-between items-center">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.status === 'SOLD' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{item.status}</span>
                                {/* Action Buttons if Owner */}
                                {user?.email === viewProfileUser?.email && (
                                  <div className="flex gap-2">
                                    {item.status !== 'SOLD' && <button onClick={() => setDeleteModalItem(item.id)} className="text-gray-500 hover:text-green-500" title="Mark Sold"><CheckCircle size={14} /></button>}
                                    <button onClick={() => setDeleteModalItem(item.id)} className="text-gray-500 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  {/* COMMUNITY REQUESTS */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><ClipboardList size={14} /> Community Requests</h4>
                    <div className="space-y-3">
                      {requests.filter(r => r.user === viewProfileUser?.email).length === 0 ? <p className="text-gray-600 text-sm italic">No active requests.</p> :
                        requests.filter(r => r.user === viewProfileUser?.email).map(req => (
                          <div key={req.id} id={req.id} className={`bg-[#1a1c22] p-4 rounded-xl border border-white/5 ${profileHighlightId === req.id ? 'ring-2 ring-yellow-500 bg-yellow-500/10' : ''}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded mb-1 inline-block ${req.isMarketRun ? 'bg-[#57F287]/20 text-[#57F287]' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                  {req.isMarketRun ? "Market Run" : "Wanted"}
                                </span>
                                <h4 className="font-bold text-white text-sm">{req.title}</h4>
                              </div>
                              <span className="text-[10px] text-gray-500">{formatTime(req.createdAt)}</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{req.description}</p>
                            {user?.email === viewProfileUser?.email && (
                              <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-white/5">
                                <button onClick={(e) => { e.stopPropagation(); startEditRequest(req); }} className="text-gray-500 hover:text-blue-500 text-xs flex items-center gap-1"><Edit2 size={12} /> Edit</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }} className="text-gray-500 hover:text-red-500 text-xs flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {
        activeProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden relative animate-slide-up my-auto max-h-[95vh] flex flex-col">
              <button onClick={() => setActiveProduct(null)} className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"><X size={20} /></button>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {/* Image Gallery */}
                <div className="h-72 sm:h-96 relative bg-black">
                  <img
                    src={activeProduct.selectedImage || activeProduct.image}
                    className="w-full h-full object-contain"
                    alt={activeProduct.name}
                  />
                  {/* Thumbnails if multiple */}
                  {activeProduct.images && activeProduct.images.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 p-2">
                      {activeProduct.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveProduct({ ...activeProduct, selectedImage: img })}
                          className={`w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${activeProduct.selectedImage === img || (!activeProduct.selectedImage && idx === 0) ? 'border-blue-500 scale-110' : 'border-white/20 opacity-70'}`}
                        >
                          <img src={img} className="w-full h-full object-cover" alt={`Thumbnail ${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* Seller Info Section (Profile View Clone) */}
                  <div className="flex items-center gap-4 p-4 bg-[#1a1c22] rounded-2xl border border-white/5">
                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xl text-white">
                      {activeProduct.sellerName?.[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{activeProduct.sellerName}</h3>
                      <p className="text-xs text-gray-400">{activeProduct.sellerDept || "NUSTian"} • Rep: {activeProduct.sellerReputation || 5.0} ⭐</p>
                    </div>
                    {/* OWNER CONTROLS FOR RENTAL */}
                    {user.email === activeProduct.seller && activeProduct.type === 'RENT' && (
                      <button onClick={() => setRentalModalItem(activeProduct)} className="px-3 py-1.5 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] rounded-lg text-xs font-bold text-white mr-2 shadow-lg">
                        Manage Rental
                      </button>
                    )}
                    {activeProduct.seller !== user.email && (
                      <button onClick={() => { setActiveProduct(null); handleListingClick(activeProduct); }} className="px-4 py-2 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-lg">
                        <MessageCircle size={16} /> Chat
                      </button>
                    )}
                  </div>

                  {/* Product Details */}
                  <div>
                    <div className="flex justify-between items-start">
                      <h2 className="text-3xl font-bold text-white mb-2">{activeProduct.name}</h2>
                      {activeProduct.status === 'SOLD' ? (
                        <span className="text-2xl font-bold text-red-500">SOLD</span>
                      ) : (
                        <span className="text-2xl font-bold text-green-400">Rs. {activeProduct.price}</span>
                      )}
                    </div>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">{activeProduct.condition}</span>
                      <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">{activeProduct.category}</span>
                      <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">{formatTime(activeProduct.createdAt)}</span>
                    </div>
                    <p className="text-gray-300 leading-relaxed text-sm">{activeProduct.description}</p>
                  </div>

                  <div className="border-t border-white/10 my-4" />

                  {/* Related Products */}
                  <div>
                    <h4 className="font-bold text-gray-400 mb-3 text-sm uppercase">Related Items</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {listings.filter(l => l.category === activeProduct.category && l.id !== activeProduct.id).slice(0, 5).map(rel => (
                        <div key={rel.id} onClick={() => setActiveProduct(rel)} className="min-w-[140px] bg-[#1a1c22] rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-blue-500/30 transition-all">
                          <div className="h-24"><img src={rel.image} className="w-full h-full object-cover" alt={rel.name} /></div>
                          <div className="p-2">
                            <p className="text-xs font-bold text-white truncate">{rel.name}</p>
                            <p className="text-[10px] text-gray-400">Rs. {rel.price}</p>
                          </div>
                        </div>
                      ))}
                      {listings.filter(l => l.category === activeProduct.category && l.id !== activeProduct.id).length === 0 && <p className="text-xs text-gray-600">No related items.</p>}
                    </div>
                  </div>

                  {/* Seller's Other Products */}
                  <div>
                    <h4 className="font-bold text-gray-400 mb-3 text-sm uppercase">More from {activeProduct.sellerName}</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {listings.filter(l => l.seller === activeProduct.seller && l.id !== activeProduct.id).slice(0, 5).map(rel => (
                        <div key={rel.id} onClick={() => setActiveProduct(rel)} className="min-w-[140px] bg-[#1a1c22] rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-blue-500/30 transition-all">
                          <div className="h-24"><img src={rel.image} className="w-full h-full object-cover" alt={rel.name} /></div>
                          <div className="p-2">
                            <p className="text-xs font-bold text-white truncate">{rel.name}</p>
                            <p className="text-[10px] text-gray-400">Rs. {rel.price}</p>
                          </div>
                        </div>
                      ))}
                      {listings.filter(l => l.seller === activeProduct.seller && l.id !== activeProduct.id).length === 0 && <p className="text-xs text-gray-600">No other items.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        activeChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md h-[80vh] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 bg-[#1a1c22] flex justify-between items-center border-b border-white/5">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    // Determine ID of the OTHER user
                    const isSeller = activeChat.seller === user.email;
                    const otherEmail = isSeller ? (
                      // If I am seller/owner, I need to find who I am talking to (Buyer)
                      // We can find this from the messages
                      chatMessages.find(m => m.sender !== user.email)?.sender
                    ) : activeChat.seller; // If I am buyer, seller is the other person

                    if (otherEmail) {
                      handleViewProfile(otherEmail, activeChat.id);
                      setActiveChat(null); // Close chat to view profile
                    }
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                    {/* ✅ READ INITIAL FROM METADATA */}
                    {(() => {
                      if (activeChat.metadata) {
                        const otherParticipant = activeChat.metadata.participants?.find(p => p.email !== user.email);
                        const name = otherParticipant?.username || "User";
                        return name[0].toUpperCase();
                      }
                      // TEMPORARY FALLBACK for old chats
                      const name = activeChat.sellerName || activeChat.userName || "User";
                      return name[0].toUpperCase();
                    })()}
                  </div>
                  <div>
                    {/* ✅ READ NAME FROM METADATA */}
                    <h3 className="font-bold text-sm">
                      {(() => {
                        let name = "User";
                        let topic = "Chat";

                        if (activeChat.metadata) {
                          // ✅ Use metadata (ALWAYS CORRECT)
                          const otherParticipant = activeChat.metadata.participants?.find(p => p.email !== user.email);
                          name = otherParticipant?.username || "User";
                          topic = activeChat.metadata.sourceName || activeChat.name || "Chat";
                        } else {
                          // TEMPORARY FALLBACK for old chats (before migration)
                          name = activeChat.sellerName || activeChat.userName || "User";
                          topic = activeChat.name || activeChat.title || "Chat";
                        }

                        return `${name} (${topic})`;
                      })()}
                    </h3>
                  </div>
                </div>
                <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/10 rounded-full" title="Close"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                )}
                {chatMessages.map(m => (
                  <div key={m.id} className={`flex ${m.sender.toLowerCase() === user.email.toLowerCase() ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm max-w-[80%] break-words ${m.sender.toLowerCase() === user.email.toLowerCase() ? 'bg-blue-600 text-white' : m.sender === 'System' ? 'bg-green-600/20 text-green-300 text-center' : 'bg-[#252830] text-gray-200'}`}>
                      {m.text}
                      <div className="text-[9px] opacity-70 text-right mt-1 flex justify-end items-center gap-1">
                        {formatTime(m.createdAt)}
                        {/* Green Ticks for Sent Messages */}
                        {m.sender.toLowerCase() === user.email.toLowerCase() && (
                          <CheckCheck size={14} className={m.read ? "text-green-500 font-bold" : "text-gray-500"} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="p-3 bg-[#15161a] flex gap-2 border-t border-white/5">
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)} className={`${inputClass} flex-1`} placeholder="Type a message..." />
                <button disabled={isSendingMsg} className="p-3 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] rounded-xl disabled:opacity-50 disabled:cursor-wait transition-colors" title="Send Message">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )
      }

      {
        deleteModalItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="bg-[#1a1c22] w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl animate-slide-up">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="text-red-500" size={32} /></div>
                <h3 className="text-xl font-bold text-white">Manage Listing</h3>
                <p className="text-gray-400 text-sm mt-1">What would you like to do?</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleDeleteDecision('SOLD')} className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2" title="Keep item but show as sold"><CheckCircle size={18} /> Mark as Sold</button>
                <button onClick={() => handleDeleteDecision('DELETE')} className="w-full py-3.5 rounded-xl bg-[#252830] hover:bg-red-500/20 hover:text-red-400 text-gray-400 font-bold border border-white/5" title="Remove completely">Permanently Delete</button>
                <button onClick={() => setDeleteModalItem(null)} className="w-full py-3 text-sm text-gray-500">Cancel</button>
              </div>
            </div>
          </div>
        )
      }

      <InstallPopup triggerAction={installTrigger} />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#15161a]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full flex gap-1 shadow-2xl z-40">
        <NavBtn icon={ShoppingBag} active={view === 'market'} onClick={() => setView('market')} title="Marketplace" />
        <NavBtn icon={Mail} active={view === 'inbox'} onClick={() => setView('inbox')} title="Inbox" hasUnread={hasUnread} />
        <NavBtn icon={Plus} active={view === 'post'} onClick={() => setView('post')} title="Sell Item" />
        <NavBtn icon={ClipboardList} active={view === 'requests'} onClick={() => setView('requests')} title="Community Board" />
        <NavBtn icon={User} active={view === 'profile'} onClick={() => {
          setViewProfileUser(user);  // ✅ Reset to current user
          setView('profile');
        }} title="My Profile" />
      </div>

      {/* RENTAL STATUS MODAL */}
      {
        rentalModalItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1c22] rounded-2xl p-6 w-full max-w-sm border border-white/10 space-y-4">
              <h3 className="text-xl font-bold text-white">Update Rental Status</h3>
              <p className="text-gray-400 text-sm">Is "{rentalModalItem.name}" currently rented out?</p>

              <div className="flex gap-2">
                <button onClick={() => setNewRentalDate('')} className={`flex-1 py-2 rounded-lg font-bold border ${!newRentalDate ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-white/10 text-gray-500'}`}>
                  Available
                </button>
                <button onClick={() => setNewRentalDate(new Date().toISOString().split('T')[0])} className={`flex-1 py-2 rounded-lg font-bold border ${newRentalDate ? 'bg-orange-500/20 border-orange-500 text-orange-500' : 'border-white/10 text-gray-500'}`}>
                  Rented
                </button>
              </div>

              {newRentalDate && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Rented Until:</p>
                  <input type="date" value={newRentalDate} onChange={e => setNewRentalDate(e.target.value)} className={inputClass} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleUpdateRental} className="flex-1 py-2 bg-blue-600 rounded-xl font-bold text-white">Save Update</button>
                <button onClick={() => { setRentalModalItem(null); setNewRentalDate(''); }} className="flex-1 py-2 bg-gray-700 rounded-xl font-bold text-white">Cancel</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

const NavBtn = ({ icon: Icon, active, onClick, title, hasUnread }) => (
  <button onClick={onClick} title={title} className={`p-3.5 rounded-full transition-all duration-300 relative ${active ? 'bg-gradient-to-tr from-[#003366] to-[#3b82f6] text-white shadow-lg -translate-y-2 scale-110' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
    <Icon size={20} />
    {hasUnread && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#15161a] animate-pulse"></span>}
  </button>
);