import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Plus, LogOut, User, ClipboardList, Send, 
  MessageCircle, X, Mail, Trash2, Star, Camera, Eye, EyeOff, 
  Search, Filter, MapPin, AlertTriangle, ChevronRight, Check
} from 'lucide-react';
import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest,
  resendVerificationLink, sendMessage, listenToMessages, 
  listenToAllMessages, getPublicProfile, uploadImageToCloudinary, rateUser
} from './firebaseFunctions';

function App() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Chat
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inboxGroups, setInboxGroups] = useState({});
  const [newMsg, setNewMsg] = useState('');
  
  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false); // PASSWORD EYE
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Create Listing Inputs
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [listingType, setListingType] = useState('SELL'); // RENT or SELL
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Request Input
  const [reqText, setReqText] = useState('');

  // --- INITIAL LOAD ---
  useEffect(() => {
    const unsubscribe = authStateListener((u) => setUser(u));
    refreshData();
    return () => unsubscribe();
  }, []);

  // Listeners
  useEffect(() => {
    if (user) {
      const unsubscribe = listenToAllMessages((msgs) => {
        const groups = msgs.reduce((acc, m) => {
          if (!acc[m.chatId]) acc[m.chatId] = [];
          acc[m.chatId].push(m);
          return acc;
        }, {});
        setInboxGroups(groups);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (activeChat) {
      const unsubscribe = listenToMessages(activeChat.id, (msgs) => setChatMessages(msgs));
      return () => unsubscribe();
    }
  }, [activeChat]);

  const refreshData = async () => {
    const [items, reqs] = await Promise.all([getListings(), getRequests()]);
    setListings(items); 
    setRequests(reqs);
  };

  // Filter Logic
  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || item.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [listings, searchQuery, activeCategory]);

  // --- HANDLERS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        if (!acceptedTerms) throw new Error("You must accept the Terms of Service.");
        await signUpUser(email, password, { name, whatsapp: phone });
        await resendVerificationLink();
        alert("Welcome! Verification link sent.");
      }
    } catch (err) { alert(err.message); }
  };

  const handlePostItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = "https://via.placeholder.com/400?text=No+Image"; 
      if (imageFile) imageUrl = await uploadImageToCloudinary(imageFile);

      await createListing({ 
        name: itemName, 
        price: Number(itemPrice), 
        description: itemDesc,
        type: listingType, // SELL or RENT
        image: imageUrl, 
        seller: user.email, 
        sellerName: user.displayName || "NUST Student", 
        sellerReputation: 5.0 
      });
      
      setView('market'); refreshData();
      setItemName(''); setItemPrice(''); setImageFile(null); setItemDesc('');
    } catch (err) { alert("Error: " + err.message); } 
    finally { setIsUploading(false); }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      await sendMessage(activeChat.id, user.email, newMsg);
      if (chatMessages.length === 0) {
        await sendMessage(activeChat.id, "System", "🔔 Seller notified via WhatsApp!");
        const sellerProfile = await getPublicProfile(activeChat.seller);
        if (sellerProfile?.whatsapp) {
           const text = `Hi! Interested in '${activeChat.name}' on Samaan Share.`;
           window.open(`https://wa.me/${sellerProfile.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
        }
      }
      setNewMsg('');
    } catch (err) { alert(err.message); }
  };

  const handleRateUser = async (targetEmail) => {
    const rating = prompt("Rate (1-5 Stars):");
    if (rating >= 1 && rating <= 5) {
      await rateUser(targetEmail, Number(rating));
      alert("Rated!");
    }
  };

  // --- AUTH SCREEN (GLASSMORPHISM UI) ---
  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#003366] via-[#1a1c20] to-[#0f1012] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative Glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#57F287] rounded-full blur-[80px] opacity-20"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#003366] rounded-full blur-[80px] opacity-40"></div>

          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#003366] to-[#005599] shadow-lg shadow-blue-900/40 mb-4">
                <ShoppingBag className="text-white" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Samaan Share</h1>
              <p className="text-gray-400 text-sm mt-2">NUST's Exclusive Student Marketplace</p>
            </div>

            {user ? (
              <div className="space-y-4 text-center animate-fade-in">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <AlertTriangle className="mx-auto text-yellow-500 mb-2" />
                  <p className="text-yellow-100 font-medium">Verification Pending</p>
                  <p className="text-xs text-yellow-500/80 mt-1">Check {user.email}</p>
                </div>
                <button onClick={() => resendVerificationLink()} className="w-full py-3 bg-[#003366] hover:bg-[#004488] text-white rounded-xl font-semibold transition-all">Resend Link</button>
                <button onClick={logoutUser} className="text-sm text-gray-400 hover:text-white transition-colors">Sign Out</button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    <InputGroup icon={User} placeholder="Full Name" value={name} onChange={setName} />
                    <InputGroup icon={Phone} placeholder="WhatsApp (923...)" value={phone} onChange={setPhone} />
                  </>
                )}
                <InputGroup icon={Mail} type="email" placeholder="student@nust.edu.pk" value={email} onChange={setEmail} />
                
                {/* PASSWORD FIELD WITH EYE */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#57F287] transition-colors">
                    <User size={18} /> {/* Using User icon as generic lock placeholder or Lock icon */}
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Password" 
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white placeholder-gray-500 outline-none focus:border-[#57F287]/50 focus:bg-black/40 transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {!isLogin && (
                  <label className="flex items-start gap-3 text-sm text-gray-400 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${acceptedTerms ? 'bg-[#57F287] border-[#57F287] text-black' : 'border-gray-600 group-hover:border-gray-400'}`}>
                      {acceptedTerms && <Check size={14} strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
                    <span className="leading-tight">I agree to the <span className="text-white underline">Terms of Service</span> and Privacy Policy.</span>
                  </label>
                )}

                <button className="w-full py-4 bg-gradient-to-r from-[#003366] to-[#005599] hover:from-[#004488] hover:to-[#0066cc] text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group">
                  {isLogin ? "Login" : "Create Account"}
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="text-center">
                  <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {isLogin ? "New here? Create Account" : "Already have an account? Login"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="min-h-screen bg-[#0f1012] text-gray-100 font-sans pb-24">
      {/* HEADER */}
      <nav className="bg-[#1a1c20]/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2" onClick={() => setView('market')}>
            <div className="bg-gradient-to-tr from-[#003366] to-[#005599] p-2 rounded-lg">
              <ShoppingBag size={20} className="text-white"/>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">SAMAAN SHARE</span>
          </div>
          <button onClick={logoutUser} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-red-400 transition-colors">
            <LogOut size={20}/>
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* MARKET FEED */}
        {view === 'market' && (
          <>
            {/* Search & Filters */}
            <div className="sticky top-20 z-40 space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search listings..." 
                  className="w-full bg-[#1a1c20] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-[#003366] outline-none shadow-lg"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'SELL', 'RENT'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-black' : 'bg-[#1a1c20] text-gray-400 border border-white/5'}`}
                  >
                    {cat === 'All' ? 'All Items' : cat === 'SELL' ? 'For Sale' : 'For Rent'}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredListings.map(item => (
                <div key={item.id} className="bg-[#1a1c20] rounded-2xl overflow-hidden border border-white/5 hover:border-[#003366] transition-all group shadow-xl">
                  <div className="relative aspect-video">
                    <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10 uppercase">
                      {item.type}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white truncate pr-2">{item.name}</h3>
                      <span className="text-[#57F287] font-mono font-bold">Rs.{item.price}</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3 h-8">{item.description}</p>
                    
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                       <div className="flex items-center gap-2 text-xs text-gray-300">
                         <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#003366] to-[#005599] flex items-center justify-center text-[10px]">
                           {item.sellerName[0]}
                         </div>
                         {item.sellerName}
                       </div>
                       {item.seller !== user.email && (
                         <button onClick={() => setActiveChat(item)} className="p-2 bg-[#003366] rounded-full text-white hover:scale-110 transition-transform shadow-lg shadow-blue-900/20">
                           <MessageCircle size={16} />
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredListings.length === 0 && (
              <div className="text-center py-20 opacity-50">
                <Search size={48} className="mx-auto mb-2 text-gray-600"/>
                <p>No results found</p>
              </div>
            )}
          </>
        )}

        {/* INBOX */}
        {view === 'inbox' && (
           <div className="space-y-4">
             <h2 className="text-2xl font-bold text-white mb-6">Messages</h2>
             {Object.keys(inboxGroups).map(chatId => {
               const item = listings.find(l => l.id === chatId) || { name: "Archived Item", id: chatId };
               const lastMsg = inboxGroups[chatId][inboxGroups[chatId].length - 1];
               return (
                 <div key={chatId} onClick={() => setActiveChat(item)} className="bg-[#1a1c20] p-4 rounded-2xl border border-white/5 flex gap-4 cursor-pointer hover:bg-[#23252a] transition-colors">
                   <div className="w-12 h-12 rounded-full bg-[#003366]/20 flex items-center justify-center text-[#57F287]"><Mail size={20}/></div>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between mb-1">
                       <h3 className="font-bold text-white">{item.name}</h3>
                       <span className="text-[10px] text-gray-500">Active</span>
                     </div>
                     <p className="text-sm text-gray-400 truncate">{lastMsg.text}</p>
                   </div>
                 </div>
               )
             })}
           </div>
        )}

        {/* POST LISTING */}
        {view === 'post' && (
          <div className="bg-[#1a1c20] p-6 rounded-3xl border border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Create Listing</h2>
            <form onSubmit={handlePostItem} className="space-y-5">
              {/* Image Upload */}
              <div className="group relative w-full h-52 bg-black/20 rounded-2xl border-2 border-dashed border-gray-700 hover:border-[#003366] transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                <input type="file" onChange={e => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="p-4 bg-[#23252a] rounded-full mb-3 group-hover:scale-110 transition-transform">
                      <Camera size={24} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Upload Item Photo</p>
                  </>
                )}
              </div>

              {/* Type Toggle */}
              <div className="flex bg-black/20 p-1 rounded-xl">
                {['SELL', 'RENT'].map(type => (
                  <button type="button" key={type} onClick={() => setListingType(type)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${listingType === type ? 'bg-[#23252a] text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                    {type === 'SELL' ? 'Sell Item' : 'Rent Out'}
                  </button>
                ))}
              </div>

              <input required placeholder="Title (e.g. Lab Coat)" className="w-full bg-[#23252a] text-white px-4 py-3.5 rounded-xl outline-none focus:ring-1 focus:ring-[#003366]" value={itemName} onChange={e => setItemName(e.target.value)} />
              <input required type="number" placeholder="Price (PKR)" className="w-full bg-[#23252a] text-white px-4 py-3.5 rounded-xl outline-none focus:ring-1 focus:ring-[#003366]" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
              <textarea required placeholder="Description..." className="w-full bg-[#23252a] text-white px-4 py-3.5 rounded-xl outline-none focus:ring-1 focus:ring-[#003366] h-32 resize-none" value={itemDesc} onChange={e => setItemDesc(e.target.value)} />

              <button disabled={isUploading} className="w-full py-4 bg-[#003366] hover:bg-[#004488] text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20">
                {isUploading ? 'Uploading...' : 'Publish Listing'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CHAT OVERLAY */}
      {activeChat && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1c20] w-full max-w-md h-[80vh] rounded-3xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#23252a] flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gradient-to-br from-[#003366] to-[#005599] rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {activeChat.name[0]}
                 </div>
                 <div>
                   <h3 className="font-bold text-white text-sm">{activeChat.name}</h3>
                   <button onClick={() => handleRateUser(activeChat.seller)} className="text-[10px] text-[#FEE75C] flex items-center gap-1 hover:underline">Rate Seller <Star size={10}/></button>
                 </div>
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 bg-black/20 rounded-full text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f1012]">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm max-w-[85%] ${m.sender === "System" ? 'bg-blue-900/20 text-blue-300 w-full text-center text-xs' : m.sender === user.email ? 'bg-[#003366] text-white rounded-tr-sm' : 'bg-[#23252a] text-gray-200 rounded-tl-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="p-3 bg-[#23252a] flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} className="flex-1 bg-[#1a1c20] text-white rounded-xl px-4 text-sm outline-none border border-transparent focus:border-[#003366]" placeholder="Type here..." />
              <button className="p-3 bg-[#003366] text-white rounded-xl hover:bg-[#004488]"><Send size={18}/></button>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1c20]/90 backdrop-blur-xl border border-white/10 p-2 rounded-full flex gap-1 shadow-2xl z-50">
        <NavBtn icon={ShoppingBag} active={view === 'market'} onClick={() => setView('market')} />
        <NavBtn icon={Mail} active={view === 'inbox'} onClick={() => setView('inbox')} />
        <NavBtn icon={Plus} active={view === 'post'} onClick={() => setView('post')} />
        <NavBtn icon={ClipboardList} active={view === 'requests'} onClick={() => setView('requests')} />
        <NavBtn icon={User} active={view === 'profile'} onClick={() => setView('profile')} />
      </div>
    </div>
  );
}

const InputGroup = ({ icon: Icon, type = "text", ...props }) => (
  <div className="relative group">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#57F287] transition-colors">
      <Icon size={18} />
    </div>
    <input 
      type={type} 
      className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-gray-500 outline-none focus:border-[#57F287]/50 focus:bg-black/40 transition-all"
      {...props}
    />
  </div>
);

const NavBtn = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-3.5 rounded-full transition-all duration-300 ${active ? 'bg-[#003366] text-white shadow-lg shadow-blue-900/40 -translate-y-2' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
  </button>
);

export default App;