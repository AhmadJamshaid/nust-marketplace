import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, PlusCircle, LogOut, User, ClipboardList, Send, 
  MessageCircle, X, Mail, Trash2, Star, Camera, Phone, MapPin, AlertTriangle
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
  const [view, setView] = useState('market'); // 'market', 'inbox', 'requests', 'post', 'profile'
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  
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
  
  // Create Listing Inputs
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDesc, setItemDesc] = useState('');
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

  // --- REAL-TIME LISTENERS ---
  useEffect(() => {
    if (user) {
      // Listen for Global Inbox
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
      // Listen for Active Chat
      const unsubscribe = listenToMessages(activeChat.id, (msgs) => setChatMessages(msgs));
      return () => unsubscribe();
    }
  }, [activeChat]);

  const refreshData = async () => {
    const [items, reqs] = await Promise.all([getListings(), getRequests()]);
    setListings(items); 
    setRequests(reqs);
  };

  // --- ACTION HANDLERS ---

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      await sendMessage(activeChat.id, user.email, newMsg);
      
      // WhatsApp Bridge: Check if it's the first message
      if (chatMessages.length === 0) {
        // 1. Send System Nudge in App
        await sendMessage(activeChat.id, "System", "🔔 Seller has been notified via WhatsApp!");
        
        // 2. Open WhatsApp Logic
        const sellerProfile = await getPublicProfile(activeChat.seller);
        if (sellerProfile?.whatsapp) {
           const text = `Hi! I saw your listing '${activeChat.name}' on Samaan Share. Is it available?`;
           const url = `https://wa.me/${sellerProfile.whatsapp}?text=${encodeURIComponent(text)}`;
           window.open(url, '_blank');
        }
      }
      setNewMsg('');
    } catch (err) { alert(err.message); }
  };

  const handlePostItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = "https://via.placeholder.com/400?text=No+Image"; 
      
      // Cloudinary Upload
      if (imageFile) {
        imageUrl = await uploadImageToCloudinary(imageFile);
      }

      await createListing({ 
        name: itemName, 
        price: Number(itemPrice), 
        description: itemDesc,
        image: imageUrl, 
        seller: user.email, 
        sellerName: user.displayName || "NUST Student", 
        sellerReputation: 5.0 
      });
      
      setView('market');
      refreshData();
      setItemName(''); setItemPrice(''); setImageFile(null); setItemDesc('');
    } catch (err) {
      alert("Error posting: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRateUser = async (targetEmail) => {
    const rating = prompt("Rate this user (1-5 Stars):");
    if (rating && rating >= 1 && rating <= 5) {
      await rateUser(targetEmail, Number(rating));
      alert("Rating submitted! Reputation updated.");
    } else {
      alert("Please enter a number between 1 and 5.");
    }
  };

  // --- AUTHENTICATION SCREEN (The Fortress) ---
  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="min-h-screen bg-[#36393F] flex items-center justify-center p-4 font-sans text-white">
        <div className="bg-[#2F3136] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 relative overflow-hidden">
          {/* NUST Blue Top Border */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-[#003366]"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black italic tracking-wide">SAMAAN SHARE</h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">NUST Exclusive Marketplace</p>
          </div>
          
          {user ? (
            <div className="space-y-4 text-center">
              <div className="bg-[#202225] p-6 rounded-xl border border-yellow-500/20">
                <AlertTriangle className="mx-auto text-yellow-500 mb-2" />
                <p className="font-bold">Verification Pending</p>
                <p className="text-sm text-gray-400 mt-1">We sent a link to:</p>
                <p className="text-[#57F287] font-mono text-sm mt-1">{user.email}</p>
              </div>
              <button onClick={() => resendVerificationLink()} className="w-full bg-[#003366] text-white p-3 rounded-xl font-bold hover:bg-[#004488]">Resend Link</button>
              <button onClick={logoutUser} className="w-full p-3 text-gray-400 text-sm hover:text-white">Sign Out</button>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (isLogin) await loginUser(email, password);
                else {
                  await signUpUser(email, password, { name, whatsapp: phone });
                  await resendVerificationLink();
                  alert("Welcome! Check your email to verify.");
                }
              } catch (err) { alert(err.message); }
            }} className="space-y-4">
              {!isLogin && (
                <>
                  <input className="w-full bg-[#202225] text-white p-3 rounded-xl outline-none border border-transparent focus:border-[#003366]" placeholder="Full Name" onChange={e => setName(e.target.value)} required />
                  <input className="w-full bg-[#202225] text-white p-3 rounded-xl outline-none border border-transparent focus:border-[#003366]" placeholder="WhatsApp (e.g. 923001234567)" onChange={e => setPhone(e.target.value)} required />
                </>
              )}
              <input className="w-full bg-[#202225] text-white p-3 rounded-xl outline-none border border-transparent focus:border-[#003366]" type="email" placeholder="student@seecs.edu.pk" onChange={e => setEmail(e.target.value)} required />
              <input className="w-full bg-[#202225] text-white p-3 rounded-xl outline-none border border-transparent focus:border-[#003366]" type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} required />
              
              <button className="w-full bg-[#003366] text-white p-3 rounded-xl font-bold uppercase shadow-lg hover:bg-[#004488] transition-all">
                {isLogin ? "Enter Campus" : "Join Now"}
              </button>
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs text-gray-400 underline text-center">
                {isLogin ? 'New Student? Sign Up' : 'Already have an account? Login'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN APP (Authenticated) ---
  return (
    <div className="min-h-screen bg-[#36393F] pb-24 text-gray-100 font-sans">
      
      {/* HEADER */}
      <nav className="bg-[#2F3136] p-4 border-b border-[#202225] sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2" onClick={() => setView('market')}>
          <div className="bg-[#003366] p-2 rounded-lg text-white"><ShoppingBag size={20}/></div>
          <span className="font-bold text-lg tracking-tight">SAMAAN SHARE</span>
        </div>
        <button onClick={logoutUser} title="Logout" className="text-gray-400 hover:text-red-500"><LogOut size={20}/></button>
      </nav>

      <div className="p-4 max-w-lg mx-auto">
        
        {/* MARKET FEED */}
        {view === 'market' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
              <MapPin size={18} className="text-[#003366]"/> Campus Feed
            </h2>
            {listings.map(item => (
              <div key={item.id} className="bg-[#2F3136] rounded-xl overflow-hidden border border-[#202225] shadow-lg group hover:border-[#003366] transition-colors">
                <div className="flex p-4 gap-4">
                  <img src={item.image} className="w-24 h-24 object-cover rounded-lg bg-[#202225]" alt="item" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-white text-lg truncate">{item.name}</h3>
                      <span className="text-[#57F287] font-mono font-bold">Rs.{item.price}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <User size={12}/> {item.sellerName}
                      <span className="text-[#FEE75C] flex items-center ml-2 bg-[#FEE75C]/10 px-1.5 rounded">
                        <Star size={10} fill="#FEE75C" className="mr-0.5"/> 5.0
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">{item.description}</p>
                  </div>
                </div>
                {item.seller !== user.email && (
                  <button onClick={() => setActiveChat(item)} className="w-full bg-[#202225] py-3 text-sm font-bold text-gray-300 hover:bg-[#003366] hover:text-white transition-colors flex justify-center items-center gap-2 border-t border-[#202225]">
                    <MessageCircle size={16}/> Chat with Seller
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* INBOX */}
        {view === 'inbox' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">Inbox</h2>
            {Object.keys(inboxGroups).length === 0 ? (
              <div className="text-center py-20 text-gray-500 opacity-50">
                <Mail size={48} className="mx-auto mb-2"/>
                <p>No messages yet.</p>
              </div>
            ) : (
              Object.keys(inboxGroups).map(chatId => {
                const item = listings.find(l => l.id === chatId);
                const lastMsg = inboxGroups[chatId][inboxGroups[chatId].length - 1];
                return (
                  <div key={chatId} onClick={() => setActiveChat(item || {id: chatId, name: "Unknown Item", seller: ""})} 
                       className="bg-[#2F3136] p-4 rounded-xl border border-[#202225] flex items-center gap-4 cursor-pointer hover:bg-[#36393F]">
                    <div className="w-12 h-12 bg-[#003366] rounded-full flex items-center justify-center text-white"><Mail size={20}/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className="font-bold text-white truncate">{item ? item.name : "Chat"}</p>
                        <p className="text-xs text-gray-500">Active</p>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{lastMsg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* REQUESTS */}
        {view === 'requests' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">Request Board</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if(!reqText.trim()) return;
              await createRequest({ text: reqText, user: user.email, userName: user.displayName });
              setReqText(''); refreshData();
            }} className="bg-[#2F3136] p-4 rounded-xl border border-[#202225] flex gap-2">
              <input required value={reqText} className="flex-1 bg-[#202225] text-white p-3 rounded-lg outline-none placeholder-gray-500" placeholder="I need a..." onChange={e => setReqText(e.target.value)} />
              <button className="bg-[#57F287] text-black p-3 rounded-lg font-bold hover:bg-green-400"><Send size={18}/></button>
            </form>
            {requests.map(req => (
              <div key={req.id} className="bg-[#2F3136] p-4 rounded-xl border-l-4 border-[#FEE75C] shadow-sm relative">
                <p className="font-medium text-lg text-white">"{req.text}"</p>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Asked by {req.userName || "Student"}</span>
                  <span>Today</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* POST LISTING */}
        {view === 'post' && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-200 mb-4">Sell Item</h2>
            <form onSubmit={handlePostItem} className="bg-[#2F3136] p-6 rounded-2xl border border-[#202225] space-y-4">
              
              <div className="w-full h-48 bg-[#202225] rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center relative cursor-pointer hover:border-[#003366] transition-colors">
                <input type="file" onChange={(e) => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                {imageFile ? (
                   <img src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover rounded-xl" alt="preview" />
                ) : (
                  <>
                    <Camera size={32} className="text-gray-500 mb-2"/>
                    <p className="text-gray-500 text-sm font-medium">Upload Photo</p>
                  </>
                )}
              </div>

              <input required className="w-full bg-[#202225] text-white p-4 rounded-xl outline-none" placeholder="Title" onChange={e => setItemName(e.target.value)} value={itemName} />
              <input required className="w-full bg-[#202225] text-white p-4 rounded-xl outline-none" type="number" placeholder="Price (PKR)" onChange={e => setItemPrice(e.target.value)} value={itemPrice} />
              <textarea required className="w-full bg-[#202225] text-white p-4 rounded-xl outline-none h-24 resize-none" placeholder="Description..." onChange={e => setItemDesc(e.target.value)} value={itemDesc} />
              
              <button disabled={isUploading} className={`w-full p-4 rounded-xl font-bold uppercase shadow-lg text-white transition-all ${isUploading ? 'bg-gray-600' : 'bg-[#003366] hover:bg-[#004488]'}`}>
                {isUploading ? "Uploading..." : "Post Now"}
              </button>
            </form>
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[#2F3136] p-8 rounded-2xl border border-[#202225] text-center">
              <div className="w-20 h-20 bg-[#003366] text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-3xl border-4 border-[#2F3136] shadow-xl">
                {user.email[0].toUpperCase()}
              </div>
              <h2 className="font-bold text-xl text-white">{user.displayName || "NUST Student"}</h2>
              <p className="text-sm text-gray-400">{user.email}</p>
              <div className="flex justify-center gap-1 mt-3">
                 {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#FEE75C" className="text-[#FEE75C]"/>)}
              </div>
            </div>

            <h3 className="font-bold text-gray-400 uppercase text-xs px-2">My Listings</h3>
            {listings.filter(i => i.seller === user.email).length === 0 ? (
               <p className="text-gray-500 text-center text-sm py-4">No active listings.</p>
            ) : (
               listings.filter(i => i.seller === user.email).map(item => (
                <div key={item.id} className="bg-[#2F3136] p-4 rounded-xl border border-[#202225] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <img src={item.image} className="w-12 h-12 rounded bg-[#202225] object-cover" />
                    <p className="font-bold text-white">{item.name}</p>
                  </div>
                  <button className="text-gray-500 hover:text-red-500"><Trash2 size={18}/></button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* CHAT OVERLAY */}
      {activeChat && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col justify-end md:justify-center md:items-center">
          <div className="bg-[#2F3136] w-full md:w-[500px] md:rounded-2xl rounded-t-[32px] h-[90vh] md:h-[600px] flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#202225] md:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#003366] rounded-full flex items-center justify-center text-white"><User size={20}/></div>
                <div>
                  <h3 className="font-bold text-white text-sm">{activeChat.name}</h3>
                  <p className="text-xs text-[#57F287]">Online</p>
                </div>
              </div>
              <div className="flex gap-2">
                 {/* Rating Button */}
                 <button onClick={() => handleRateUser(activeChat.seller)} className="p-2 bg-[#FEE75C]/10 text-[#FEE75C] rounded-full hover:bg-[#FEE75C]/20" title="Rate Seller">
                   <Star size={18}/>
                 </button>
                 <button onClick={() => setActiveChat(null)} className="p-2 bg-white/5 text-gray-400 rounded-full hover:text-white"><X size={20}/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#36393F]">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${
                    m.sender === "System" ? 'bg-blue-500/10 text-blue-400 italic text-center w-full border border-blue-500/20' : 
                    m.sender === user.email ? 'bg-[#003366] text-white rounded-tr-none' : 
                    'bg-[#2F3136] text-gray-200 border border-white/5 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="p-4 bg-[#202225] flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} className="flex-1 bg-[#2F3136] text-white rounded-full px-5 text-sm h-12 outline-none border border-transparent focus:border-[#003366]" placeholder="Type a message..." />
              <button className="p-3 rounded-full bg-[#003366] text-white hover:bg-[#004488] transition-colors"><Send size={20}/></button>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-[#202225]/90 backdrop-blur-md shadow-2xl rounded-full p-2 flex justify-around border border-white/10 z-50">
        <NavBtn icon={ShoppingBag} active={view === 'market'} onClick={() => setView('market')} />
        <NavBtn icon={Mail} active={view === 'inbox'} onClick={() => setView('inbox')} />
        <NavBtn icon={ClipboardList} active={view === 'requests'} onClick={() => setView('requests')} />
        <NavBtn icon={PlusCircle} active={view === 'post'} onClick={() => setView('post')} />
        <NavBtn icon={User} active={view === 'profile'} onClick={() => setView('profile')} />
      </div>
    </div>
  );
}

const NavBtn = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-4 rounded-full transition-all duration-300 ${active ? 'bg-[#003366] text-white shadow-lg -translate-y-2' : 'text-gray-500 hover:text-gray-300'}`}>
    <Icon size={20}/>
  </button>
);

export default App;