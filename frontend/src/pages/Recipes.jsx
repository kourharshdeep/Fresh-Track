import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChefHat } from 'lucide-react';

const API_BASE = 'https://kourharshdeep-fresh-track-backend.hf.space';

function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const res = await axios.get(`${API_BASE}/get-recipes`);
        setRecipes(res.data);
      } catch (error) {
        console.error('Failed to fetch recipes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, []);

  if (loading) return <div className="text-center py-12 text-lg text-gray-600">Loading recipes...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-oliveGreen mb-8">Recipe Suggestions</h2>
      <p className="text-gray-600 mb-8 text-lg">Based on what you currently have in your inventory:</p>
      
      {recipes.length === 0 ? (
        <div className="bg-creamWhite p-8 rounded-xl shadow-sm text-center">
          <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-500">Not enough ingredients to suggest a recipe. Try adding more items!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe, idx) => (
            <div key={idx} className="bg-creamWhite rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-warmBeige">
              <div className="bg-terracotta text-white p-4">
                <h3 className="font-bold text-xl">{recipe.name}</h3>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-oliveGreen mb-2 text-sm uppercase tracking-wider">Key Ingredients</h4>
                  <div className="flex flex-wrap gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="bg-warmBeige px-2 py-1 rounded text-sm text-gray-700 capitalize">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-oliveGreen mb-2 text-sm uppercase tracking-wider">Instructions</h4>
                  <p className="text-gray-700 leading-relaxed">{recipe.instructions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Recipes;
