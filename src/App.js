import React, { useState, useEffect } from 'react';
import { ShoppingBag, PlusCircle, LogOut, User, ClipboardList, Send, Trash2, MessageCircle, X, Mail } from 'lucide-react';
import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest,
  resendVerificationLink, sendMessage, listenToMessages, getPublicProfile 
} from './firebaseFunctions';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  
  // States for Inbox
  const [myChats, setMyChats] = useState({});

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [reqText, setReqText] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const unsubscribe = authStateListener((u) => setUser(u));
    refreshData();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeChat) {
      const unsubscribe = listenToMessages(activeChat.id, (msgs) => setChatMessages(msgs));
      return () => unsubscribe();
    }
  }, [activeChat]);

  const refreshData = async () => {
    const items = await getListings();
    const reqs = await getRequests();
    setListings(items || []);
    setRequests(reqs || []);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      await sendMessage(activeChat.id, user.email, newMsg);
      if (chatMessages.length === 0) {
        await sendMessage(activeChat.id, "System", "💡 Tip: Exchange WhatsApp for faster chat!");
        const sellerProfile = await getPublicProfile(activeChat.seller);
        if (sellerProfile?.whatsapp) {
          window.open(`https://wa.me/${sellerProfile.whatsapp}?text=Interested in ${activeChat.name}`, '_blank');
        }
      }
      setNewMsg('');
    } catch (err) { alert(err.message); }
  };

  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-red-700">
          <h1 className="text-2xl font-black text-red-700 mb-6 italic uppercase">NUST Market</h1>
          {user ? (
            <div className="space-y-4">
              <p className="text-sm font-bold bg-yellow-50 p-4 rounded-xl">Verify: {user.email}</p>
              <button onClick={() => resendVerificationLink()} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold">Resend Link</button>
              <button onClick={logoutUser} className="w-full border p-3 rounded-xl text-slate-400 font-bold">Back</button>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (isLogin) await loginUser(email, password);
                else {
                  await signUpUser(email, password, { name, whatsapp: phone });
                  await resendVerificationLink();
                  alert("Verify your email!");
                }
              } catch (err) { alert(err.message); }
            }} className="space-y-4 text-left">
              {!isLogin && (
                <>
                  <input className="w-full border p-3 rounded-xl" placeholder="Full Name" onChange={e => setName(e.target.value)} required />
                  <input className="w-full border p-3 rounded-xl" placeholder="WhatsApp Number" onChange={e => setPhone(e.target.value)} required />
                </>
              )}
              <input className="w-full border p-3 rounded-xl" type="email" placeholder="seecs@seecs.edu.pk" onChange={e => setEmail(e.target.value)} required />
              <input className="w-full border p-3 rounded-xl" type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} required />
              <button className="w-full bg-red-700 text-white p-3 rounded-xl font-bold">{isLogin ? "Login" : "Sign Up"}</button>
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs text-slate-500 underline text-center">Switch to {isLogin ? 'Sign Up' : 'Login'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center font-bold italic">
        <span>NUST MARKET</span>
        <button onClick={logoutUser}><LogOut size={20}/></button>
      </nav>

      <div className="p-4 max-w-md mx-auto">
        {view === 'market' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold italic uppercase">Marketplace</h2>
            {listings.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex gap-4 items-center">
                <img src={item.image} className="w-20 h-20 object-cover rounded-xl" alt="item" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{item.name}</h3>
                  <p className="text-red-700 font-black">Rs. {item.price}</p>
                  <p className="text-[10px] text-slate-400">By: {item.sellerName || "SEECS Student"}</p>
                </div>
                {item.seller !== user.email ? (
                  <button onClick={() => setActiveChat(item)} className="bg-slate-100 p-3 rounded-full text-slate-600"><MessageCircle size={20}/></button>
                ) : (
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-400 font-bold uppercase">My Ad</span>
                )}
              </div>
            ))}
          </div>
        )}

        {view === 'inbox' && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold italic uppercase">Messages</h2>
             <p className="text-xs text-slate-400">Click a listing in the Market to start a chat!</p>
             {listings.filter(item => item.seller === user.email || item.buyer === user.email).length === 0 && (
               <div className="text-center py-10 text-slate-400 text-sm italic">No active conversations yet.</div>
             )}
             {/* Inbox Logic: Shows items you are selling that have chats */}
             {listings.map(item => {
               if (item.seller === user.email) {
                 return (
                   <div key={item.id} onClick={() => setActiveChat(item)} className="bg-white p-4 rounded-2xl border flex justify-between items-center cursor-pointer shadow-sm">
                     <div className="flex items-center gap-3">
                       <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                       <div>
                         <p className="text-sm font-bold">Chat for: {item.name}</p>
                         <p className="text-[10px] text-slate-400">Check for new messages from buyers</p>
                       </div>
                     </div>
                     <MessageCircle size={18} className="text-red-700" />
                   </div>
                 )
               }
               return null;
             })}
          </div>
        )}

        {view === 'requests' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold italic uppercase">Requests</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await createRequest({ text: reqText, user: user.email });
              setReqText(''); refreshData();
            }} className="bg-white p-4 rounded-xl shadow border flex gap-2">
              <input required value={reqText} className="flex-1 text-sm outline-none" placeholder="Need something?" onChange={e => setReqText(e.target.value)} />
              <button className="bg-red-700 text-white p-2 rounded-lg"><Send size={16}/></button>
            </form>
            {requests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border-l-4 border-l-red-700 shadow-sm p-4 text-sm font-medium">{req.text}</div>
            ))}
          </div>
        )}

        {view === 'post' && (
          <form onSubmit={async (e) => {
             e.preventDefault();
             await createListing({ name: itemName, price, image: imageUrl, seller: user.email, sellerName: name });
             setView('market'); refreshData();
          }} className="bg-white p-6 rounded-3xl shadow-lg space-y-4">
            <h2 className="text-xl font-bold italic uppercase text-center">Post Ad</h2>
            <input required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Item Name" onChange={e => setItemName(e.target.value)} />
            <input required className="w-full border p-3 rounded-xl bg-slate-50" type="number" placeholder="Price" onChange={e => setPrice(e.target.value)} />
            <input required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Image Link" onChange={e => setImageUrl(e.target.value)} />
            <button className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black">POST NOW</button>
          </form>
        )}
      </div>

      {activeChat && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex flex-col justify-end">
          <div className="bg-white rounded-t-[32px] h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase italic">{activeChat.name}</h3>
              <button onClick={() => setActiveChat(null)}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm ${m.sender === "System" ? 'bg-blue-50 text-blue-600 italic text-center w-full' : m.sender === user.email ? 'bg-red-700 text-white' : 'bg-white border'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="p-4 border-t flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} className="flex-1 bg-slate-100 rounded-full px-4 text-sm outline-none" placeholder="Message..." />
              <button className="bg-red-700 text-white p-3 rounded-full"><Send size={18}/></button>
            </form>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-white/90 backdrop-blur shadow-2xl rounded-full p-2 flex justify-around border z-50">
        <button onClick={() => setView('market')} className={`p-4 rounded-full ${view === 'market' ? 'bg-red-700 text-white' : 'text-slate-400'}`}><ShoppingBag/></button>
        <button onClick={() => setView('inbox')} className={`p-4 rounded-full ${view === 'inbox' ? 'bg-red-700 text-white' : 'text-slate-400'}`}><Mail/></button>
        <button onClick={() => setView('requests')} className={`p-4 rounded-full ${view === 'requests' ? 'bg-red-700 text-white' : 'text-slate-400'}`}><ClipboardList/></button>
        <button onClick={() => setView('post')} className={`p-4 rounded-full ${view === 'post' ? 'bg-red-700 text-white' : 'text-slate-400'}`}><PlusCircle/></button>
      </div>
    </div>
  );
}

export default App;