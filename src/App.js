import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag, Plus, LogOut, User, ClipboardList, Send,
  MessageCircle, X, Mail, Star, Camera, Eye, EyeOff,
  Search, Sliders, MapPin, AlertTriangle, ChevronRight, Check,
  Zap, Clock, Truck, Tag, ShieldCheck, Phone, Trash2, Flag, CheckCircle, AlertCircle, Edit2, Save, XCircle
} from 'lucide-react';
import {
  authStateListener, logoutUser, loginWithUsername, signUpUser,
  getListings, createListing, getRequests, createRequest, deleteRequest,
  resendVerificationLink, sendMessage, listenToMessages,
  listenToAllMessages, getPublicProfile, uploadImageToCloudinary, rateUser,
  deleteListing, markListingSold, reportListing, updateUserProfile, deleteChat,
  listenToListings, listenToRequests, markChatRead, updateRequest, updateListing, resetPassword
} from './firebaseFunctions';

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
  const [itemDesc, setItemDesc] = useState('');
  const [listingType, setListingType] = useState('SELL');
  const [condition, setCondition] = useState('Used');
  const [category, setCategory] = useState('Electronics');
  const [imageFile, setImageFile] = useState(null); // Keep for backward compat or single view
  const [productImages, setProductImages] = useState([]); // New: for multiple images
  const [isUploading, setIsUploading] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null); // New: for detailed product view

  // Request Input (Community Board)
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [isMarketRun, setIsMarketRun] = useState(false);
  const [isRequestUrgent, setIsRequestUrgent] = useState(false);
  const [reqExpiry, setReqExpiry] = useState(0); // 0 = No expiry, 1 = 1 hour, 24 = 24 hours
  const [isPostingReq, setIsPostingReq] = useState(false);

  // Edit Request State
  const [editingReq, setEditingReq] = useState(null);
  const [editReqText, setEditReqText] = useState('');

  // Modals
  const [deleteModalItem, setDeleteModalItem] = useState(null);

  const inputClass = "w-full bg-[#202225] text-white border-2 border-transparent focus:border-[#003366] rounded-xl px-4 py-3 placeholder-gray-500 outline-none transition-all duration-200 shadow-inner text-base";

  // --- INITIALIZATION WITH REAL-TIME LISTENERS ---
  useEffect(() => {
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
    // Re-subscribe when user changes to ensure we have latest permissions/data
    const unsubscribe = listenToRequests((reqs) => {
      setRequests(reqs);
    });

    return () => unsubscribe();
  }, [user]); // Added user dependency to fix "requires refresh" issue

  // --- CHAT REAL-TIME LISTENER WITH AUTO-SCROLL ---
  useEffect(() => {
    if (activeChat) {
      const unsubscribe = listenToMessages(activeChat.id, (msgs) => {
        setChatMessages(msgs);

        // Mark as read when messages load/update and we are in the chat
        // Check if there are unread messages from others
        const hasUnread = msgs.some(m => !m.read && m.sender !== user.email);
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
  }, [activeChat]);

  // --- INBOX LISTENER WITH UNREAD DETECTION ---
  useEffect(() => {
    if (user) {
      const unsubscribe = listenToAllMessages((msgs) => {
        // Filter messages based on user's relationship to listings and requests
        const myMsgs = msgs.filter(m => {
          const isSender = m.sender === user.email;
          const isSeller = listings.find(l => l.id === m.chatId)?.seller === user.email;
          const isRequester = requests.find(r => r.id === m.chatId)?.user === user.email;

          return isSender || isSeller || isRequester;
        });

        // Group messages by chat
        const groups = myMsgs.reduce((acc, m) => {
          if (!acc[m.chatId]) acc[m.chatId] = [];
          acc[m.chatId].push(m);
          return acc;
        }, {});

        setInboxGroups(groups);

        // Calculate unread messages counts per chat
        const unreadCounts = {};
        let totalUnread = 0;

        Object.keys(groups).forEach(chatId => {
          const chatMsgs = groups[chatId];
          // CRITICAL FIX: Only count unread messages sent by OTHERS (not self)
          const unreadCount = chatMsgs.filter(m => !m.read && m.sender !== user.email).length;
          if (unreadCount > 0) {
            unreadCounts[chatId] = unreadCount;
            totalUnread += 1;
          }
        });

        setUnreadChats(unreadCounts);
        setHasUnread(Object.keys(unreadCounts).length > 0);
      });
      return () => unsubscribe();
    }
  }, [user, listings, requests]);

  // --- FILTER LOGIC (3-Factor) ---
  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());

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
  }, [listings, searchQuery, activeCondition, activeType, activeCategory]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isLogin) {
        await loginWithUsername(username, password);
      } else {
        if (!acceptedTerms) throw new Error("Please accept the Terms of Service.");

        // Strong Password Check
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).+$/;
        if (!passwordRegex.test(password)) {
          throw new Error("Password must contain at least 1 Capital Letter and 1 Number.");
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

  const handleForgotPassword = async () => {
    const resetEmail = prompt("Enter your email to reset password:");
    if (resetEmail) {
      try {
        await resetPassword(resetEmail);
        alert("Password reset link sent to " + resetEmail);
      } catch (err) {
        alert("Error: " + err.message);
      }
    }
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
        image: mainImage, // Main image for card view backward compatibility
        images: imageUrls, // Array for valid multiple images
        seller: user.email, sellerName: user.displayName || "NUST Student",
        sellerDept: department, sellerReputation: 5.0
      });
      // No need to manually refresh - real-time listener will update
      setView('market');
      setItemName(''); setItemPrice(''); setImageFile(null); setProductImages([]); setItemDesc('');
    } catch (err) { alert(err.message); }
    finally { setIsUploading(false); }
  };

  const handleDeleteDecision = async (decision) => {
    if (!deleteModalItem) return;
    try {
      if (decision === 'SOLD') { await markListingSold(deleteModalItem); }
      else if (decision === 'DELETE') { await deleteListing(deleteModalItem); }
      // No need to manually refresh - real-time listener will update
      setDeleteModalItem(null);
    } catch (err) { alert(err.message); }
  };

  const handlePostRequest = async (e) => {
    e.preventDefault();
    if (!reqTitle.trim() || isPostingReq) return;
    setIsPostingReq(true);
    try {
      let expiresAt = null;
      if (reqExpiry > 0) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + Number(reqExpiry));
      }

      await createRequest({
        title: reqTitle, text: reqDesc, user: user.email,
        userName: user.displayName, isMarketRun, isUrgent: isRequestUrgent,
        expiresAt: expiresAt ? expiresAt : null // Store as timestamp
      });
      // No need to manually refresh - real-time listener will update
      setReqTitle(''); setReqDesc(''); setIsRequestUrgent(false); setReqExpiry(0);
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
      await deleteChat(chatId);
      setInboxGroups(prev => { const n = { ...prev }; delete n[chatId]; return n; });
    }
  };

  const handleRequestClick = (req) => {
    if (req.user !== user.email) {
      setActiveChat({
        id: req.id, name: req.isMarketRun ? `Run: ${req.title}` : `Req: ${req.title}`, seller: req.user
      });
      // Mark as read is handled in useEffect of activeChat
    }
  };

  const handleListingClick = (item) => {
    setActiveChat(item);
    // Mark as read immediately when opening
    markChatRead(item.id, user.email);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || isSendingMsg) return;
    setIsSendingMsg(true);
    try {
      await sendMessage(activeChat.id, user.email, newMsg);
      // REMOVED: Automatic "Notification sent to WhatsApp" message
      setNewMsg('');
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
        <div className="glass w-full max-w-md rounded-3xl p-8 relative z-10 border-t border-white/20 shadow-2xl animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#003366] to-[#2563eb] shadow-lg shadow-blue-500/30 mb-4 animate-float">
              <ShoppingBag className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-1">Samaan Share</h1>
            <p className="text-blue-300/80 text-sm">The NUST Exclusive Marketplace</p>
          </div>
          {user ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl">
                <Clock className="mx-auto text-yellow-500 mb-2 animate-pulse" />
                <h3 className="text-yellow-100 font-bold">Verification Pending</h3>
                <p className="text-xs text-yellow-500/80 mt-1">We sent a link to {user.email}</p>
              </div>
              <button onClick={() => resendVerificationLink()} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all">Resend Link</button>
              <button onClick={logoutUser} className="text-sm text-gray-500 hover:text-white">Sign Out</button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="flex justify-center mb-2">
                    <div className="relative group w-20 h-20 rounded-full bg-[#202225] flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-gray-600 hover:border-[#003366]">
                      <input type="file" onChange={e => setProfilePic(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {profilePic ? <img src={URL.createObjectURL(profilePic)} className="w-full h-full object-cover" /> : <Camera className="text-gray-500 group-hover:text-white" />}
                    </div>
                  </div>
                  <input className={inputClass} placeholder="Create Username" value={username} onChange={e => setUsername(e.target.value)} required />
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className={`${inputClass} pr-10`} placeholder="Create Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 -mt-2 mb-2 flex items-center gap-1"><ShieldCheck size={10} /> Use a new password, NOT your NUST email password.</p>
                  <input className={inputClass} placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                  <input className={inputClass} placeholder="WhatsApp (03...)" value={phone} onChange={e => setPhone(e.target.value)} required />
                  <select className={inputClass} value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="SEECS">SEECS</option><option value="SMME">SMME</option><option value="NBS">NBS</option><option value="S3H">S3H</option><option value="SADA">SADA</option><option value="SCME">SCME</option>
                  </select>
                  <input className={inputClass} type="email" placeholder="NUST Email (std@nust.edu.pk)" value={email} onChange={e => setEmail(e.target.value)} required />
                </>
              )}
              {isLogin && (
                <>
                  <input className={inputClass} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className={`${inputClass} pr-10`} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </>
              )}
              {!isLogin && (
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer mt-2">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="rounded border-gray-600 bg-transparent" />
                  <span>I agree to the <span className="text-blue-400">Terms</span> & <span className="text-blue-400">Privacy</span></span>
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
                    <button type="button" onClick={handleForgotPassword} className="text-xs text-blue-400 hover:text-white transition-colors">Forgot Password?</button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 relative">
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#003366]/20 to-transparent pointer-events-none" />
      <nav className="sticky top-0 z-50 glass border-b-0 border-b-white/5 bg-[#050505]/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('market')}>
            <div className="bg-gradient-to-tr from-[#003366] to-[#3b82f6] p-1.5 rounded-lg">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">SAMAAN SHARE</span>
          </div>
          <button onClick={logoutUser} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-red-400" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-4 space-y-6 relative z-10">

        {view === 'market' && (
          <div className="animate-slide-up space-y-5">
            <div className="flex gap-3">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search listings..."
                  className={`${inputClass} pl-11`}
                  value={searchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    // Filter Suggestions
                    if (val.trim()) {
                      const suggestions = listings
                        .map(l => l.name)
                        .filter(n => n.toLowerCase().includes(val.toLowerCase()))
                        .slice(0, 5); // Limit to 5
                      setSearchSuggestions([...new Set(suggestions)]); // Unique
                    } else {
                      setSearchSuggestions([]);
                    }
                  }}
                />
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
                    {['All', 'Electronics', 'Study Material', 'Others'].map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeCategory === cat ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' : 'bg-[#15161a] text-gray-400'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isLoading ? <LoadingSkeleton /> : (
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
                          <span className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-bold text-white border border-white/30 shadow-lg shrink-0">
                            Rs. {item.price}
                          </span>
                        </div>
                      </div>
                      {item.isUrgent && <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse z-10"><Zap size={10} fill="white" /> URGENT</div>}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 z-10">{item.condition}</div>
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
                      <img key={idx} src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded" />
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
                  <option>Electronics</option>
                  <option>Study Material</option>
                  <option>Others</option>
                </select>
                <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className={`${inputClass} flex-1`} placeholder="Price (PKR)" />
              </div>

              <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className={`${inputClass} h-32 resize-none`} placeholder="Description..." />

              {/* Restored Gradient Button */}
              <button disabled={isUploading} className="w-full py-4 bg-gradient-to-r from-blue-600 to-green-500 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-wait">
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

                <div className="flex justify-end items-center gap-2">
                  <select
                    value={reqExpiry}
                    onChange={e => setReqExpiry(e.target.value)}
                    className="bg-[#15161a] text-gray-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/5 outline-none"
                    title="Auto-delete after..."
                  >
                    <option value="0">Forever</option>
                    <option value="1">1 Hour</option>
                    <option value="5">5 Hours</option>
                    <option value="24">24 Hours</option>
                  </select>
                  <button type="button" onClick={() => setIsRequestUrgent(!isRequestUrgent)} className={`px-4 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${isRequestUrgent ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-[#15161a] text-gray-500 border-white/5'}`} title="Mark as Urgent">
                    <Zap size={14} fill={isRequestUrgent ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold">URGENT</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <input
                    value={reqTitle}
                    onChange={e => setReqTitle(e.target.value)}
                    className={inputClass}
                    placeholder={isMarketRun ? "Which Market? (e.g. Saddar)" : "Item Name (e.g. Arduino)"}
                  />
                  <div className="flex gap-2">
                    <input
                      value={reqDesc}
                      onChange={e => setReqDesc(e.target.value)}
                      className={`${inputClass} flex-1`}
                      placeholder={isMarketRun ? "Timing/Details (e.g. Going at 5pm)" : "Description (e.g. Need for 2 days)"}
                    />
                    <button disabled={isPostingReq} className="p-3 bg-white text-black rounded-xl hover:scale-105 transition-transform disabled:opacity-50" title="Post Request"><Send size={20} /></button>
                  </div>
                </div>
              </form>
            </div>
            {isLoading ? <LoadingSkeleton /> : (
              <div className="space-y-3">
                {requests.filter(req => {
                  if (!req.expiresAt) return true;
                  const expiry = req.expiresAt.toDate ? req.expiresAt.toDate() : new Date(req.expiresAt);
                  return expiry > new Date(); // Filter out expired
                }).map(req => (
                  <div key={req.id} onClick={() => handleRequestClick(req)} className={`p-4 rounded-xl border flex items-start justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors ${req.isMarketRun ? 'bg-green-900/10 border-green-500/30' : 'bg-[#1a1c22] border-white/5'}`} title="Click to Chat">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-full ${req.isMarketRun ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>{req.isMarketRun ? <Truck size={20} /> : <AlertTriangle size={20} />}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white">{req.title}</h4>
                          {req.isUrgent && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"><Zap size={10} fill="white" /> URGENT</span>}
                          {req.editedAt && <span className="text-[10px] text-gray-500 italic">(edited {formatTime(req.editedAt)})</span>}
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
                          <p className="text-gray-300 text-sm mt-1">{req.text}</p>
                        )}

                        <p className="text-xs text-gray-500 mt-2 flex gap-2 items-center">
                          <span>Posted by {req.userName}</span>
                          <span>•</span>
                          <span>{formatTime(req.createdAt)}</span>
                          {req.expiresAt && <span className="text-orange-400">• Exp: {formatTime(req.expiresAt)}</span>}
                        </p>
                      </div>
                    </div>
                    {req.user === user.email && !editingReq && (
                      <div className="flex flex-col gap-2">
                        <button onClick={(e) => { e.stopPropagation(); startEditRequest(req); }} className="text-gray-500 hover:text-blue-500 p-1" title="Edit Request"><Edit2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }} className="text-gray-500 hover:text-red-500 p-1" title="Delete Request"><Trash2 size={16} /></button>
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
                const chatItem = listings.find(l => l.id === id) || requests.find(r => r.id === id);
                const chatName = chatItem?.name || chatItem?.title || "Chat";
                const lastMessage = inboxGroups[id][0];
                const unreadCounts = unreadChats; // Renamed state variable usage

                return (
                  <div key={id} onClick={() => {
                    setActiveChat(chatItem || { id, name: chatName });
                  }} className="glass-card p-4 rounded-xl flex gap-4 cursor-pointer hover:bg-white/5 relative group" title="Open Chat">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${unreadCounts[id] ? 'bg-blue-600' : 'bg-blue-600/20'}`}>
                        <Mail size={20} className={unreadCounts[id] ? 'text-white' : 'text-blue-400'} />
                      </div>
                      {unreadCounts[id] > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full border-2 border-[#1a1c22] flex items-center justify-center text-[10px] font-bold text-white animate-bounce-short">{unreadCounts[id]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className={`font-bold truncate ${unreadCounts[id] ? 'text-white' : 'text-gray-300'}`}>{chatName}</h4>
                        <span className="text-[10px] text-gray-500">{formatTime(lastMessage.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={`text-sm truncate max-w-[85%] ${unreadCounts[id] ? 'text-white font-medium' : 'text-gray-400'}`}>
                          {lastMessage.sender === user.email && <span className="text-blue-400">You: </span>}
                          {lastMessage.text}
                        </p>
                        {/* Unread count badge on the right side as well? Or Just rely on the avatar badge. WhatsApp puts count on right. */}
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
          <div className="glass-card p-8 rounded-3xl text-center animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent" />

            {isEditingProfile ? (
              <div className="relative z-10 space-y-4">
                <h3 className="text-xl font-bold text-white mb-4">Edit Profile</h3>
                <div className="flex justify-center mb-2">
                  <div className="relative group w-20 h-20 rounded-full bg-[#202225] flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-gray-600 hover:border-[#003366]">
                    <input type="file" onChange={e => setEditPic(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {editPic ? <img src={URL.createObjectURL(editPic)} className="w-full h-full object-cover" /> : <Camera className="text-gray-500 group-hover:text-white" />}
                  </div>
                </div>
                <input className={inputClass} placeholder="Username" value={editName} onChange={e => setEditName(e.target.value)} />
                <input className={inputClass} placeholder="WhatsApp" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                <input className={inputClass} placeholder="New Password (Optional)" value={editPassword} onChange={e => setEditPassword(e.target.value)} type="password" />
                <input className={inputClass} value={user.email} disabled title="Email cannot be changed" style={{ opacity: 0.5, cursor: 'not-allowed' }} />

                <div className="flex gap-2 pt-2">
                  <button onClick={handleUpdateProfile} className="flex-1 py-3 bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18} /> Save</button>
                  <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="absolute top-0 right-0">
                  <button onClick={openEditProfile} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" title="Edit Profile">
                    <Edit2 size={16} />
                  </button>
                </div>
                <div className="w-24 h-24 mx-auto bg-[#003366] rounded-full flex items-center justify-center border-4 border-[#1a1c22] shadow-xl mb-4 overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <span className="text-3xl font-bold">{user.email[0].toUpperCase()}</span>}
                </div>
                <h2 className="text-2xl font-bold">{user.displayName}</h2>
                <p className="text-gray-400 text-sm mb-4">{user.email}</p>
                <div className="flex justify-center gap-1 mb-6">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="#fbbf24" className="text-yellow-400" />)}</div>

                <div className="text-left space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Listings</h3>
                  {listings.filter(l => l.seller === user.email).map(item => (
                    <div key={item.id} className="bg-[#15161a] p-3 rounded-xl border border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <img src={item.image} className="w-10 h-10 rounded-lg object-cover" />
                        <div><span className="font-bold text-sm block">{item.name}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${item.status === 'SOLD' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{item.status}</span></div>
                      </div>
                      <div className="flex gap-2">
                        {item.status !== 'SOLD' && <button onClick={() => setDeleteModalItem(item.id)} className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-500/10 rounded-full transition-colors" title="Mark Sold"><CheckCircle size={16} /></button>}
                        <button onClick={() => setDeleteModalItem(item.id)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors" title="Delete Listing"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden relative animate-slide-up my-auto max-h-[95vh] flex flex-col">
            <button onClick={() => setActiveProduct(null)} className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"><X size={20} /></button>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* Image Gallery */}
              <div className="h-72 sm:h-96 relative bg-black">
                <img
                  src={activeProduct.selectedImage || activeProduct.image}
                  className="w-full h-full object-contain"
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
                        <img src={img} className="w-full h-full object-cover" />
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
                  {activeProduct.seller !== user.email && (
                    <button onClick={() => { setActiveProduct(null); handleListingClick(activeProduct); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
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
                        <div className="h-24"><img src={rel.image} className="w-full h-full object-cover" /></div>
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
                        <div className="h-24"><img src={rel.image} className="w-full h-full object-cover" /></div>
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
      )}

      {activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md h-[80vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-[#1a1c22] flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">{activeChat.sellerName?.[0] || "?"}</div>
                <div>
                  <h3 className="font-bold text-sm">{activeChat.sellerName || "User"}</h3>
                  <p className="text-[10px] text-gray-400">({activeChat.name || activeChat.title})</p>
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
                <div key={m.id} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm max-w-[80%] break-words ${m.sender === user.email ? 'bg-blue-600 text-white' : m.sender === 'System' ? 'bg-green-600/20 text-green-300 text-center' : 'bg-[#252830] text-gray-200'}`}>
                    {m.text}
                    <div className="text-[9px] opacity-50 text-right mt-1">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="p-3 bg-[#15161a] flex gap-2 border-t border-white/5">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} className={`${inputClass} flex-1`} placeholder="Type a message..." />
              <button disabled={isSendingMsg} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl disabled:opacity-50 disabled:cursor-wait transition-colors" title="Send Message">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteModalItem && (
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
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#15161a]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full flex gap-1 shadow-2xl z-40">
        <NavBtn icon={ShoppingBag} active={view === 'market'} onClick={() => setView('market')} title="Marketplace" />
        <NavBtn icon={Mail} active={view === 'inbox'} onClick={() => setView('inbox')} title="Inbox" hasUnread={hasUnread} />
        <NavBtn icon={Plus} active={view === 'post'} onClick={() => setView('post')} title="Sell Item" />
        <NavBtn icon={ClipboardList} active={view === 'requests'} onClick={() => setView('requests')} title="Community Board" />
        <NavBtn icon={User} active={view === 'profile'} onClick={() => setView('profile')} title="My Profile" />
      </div>
    </div>
  );
}

const NavBtn = ({ icon: Icon, active, onClick, title, hasUnread }) => (
  <button onClick={onClick} title={title} className={`p-3.5 rounded-full transition-all duration-300 relative ${active ? 'bg-gradient-to-tr from-[#003366] to-[#3b82f6] text-white shadow-lg -translate-y-2 scale-110' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
    <Icon size={20} />
    {hasUnread && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#15161a] animate-pulse"></span>}
  </button>
);