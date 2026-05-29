import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Recipes from './pages/Recipes';
import Alerts from './pages/Alerts';
import { Camera, List, ChefHat, Bell, Sun, Cloud, Snowflake, Globe } from 'lucide-react';

function App() {
  const [climate, setClimate] = useState(() => {
    return localStorage.getItem('freshtrack_climate') || '';
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!climate) {
      setShowModal(true);
    }
  }, [climate]);

  const selectClimate = (zone) => {
    localStorage.setItem('freshtrack_climate', zone);
    setClimate(zone);
    setShowModal(false);
    // Reload components if necessary or trigger storage event
    window.dispatchEvent(new Event('storage'));
  };

  const getClimateIcon = (c) => {
    switch (c) {
      case 'hot': return <Sun className="w-4 h-4 text-orange-500 mr-1.5" />;
      case 'moderate': return <Cloud className="w-4 h-4 text-blue-500 mr-1.5" />;
      case 'cold': return <Snowflake className="w-4 h-4 text-teal-500 mr-1.5" />;
      default: return <Globe className="w-4 h-4 text-gray-500 mr-1.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-warmBeige flex flex-col font-sans">
      <nav className="bg-creamWhite shadow-sm sticky top-0 z-40 border-b border-warmBeige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <span className="text-2xl font-black text-oliveGreen tracking-tight">FreshTrack 🥗</span>
              {climate && (
                <button 
                  onClick={() => setShowModal(true)} 
                  className="flex items-center bg-gray-100 hover:bg-gray-200 transition-colors px-3 py-1 rounded-full text-xs font-semibold text-gray-700 border border-gray-200 cursor-pointer"
                  title="Change climate zone setting"
                >
                  {getClimateIcon(climate)}
                  <span className="capitalize">{climate} Climate</span>
                </button>
              )}
            </div>
            
            <div className="flex space-x-8 items-center">
              <div className="flex space-x-6">
                <Link to="/" className="inline-flex items-center px-1 pt-1 text-sm font-semibold text-gray-700 hover:text-terracotta transition-colors duration-200">
                  <Camera className="w-4 h-4 mr-1.5" /> Scan Food
                </Link>
                <Link to="/inventory" className="inline-flex items-center px-1 pt-1 text-sm font-semibold text-gray-700 hover:text-terracotta transition-colors duration-200">
                  <List className="w-4 h-4 mr-1.5" /> Inventory
                </Link>
                <Link to="/alerts" className="inline-flex items-center px-1 pt-1 text-sm font-semibold text-gray-700 hover:text-terracotta transition-colors duration-200">
                  <Bell className="w-4 h-4 mr-1.5" /> Alerts
                </Link>
                <Link to="/recipes" className="inline-flex items-center px-1 pt-1 text-sm font-semibold text-gray-700 hover:text-terracotta transition-colors duration-200">
                  <ChefHat className="w-4 h-4 mr-1.5" /> Recipes
                </Link>
              </div>

              {!climate && (
                <button onClick={() => setShowModal(true)} className="bg-terracotta text-white px-3 py-1 rounded-lg text-xs font-bold shadow hover:bg-opacity-90 transition-all">
                  Choose Climate
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-grow w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/recipes" element={<Recipes />} />
        </Routes>
      </main>

      {/* Climate Selector Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity">
          <div className="bg-creamWhite rounded-3xl max-w-md w-full p-8 shadow-2xl border border-warmBeige transform scale-100 transition-transform">
            <h3 className="text-2xl font-black text-oliveGreen mb-2 text-center">Select Your Local Climate</h3>
            <p className="text-sm text-gray-500 mb-6 text-center leading-relaxed">
              We use your local climate to adjust shelf life calculations and refine our ML predictions.
            </p>
            
            <div className="space-y-4">
              <button 
                onClick={() => selectClimate('hot')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-orange-50 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all group"
              >
                <div className="flex items-center text-left">
                  <Sun className="w-8 h-8 text-orange-500 mr-4 group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="font-bold text-gray-800">Hot Climate</h4>
                    <p className="text-xs text-orange-700">Tropical, arid, or high-temp zones (accelerated degradation)</p>
                  </div>
                </div>
                <span className="text-xl">☀️</span>
              </button>

              <button 
                onClick={() => selectClimate('moderate')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-center text-left">
                  <Cloud className="w-8 h-8 text-blue-400 mr-4 group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="font-bold text-gray-800">Moderate Climate</h4>
                    <p className="text-xs text-blue-700">Temperate or mild zones (standard base shelf life)</p>
                  </div>
                </div>
                <span className="text-xl">🌤️</span>
              </button>

              <button 
                onClick={() => selectClimate('cold')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-teal-50 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition-all group"
              >
                <div className="flex items-center text-left">
                  <Snowflake className="w-8 h-8 text-teal-400 mr-4 group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="font-bold text-gray-800">Cold Climate</h4>
                    <p className="text-xs text-teal-700">Boreal, alpine, or wintry zones (extended shelf life)</p>
                  </div>
                </div>
                <span className="text-xl">❄️</span>
              </button>
            </div>
            
            {climate && (
              <button 
                onClick={() => setShowModal(false)}
                className="mt-6 w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-700 py-2 border-t border-gray-100 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
