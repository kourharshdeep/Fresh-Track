import React from 'react';
import { Trash2, ThumbsUp, ThumbsDown, AlertTriangle, Calendar, Clock, Inbox, ShieldCheck } from 'lucide-react';

const EMOJI_MAP = {
  'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'carrot': '🥕', 
  'broccoli': '🥦', 'pizza': '🍕', 'sandwich': '🥪', 'hot dog': '🌭', 
  'cake': '🍰', 'donut': '🍩', 'bread': '🍞', 'milk': '🥛', 'eggs': '🥚',
  'meat': '🥩', 'fish': '🐟', 'cooked food': '🥘', 'cooked': '🥘', 'chicken': '🍗',
  'pork': '🥩', 'beef': '🥩', 'cheese': '🧀', 'yogurt': '🥛', 'butter': '🧈'
};

const STORAGE_MAP = {
  'fridge': { icon: '🧊', label: 'Fridge' },
  'freezer': { icon: '❄️', label: 'Freezer' },
  'pantry': { icon: '📦', label: 'Pantry' },
  'countertop': { icon: '🍽️', label: 'Countertop' },
  'outside': { icon: '☀️', label: 'Outside / Room Temp' }
};

function FoodCard({ item, onRemove, onFeedback }) {
  const daysRemaining = item.remaining_days;
  const status = item.status;
  
  let statusColor = 'bg-green-100 text-green-800 border-green-200';
  let badgeText = '🟢 Fresh';
  
  if (status === 'expired') {
    statusColor = 'bg-gray-800 text-white border-gray-900';
    badgeText = '⚫ Expired';
  } else if (status === 'use_immediately') {
    statusColor = 'bg-red-100 text-red-800 border-red-200 animate-pulse';
    badgeText = '🔴 Use Immediately';
  } else if (status === 'expiring_soon') {
    statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    badgeText = '🟡 Expiring Soon';
  }

  const emoji = EMOJI_MAP[item.item_name.toLowerCase()] || '🥘';
  const storageInfo = STORAGE_MAP[item.storage_location?.toLowerCase()] || { icon: '📦', label: item.storage_location || 'Stored' };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 border border-warmBeige overflow-hidden flex flex-col hover:-translate-y-1">
      {/* Expiry Status Header Banner */}
      <div className={`px-4 py-2 border-b text-xs font-black tracking-wider flex justify-between items-center ${statusColor}`}>
        <span>{badgeText}</span>
        <span className="opacity-80">Qty: {item.quantity || 1}</span>
      </div>

      <div className="p-6 flex-grow flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className="text-5xl drop-shadow-sm select-none">{emoji}</div>
            <div className="flex items-center space-x-1 bg-gray-100 px-2.5 py-1 rounded-full text-xs font-extrabold text-gray-600 border border-gray-200">
              <span>{storageInfo.icon}</span>
              <span className="capitalize">{storageInfo.label}</span>
            </div>
          </div>
          
          <h3 className="text-2xl font-black text-gray-800 capitalize mb-1 tracking-tight">{item.item_name}</h3>
          
          {/* Timeline metrics */}
          <div className="space-y-2 mt-4 mb-5 border-t border-gray-100 pt-4">
            <div className="flex items-center text-xs text-gray-500 font-semibold justify-between">
              <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" /> Start Date:</span>
              <span className="text-gray-800">{formatDate(item.effective_start_date || item.date_added)}</span>
            </div>
            <div className="flex items-center text-xs text-gray-500 font-semibold justify-between">
              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-gray-400" /> Days Already Stored:</span>
              <span className="text-gray-800 font-extrabold">{item.days_already_stored || 0} days</span>
            </div>
            <div className="flex items-center text-xs text-gray-500 font-semibold justify-between">
              <span className="flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-1 text-gray-400" /> Adjusted Lifespan:</span>
              <span className="text-gray-800 text-right">Expected to last {item.adjusted_shelf_life?.toFixed(0) || 5} days from purchase</span>
            </div>
            <div className="flex items-center text-xs text-gray-500 font-semibold justify-between">
              <span className="flex items-center"><Inbox className="w-3.5 h-3.5 mr-1 text-gray-400" /> Predicted Expiry:</span>
              <span className="text-red-600 font-bold">{formatDate(item.predicted_expiry_date)}</span>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        {item.warning && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-start space-x-1.5 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-800 font-bold leading-tight">
              {item.warning}
            </p>
          </div>
        )}

        {/* Dynamic Expiry Days Card */}
        <div className={`rounded-2xl p-4 text-center ${status === 'expired' ? 'bg-gray-100' : 'bg-warmBeige bg-opacity-70 border border-warmBeige border-opacity-60'}`}>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Remaining Duration</p>
          <p className={`text-3xl font-black ${status === 'expired' ? 'text-gray-500' : 'text-oliveGreen'}`}>
            {daysRemaining} <span className="text-sm font-bold uppercase tracking-normal">days</span>
          </p>
        </div>
      </div>
      
      {/* ML Feedback and Removal Bar */}
      <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-between items-center">
        <div className="flex space-x-2">
          <button 
            onClick={() => onFeedback(item.id, 1)}
            title="Model feedback: Still Fresh"
            className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors border border-transparent hover:border-green-200"
          >
            <ThumbsUp className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onFeedback(item.id, -1)}
            title="Model feedback: Expired Early"
            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors border border-transparent hover:border-red-200"
          >
            <ThumbsDown className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={() => onRemove(item.id)}
          className="flex items-center text-sm font-black text-gray-400 hover:text-red-500 transition-colors duration-200"
        >
          <Trash2 className="w-4 h-4 mr-1" /> Remove
        </button>
      </div>
    </div>
  );
}

export default FoodCard;
