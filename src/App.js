import React, { useState, useEffect } from 'react';
import { ShoppingBag, PlusCircle, LogOut, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { authStateListener, logoutUser, loginUser, signUpUser, getListings, createListing } from './firebaseFunctions';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); 
  const [listings, setListings] = useState([]);
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const unsubscribe = authStateListener((u) => setUser(u));
    fetchItems();
    return () => unsubscribe();
  }, []);

  const fetchItems = async () => {
    const data = await getListings();
    setListings(data || []);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) { await loginUser(email, password); } 
      else { await signUpUser(email, password, { name: "NUST Student" }); }
    } catch (err) { alert(err.message); }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    try {
      await createListing({
        name: itemName,
        price: price,
        image: imageUrl || "https://via.placeholder.com/150",
        seller: user.email,
        createdAt: new Date()
      });
      alert("Success! Item is live.");
      setView('market');
      fetchItems();
    } catch (err) { alert("Error: " + err.message); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-red-700">
          <h1 className="text-2xl font-black text-red-700 mb-6 text-center tracking-tighter">NUST MARKET</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-700" type="email" placeholder="NUST Email" onChange={e => setEmail(e.target.value)} />
            <input className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-700" type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
            <button className="w-full bg-red-700 text-white p-3 rounded-xl font-bold">Enter</button>
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs text-slate-500 underline text-center">
              {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg">
        <span className="font-black italic tracking-tighter">NUST MARKET</span>
        <button onClick={logoutUser} className="bg-white/20 p-2 rounded-lg"><LogOut size={20}/></button>
      </nav>

      <div className="p-4 max-w-md mx-auto">
        {view === 'market' ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Current Listings</h2>
            {listings.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex gap-4 transition-all hover:shadow-md">
                <img src={item.image} className="w-24 h-24 object-cover rounded-xl bg-slate-100" alt="item" />
                <div className="flex flex-col justify-center">
                  <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                  <p className="text-red-700 font-black text-xl italic">Rs. {item.price}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handlePost} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 space-y-4">
            <h2 className="text-2xl font-black italic text-slate-800">POST NEW ITEM</h2>
            <input required className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-red-700" placeholder="Item Name" onChange={e => setItemName(e.target.value)} />
            <input required className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-red-700" placeholder="Price (PKR)" onChange={e => setPrice(e.target.value)} />
            <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Image Link</label>
              <div className="flex items-center gap-2 pt-1">
                <LinkIcon size={14} className="text-slate-400"/>
                <input required className="w-full bg-transparent outline-none text-sm" placeholder="Paste link here..." onChange={e => setImageUrl(e.target.value)} />
              </div>
            </div>
            <button className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform">List Item Now</button>
          </form>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[80%] max-w-xs bg-white/90 backdrop-blur shadow-2xl rounded-full p-2 flex justify-around border border-slate-200">
        <button onClick={() => setView('market')} className={`p-3 rounded-full transition-colors ${view === 'market' ? 'bg-red-700 text-white shadow-lg shadow-red-200' : 'text-slate-400 hover:text-red-700'}`}><ShoppingBag size={24}/></button>
        <button onClick={() => setView('post')} className={`p-3 rounded-full transition-colors ${view === 'post' ? 'bg-red-700 text-white shadow-lg shadow-red-200' : 'text-slate-400 hover:text-red-700'}`}><PlusCircle size={24}/></button>
      </div>
    </div>
  );
}

export default App;