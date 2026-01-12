import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Plus, LogOut, User, ClipboardList, Send, 
  MessageCircle, X, Mail, Star, Camera, Eye, EyeOff, 
  Search, Filter, MapPin, AlertTriangle, ChevronRight, Check,
  Zap, Clock, Truck, Tag, ShieldCheck, Phone // <--- FIXED: Added Phone
} from 'lucide-react';
import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest,
  resendVerificationLink, sendMessage, listenToMessages, 
  listenToAllMessages, getPublicProfile, uploadImageToCloudinary, rateUser
} from './firebaseFunctions';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inboxGroups, setInboxGroups] = useState({});
  const [newMsg, setNewMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [listingType, setListingType] = useState('SELL');
  const [condition, setCondition] = useState('Used');
  const [isUrgent, setIsUrgent] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reqText, setReqText] = useState('');
  const [isMarketRun, setIsMarketRun] = useState(false);

  useEffect(() => {
    const unsubscribe = authStateListener((u) => setUser(u));
    refreshData();
    return () => unsubscribe();
  }, []);

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
    setListings(items); setRequests(reqs);
  };

  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || item.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [listings, searchQuery, activeCategory]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        if (!acceptedTerms) throw new Error("Please accept the Terms of Service.");
        await signUpUser(email, password, { name, whatsapp: phone });
        await resendVerificationLink();
        alert("Verification link sent to your NUST email!");
      }
    } catch (err) { alert(err.message); }
  };

  const handlePostItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80";
      if (imageFile) imageUrl = await uploadImageToCloudinary(imageFile);
      await createListing({ 
        name: itemName, price: Number(itemPrice), description: itemDesc,
        type: listingType, condition: condition, isUrgent: isUrgent,
        image: imageUrl, seller: user.email, 
        sellerName: user.displayName || "NUST Student", sellerReputation: 5.0 
      });
      setView('market'); refreshData();
      setItemName(''); setItemPrice(''); setImageFile(null); setItemDesc(''); setIsUrgent(false);
    } catch (err) { alert("Error: " + err.message); } 
    finally { setIsUploading(false); }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      await sendMessage(activeChat.id, user.email, newMsg);
      if (chatMessages.length === 0) {
        await sendMessage(activeChat.id, "System", "🔔 Notification sent to WhatsApp!");
        const sellerProfile = await getPublicProfile(activeChat.seller);
        if (sellerProfile?.whatsapp) {
           const text = `Hi! Interested in '${activeChat.name}' on Samaan Share.`;
           window.open(`https://wa.me/${sellerProfile.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
        }
      }
      setNewMsg('');
    } catch (err) { alert(err.message); }
  };

  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="relative min-h-screen bg-[#050505] overflow-hidden flex items-center justify-center p-4">
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
                  <h3 className="text-yellow-100 font-bold">Verify Your Identity</h3>
                  <p className="text-xs text-yellow-500/80 mt-1">We sent a link to {user.email}</p>
               </div>
               <button onClick={() => resendVerificationLink()} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/50">Resend Link</button>
               <button onClick={logoutUser} className="text-sm text-gray-500 hover:text-white">Sign Out</button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
               {!isLogin && (
                 <div className="grid grid-cols-2 gap-3">
                   <input className="input-sparky" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                   <input className="input-sparky" placeholder="0300..." value={phone} onChange={e => setPhone(e.target.value)} required />
                 </div>
               )}
               <input className="input-sparky w-full" type="email" placeholder="std@nust.edu.pk" value={email} onChange={e => setEmail(e.target.value)} required />
               <div className="relative">
                 <input type={showPassword ? "text" : "password"} className="input-sparky w-full pr-10" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                   {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                 </button>
               </div>
               {!isLogin && (
                 <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                   <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="rounded border-gray-600 bg-transparent" />
                   <span>I agree to the <span className="text-blue-400">Terms</span> & <span className="text-blue-400">Privacy</span></span>
                 </label>
               )}
               <button className="w-full py-3.5 bg-gradient-to-r from-[#003366] to-[#2563eb] hover:from-[#004499] hover:to-[#3b82f6] text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transform active:scale-95 transition-all">
                 {isLogin ? "Unlock Campus" : "Join Now"}
               </button>
               <div className="text-center pt-2">
                 <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-white transition-colors">
                   {isLogin ? "New Student? Sign Up" : "Already have an ID? Login"}
                 </button>
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
          <div className="flex items-center gap-3" onClick={() => setView('market')}>
            <div className="bg-gradient-to-tr from-[#003366] to-[#3b82f6] p-1.5 rounded-lg">
               <ShoppingBag size={20} className="text-white"/>
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">SAMAAN SHARE</span>
          </div>
          <button onClick={logoutUser} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-red-400">
            <LogOut size={20}/>
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-4 space-y-6 relative z-10">
        {view === 'market' && (
          <div className="animate-slide-up space-y-5">
            <div className="space-y-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input type="text" placeholder="Search listings..." className="w-full bg-[#15161a] border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-lg" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'SELL', 'RENT'].map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}>
                    {cat === 'All' ? 'Everything' : cat === 'SELL' ? 'For Sale' : 'For Rent'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredListings.map(item => (
                <div key={item.id} className="glass-card rounded-2xl overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                  <div className="relative h-48">
                    <img src={item.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={item.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <div>
                        <h3 className="font-bold text-white text-lg truncate shadow-black drop-shadow-md">{item.name}</h3>
                        <p className="text-xs text-gray-300 flex items-center gap-1"><User size={12}/> {item.sellerName}</p>
                      </div>
                      <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white border border-white/20">Rs. {item.price}</span>
                    </div>
                    {item.isUrgent && (
                      <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse"><Zap size={10} fill="white"/> URGENT</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">{item.condition}</div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-400 line-clamp-2 h-10 mb-3">{item.description}</p>
                    {item.seller !== user.email && (
                      <button onClick={() => setActiveChat(item)} className="w-full py-2.5 rounded-xl bg-[#1a1c22] border border-white/5 hover:bg-[#003366] hover:text-white text-gray-400 text-sm font-medium transition-colors flex justify-center items-center gap-2">
                        <MessageCircle size={16}/> Chat Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {view === 'requests' && (
          <div className="animate-slide-up space-y-6">
            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-yellow-500">
               <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ClipboardList className="text-yellow-500"/> Community Board</h2>
               <form onSubmit={async (e) => { e.preventDefault(); if(!reqText.trim()) return; await createRequest({ text: reqText, user: user.email, userName: user.displayName, isMarketRun }); setReqText(''); refreshData(); }} className="space-y-3">
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setIsMarketRun(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isMarketRun ? 'bg-yellow-500 text-black' : 'bg-[#15161a] text-gray-500'}`}>I NEED ITEM</button>
                    <button type="button" onClick={() => setIsMarketRun(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isMarketRun ? 'bg-[#57F287] text-black' : 'bg-[#15161a] text-gray-500'}`}>I'M GOING TO MARKET</button>
                 </div>
                 <div className="flex gap-2">
                   <input value={reqText} onChange={e => setReqText(e.target.value)} className="input-sparky flex-1" placeholder={isMarketRun ? "e.g. Going to Saddar at 5pm..." : "e.g. I need an Arduino..."} />
                   <button className="p-3 bg-white text-black rounded-xl hover:scale-105 transition-transform"><Send size={20}/></button>
                 </div>
               </form>
            </div>
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className={`p-4 rounded-xl border flex items-start gap-4 ${req.isMarketRun ? 'bg-green-900/10 border-green-500/30' : 'bg-[#1a1c22] border-white/5'}`}>
                  <div className={`p-3 rounded-full ${req.isMarketRun ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>{req.isMarketRun ? <Truck size={20}/> : <AlertTriangle size={20}/>}</div>
                  <div>
                    <h4 className="font-bold text-white">{req.isMarketRun ? "Market Run Alert" : "Request"}</h4>
                    <p className="text-gray-300 text-sm mt-1">{req.text}</p>
                    <p className="text-xs text-gray-500 mt-2">Posted by {req.userName} • Just now</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === 'post' && (
          <div className="glass-card p-6 rounded-3xl animate-slide-up">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Plus className="text-blue-500"/> List Item</h2>
            <form onSubmit={handlePostItem} className="space-y-5">
              <div className="relative w-full h-48 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-[#15161a] flex flex-col items-center justify-center cursor-pointer transition-colors group overflow-hidden">
                <input type="file" onChange={e => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                {imageFile ? <img src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover" /> : <div className="text-center group-hover:scale-105 transition-transform"><Camera size={32} className="text-gray-500 mx-auto mb-2"/><p className="text-xs text-gray-400">Tap to upload</p></div>}
              </div>
              <div className="flex gap-3">
                 <div className="flex-1 bg-[#15161a] p-1 rounded-xl flex">
                   {['SELL', 'RENT'].map(t => <button type="button" key={t} onClick={() => setListingType(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listingType === t ? 'bg-[#252830] text-white shadow' : 'text-gray-500'}`}>{t}</button>)}
                 </div>
                 <button type="button" onClick={() => setIsUrgent(!isUrgent)} className={`px-4 rounded-xl border border-white/5 flex flex-col items-center justify-center transition-all ${isUrgent ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-[#15161a] text-gray-500'}`}><Zap size={16} fill={isUrgent ? "currentColor" : "none"}/><span className="text-[10px] font-bold">URGENT</span></button>
              </div>
              <input value={itemName} onChange={e => setItemName(e.target.value)} className="input-sparky w-full" placeholder="Title (e.g. Lab Coat)" />
              <div className="flex gap-3">
                <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="input-sparky flex-1" placeholder="Price" />
                <select value={condition} onChange={e => setCondition(e.target.value)} className="input-sparky flex-1 bg-[#15161a]"><option>New</option><option>Like New</option><option>Used</option><option>For Parts</option></select>
              </div>
              <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="input-sparky w-full h-32 resize-none" placeholder="Description..." />
              <button disabled={isUploading} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">{isUploading ? "Uploading..." : "Publish to Market"}</button>
            </form>
          </div>
        )}
        {view === 'inbox' && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold">Messages</h2>
            {Object.keys(inboxGroups).map(id => (
              <div key={id} onClick={() => setActiveChat(listings.find(l=>l.id===id) || {id, name:"Item"})} className="glass-card p-4 rounded-xl flex gap-4 cursor-pointer hover:bg-white/5">
                 <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400"><Mail size={20}/></div>
                 <div className="flex-1">
                   <h4 className="font-bold text-white">{listings.find(l=>l.id===id)?.name || "Chat"}</h4>
                   <p className="text-sm text-gray-400 truncate">{inboxGroups[id][inboxGroups[id].length-1].text}</p>
                 </div>
              </div>
            ))}
          </div>
        )}
        {view === 'profile' && (
          <div className="glass-card p-8 rounded-3xl text-center animate-slide-up relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent"/>
             <div className="relative z-10">
               <div className="w-24 h-24 mx-auto bg-[#003366] rounded-full flex items-center justify-center text-3xl font-bold border-4 border-[#1a1c22] shadow-xl mb-4">{user.email[0].toUpperCase()}</div>
               <h2 className="text-2xl font-bold">{user.displayName}</h2>
               <p className="text-gray-400 text-sm mb-4">{user.email}</p>
               <div className="flex justify-center gap-1 mb-6">{[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#fbbf24" className="text-yellow-400"/>)}</div>
             </div>
          </div>
        )}
      </div>

      {activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="glass-card w-full max-w-md h-[80vh] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 bg-[#15161a] flex justify-between items-center border-b border-white/5">
                 <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">{activeChat.name[0]}</div><h3 className="font-bold text-sm">{activeChat.name}</h3></div>
                 <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                 {chatMessages.map(m => (
                   <div key={m.id} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                     <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${m.sender===user.email ? 'bg-blue-600 text-white' : 'bg-[#252830] text-gray-200'}`}>{m.text}</div>
                   </div>
                 ))}
              </div>
              <form onSubmit={handleSendChat} className="p-3 bg-[#15161a] flex gap-2"><input value={newMsg} onChange={e=>setNewMsg(e.target.value)} className="input-sparky flex-1" placeholder="Type..." /><button className="p-3 bg-blue-600 rounded-xl"><Send size={18}/></button></form>
           </div>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#15161a]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full flex gap-1 shadow-2xl z-40">
        <NavBtn icon={ShoppingBag} active={view === 'market'} onClick={() => setView('market')} />
        <NavBtn icon={Mail} active={view === 'inbox'} onClick={() => setView('inbox')} />
        <NavBtn icon={Plus} active={view === 'post'} onClick={() => setView('post')} />
        <NavBtn icon={ClipboardList} active={view === 'requests'} onClick={() => setView('requests')} />
        <NavBtn icon={User} active={view === 'profile'} onClick={() => setView('profile')} />
      </div>

      <style>{`
        .input-sparky { width: 100%; background: #15161a; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 16px; border-radius: 12px; outline: none; transition: all 0.2s; }
        .input-sparky:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
      `}</style>
    </div>
  );
}

const NavBtn = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-3.5 rounded-full transition-all duration-300 ${active ? 'bg-gradient-to-tr from-[#003366] to-[#3b82f6] text-white shadow-lg -translate-y-2 scale-110' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
    <Icon size={20} />
  </button>
);