import React, { useState, useEffect } from 'react';
import { ShoppingBag, PlusCircle, LogOut, Link as LinkIcon, MessageSquare, ClipboardList, Send } from 'lucide-react';
import { 
  authStateListener, logoutUser, loginUser, signUpUser, 
  getListings, createListing, getRequests, createRequest 
} from './firebaseFunctions';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

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

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) { await loginUser(email, password); } 
      else { await signUpUser(email, password, { name: "NUST Student" }); }
    } catch (err) { alert(err.message); }
  };

  const handlePost = async (e) => {
    if (e) e.preventDefault(); // Prevents page reload
    setLoading(true);
    
    try {
      const listingData = {
        name: itemName,
        price: price,
        image: imageUrl || "https://via.placeholder.com/150",
        seller: user.email,
        type: 'Sell'
      };

      await createListing(listingData);
      
      alert("🎉 Success! Item is now live.");
      
      // Reset fields
      setItemName(''); setPrice(''); setImageUrl('');
      
      // GO BACK TO HOME
      setView('market');
      refreshData();
    } catch (err) {
      alert("Post Failed: " + err.message);
    } finally {
      setLoading(false);
    }
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-red-700 text-center">
          <h1 className="text-2xl font-black text-red-700 mb-6 tracking-tighter uppercase italic">NUST Market</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input className="w-full border p-3 rounded-xl outline-none" type="email" placeholder="NUST Email" onChange={e => setEmail(e.target.value)} required />
            <input className="w-full border p-3 rounded-xl outline-none" type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} required />
            <button className="w-full bg-red-700 text-white p-3 rounded-xl font-bold">{isLogin ? "Login" : "Sign Up"}</button>
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-xs text-slate-500 underline">Switch to {isLogin ? 'Sign Up' : 'Login'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg font-bold italic tracking-tighter">
        <span>NUST MARKET</span>
        <button onClick={logoutUser} title="Logout" className="bg-white/20 p-2 rounded-lg"><LogOut size={20}/></button>
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
              <button title="Send Request" className="bg-red-700 text-white p-2 rounded-lg"><Send size={16}/></button>
            </form>
            {requests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border-l-4 border-l-red-700 shadow-sm">
                <p className="text-sm font-medium text-slate-700">{req.text}</p>
                <p className="text-[10px] text-gray-400 mt-2">Requested by: {req.user}</p>
              </div>
            ))}
          </div>
        )}

        {view === 'post' && (
          <form onSubmit={handlePost} className="bg-white p-6 rounded-3xl shadow-lg border space-y-4">
            <h2 className="text-2xl font-black italic text-slate-800 uppercase tracking-tighter">New Listing</h2>
            <input required value={itemName} className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Item Name" onChange={e => setItemName(e.target.value)} />
            <input required value={price} type="number" className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Price (PKR)" onChange={e => setPrice(e.target.value)} />
            <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Image Link</label>
              <input required value={imageUrl} className="w-full bg-transparent outline-none text-sm pt-1" placeholder="Paste link (right-click image -> Copy Address)" onChange={e => setImageUrl(e.target.value)} />
            </div>
            <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform">
              {loading ? "Syncing..." : "Launch Listing"}
            </button>
          </form>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xs bg-white/90 backdrop-blur shadow-2xl rounded-full p-2 flex justify-around border border-slate-200 z-50">
        <button onClick={() => setView('market')} title="Browse Marketplace" className={`p-4 rounded-full transition-all ${view === 'market' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><ShoppingBag/></button>
        <button onClick={() => setView('requests')} title="View Requests" className={`p-4 rounded-full transition-all ${view === 'requests' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><ClipboardList/></button>
        <button onClick={() => setView('post')} title="Post an Item" className={`p-4 rounded-full transition-all ${view === 'post' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle/></button>
      </div>
    </div>
  );
}

export default App;