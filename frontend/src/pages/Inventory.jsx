import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FoodCard from '../components/FoodCard';

const API_BASE = 'http://localhost:8000';

function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get-inventory`);
      setItems(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleRemove = async (id) => {
    try {
      await axios.delete(`${API_BASE}/remove-item/${id}`);
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const handleFeedback = async (id, score) => {
    try {
      await axios.post(`${API_BASE}/submit-feedback`, {
        item_id: id,
        feedback_score: score
      });
      alert('Feedback submitted! Thank you.');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (loading) return <div className="text-center py-12 text-lg text-gray-600">Loading inventory...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-oliveGreen mb-8">Your Food Inventory</h2>
      {items.length === 0 ? (
        <p className="text-gray-500 text-center bg-creamWhite p-8 rounded-xl shadow-sm">Your inventory is empty. Start by uploading an image!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map(item => (
            <FoodCard 
              key={item.id} 
              item={item} 
              onRemove={handleRemove}
              onFeedback={handleFeedback}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Inventory;
