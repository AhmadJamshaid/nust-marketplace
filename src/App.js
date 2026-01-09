import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest,
  resendVerificationLink // <-- Must match the name in firebaseFunctions.js
} from './firebaseFunctions';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, PlusCircle, LogOut, User, ClipboardList, Send, Trash2 } from 'lucide-react';
import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest,
  resendVerificationLink // Import the fix
} from './firebaseFunctions';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [reqText, setReqText] = useState('');

  useEffect(() => {
    const unsubscribe = authStateListener((u) => setUser(u));
    refreshData();
    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    const items = await getListings();
    const reqs = await getRequests();
    setListings(items || []);
    setRequests(reqs || []);
  };

  const handleResendEmail = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerificationLink();
      alert("📩 Link Sent! Please check your Inbox AND your Spam/Junk folder.");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setResending(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!isLogin && !email.toLowerCase().endsWith("@seecs.edu.pk")) {
      alert("❌ Only @seecs.edu.pk emails allowed!");
      return;
    }
    try {
      if (isLogin) { 
        await loginUser(email, password); 
      } else { 
        const userCredential = await signUpUser(email, password, { name: "SEECS Student" });
        await resendVerificationLink();
        alert("🚀 Account created! Verify your email to enter.");
      }
    } catch (err) { alert(err.message); }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createListing({
        name: itemName, price: price,
        image: imageUrl || "https://via.placeholder.com/150",
        seller: user.email, type: 'Sell'
      });
      alert("🎉 Item Posted!");
      setItemName(''); setPrice(''); setImageUrl('');
      setView('market');
      refreshData();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    try {
      await createRequest({ text: reqText, user: user.email });
      alert("Request Added!");
      setReqText('');
      refreshData();
    } catch (err) { alert(err.message); }
  };

  const myListings = listings.filter(item => item.seller === user?.email);

  if (!user || (user && !user.emailVerified)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-red-700 text-center">
          <h1 className="text-2xl font-black text-red-700 mb-6 italic uppercase tracking-tighter">NUST Market</h1>
          {user && !user.emailVerified ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-left">
                <p className="text-sm font-bold text-yellow-800">Verify Your Email</p>
                <p className="text-[11px] text-slate-500 mt-1">Sent to: {user.email}</p>
                <p className="text-[10px] bg-yellow-200 p-2 mt-2 rounded font-bold text-yellow-900 uppercase">⚠️ Check Spam Folder!</p>
              </div>
              <button onClick={handleResendEmail} disabled={resending} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-transform">
                {resending ? "Sending..." : "Resend Verification Email"}
              </button>
              <button onClick={logoutUser} className="w-full border p-3 rounded-xl font-bold text-slate-400 text-sm">Back to Login</button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <input className="w-full border p-3 rounded-xl outline-none" type="email" placeholder="seecs@seecs.edu.pk" onChange={e => setEmail(e.target.value)} required />
              <input className="w-full border p-3 rounded-xl outline-none" type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} required />
              <button className="w-full bg-red-700 text-white p-3 rounded-xl font-bold">{isLogin ? "Login" : "Sign Up"}</button>
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-xs text-slate-500 underline">Switch to {isLogin ? 'Sign Up' : 'Login'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg font-bold italic tracking-tighter">
        <span>NUST MARKET</span>
        <button onClick={logoutUser} data-tooltip="Logout" className="bg-white/20 p-2 rounded-lg"><LogOut size={20}/></button>
      </nav>

      <div className="p-4 max-w-md mx-auto">
        {view === 'market' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Marketplace</h2>
            {listings.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex gap-4">
                <img src={item.image} className="w-20 h-20 object-cover rounded-xl bg-slate-100 shadow-inner" alt="item" />
                <div className="flex flex-col justify-center">
                  <h3 className="font-bold text-slate-800 leading-tight">{item.name}</h3>
                  <p className="text-red-700 font-black text-xl tracking-tighter">Rs. {item.price}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'requests' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold italic uppercase tracking-tighter">Requests Board</h2>
            <form onSubmit={handleRequest} className="bg-white p-4 rounded-xl shadow border mb-4 flex gap-2">
              <input required value={reqText} className="flex-1 text-sm outline-none" placeholder="What do you need?" onChange={e => setReqText(e.target.value)} />
              <button data-tooltip="Send Request" className="bg-red-700 text-white p-2 rounded-lg"><Send size={16}/></button>
            </form>
            {requests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border-l-4 border-l-red-700 shadow-sm">
                <p className="text-sm font-medium text-slate-700">{req.text}</p>
                <p className="text-[10px] text-gray-400 mt-2">By: {req.user}</p>
              </div>
            ))}
          </div>
        )}

        {view === 'post' && (
          <form onSubmit={handlePost} className="bg-white p-6 rounded-3xl shadow-lg border space-y-4">
            <h2 className="text-2xl font-black italic text-slate-800 uppercase tracking-tighter">New Listing</h2>
            <input required value={itemName} className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Item Name" onChange={e => setItemName(e.target.value)} />
            <input required value={price} type="number" className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Price (PKR)" onChange={e => setPrice(e.target.value)} />
            <input required value={imageUrl} className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Paste Image Link" onChange={e => setImageUrl(e.target.value)} />
            <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-transform">
              {loading ? "Syncing..." : "Launch Listing"}
            </button>
          </form>
        )}

        {view === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border text-center">
              <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto mb-3 font-black text-xl">
                {user.email[0].toUpperCase()}
              </div>
              <h2 className="font-black text-slate-800 uppercase italic tracking-tighter">My Profile</h2>
              <p className="text-xs text-slate-500">{user.email}</p>
              <span className="inline-block mt-2 bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase italic">SEECS Verified</span>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-bold text-slate-700 px-1">My Listings ({myListings.length})</h3>
              {myListings.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-2xl border flex justify-between items-center shadow-sm">
                  <div className="flex gap-3 items-center">
                    <img src={item.image} className="w-12 h-12 object-cover rounded-lg" alt="item" />
                    <div>
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-red-700 font-bold">Rs. {item.price}</p>
                    </div>
                  </div>
                  <button className="text-slate-300 hover:text-red-600 transition-colors p-2" data-tooltip="Delete"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/90 backdrop-blur shadow-2xl rounded-full p-2 flex justify-around border border-slate-200 z-50">
        <button onClick={() => setView('market')} data-tooltip="Market" className={`p-4 rounded-full ${view === 'market' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><ShoppingBag/></button>
        <button onClick={() => setView('requests')} data-tooltip="Requests" className={`p-4 rounded-full ${view === 'requests' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><ClipboardList/></button>
        <button onClick={() => setView('post')} data-tooltip="Post" className={`p-4 rounded-full ${view === 'post' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle/></button>
        <button onClick={() => setView('profile')} data-tooltip="Profile" className={`p-4 rounded-full ${view === 'profile' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><User/></button>
      </div>
    </div>
  );
}

export default App;