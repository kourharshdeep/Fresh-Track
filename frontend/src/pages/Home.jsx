import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, Camera, Image as ImageIcon, Video, Square, AlertTriangle } from 'lucide-react';

const API_BASE = 'https://kourharshdeep-fresh-track-backend.hf.space';
const WS_BASE = 'wss://kourharshdeep-fresh-track-backend.hf.space';

function Home() {
  const [mode, setMode] = useState('upload'); // 'upload' or 'camera'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [added, setAdded] = useState(false);

  // Custom Form State for Detected Items
  const [formItems, setFormItems] = useState([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Pre-populate forms when items are detected
  useEffect(() => {
    if (result && result.detected_items) {
      const items = result.detected_items.map((item, idx) => {
        const name = item.item_name.toLowerCase();
        // Auto check is_perishable for milk, meat, fish, cooked food
        const isPerishable = ['milk', 'meat', 'fish', 'cooked food', 'cooked'].some(kw => name.includes(kw));
        return {
          id: idx,
          item_name: item.item_name,
          quantity: 1,
          confidence_score: item.confidence,
          storage_location: 'fridge',
          days_already_stored: 0,
          is_perishable: isPerishable
        };
      });
      setFormItems(items);
    } else {
      setFormItems([]);
    }
  }, [result]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setResult(null);
      setAdded(false);

      wsRef.current = new WebSocket(`${WS_BASE}/ws/track`);
      
      wsRef.current.onopen = () => {
        intervalRef.current = setInterval(() => {
          if (videoRef.current && canvasRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) return;
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.8);
            wsRef.current.send(base64Data);
          }
        }, 1000);
      };

      wsRef.current.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.annotated_image && data.detected_items) {
    // only update preview image while editing
    setResult((prev) => {
      if (prev && formItems.length > 0) {
        return {
          ...prev,
          annotated_image: data.annotated_image
        };
      }

      return data;
    });

    setAdded(false);
  }
};
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access the camera.");
    }
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setResult(null);
    setAdded(false);
    if (newMode === 'upload') {
      stopCamera();
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setAdded(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/upload-image`, formData);
      setResult(res.data);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to process image.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormItem = (id, field, value) => {
    setFormItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAddToInventory = async () => {
    if (formItems.length === 0) return;
    setLoading(true);
    
    const climateZone = localStorage.getItem('freshtrack_climate') || 'moderate';
    
    try {
      await Promise.all(formItems.map(item => {
        const payload = {
          item_name: item.item_name,
          quantity: item.quantity,
          confidence_score: item.confidence_score,
          storage_location: item.storage_location,
          days_already_stored: item.days_already_stored,
          is_perishable: item.is_perishable,
          climate_zone: climateZone
        };
        return axios.post(`${API_BASE}/add-to-inventory`, payload);
      }));
      
      setAdded(true);
      if (mode === 'camera') {
        stopCamera();
      }
    } catch (error) {
      console.error('Failed to add inventory:', error);
      alert('Failed to add items to inventory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="bg-creamWhite p-8 rounded-3xl shadow-xl w-full max-w-2xl text-center border border-warmBeige">
        <h2 className="text-3xl font-black text-oliveGreen mb-2">Scan Your Food</h2>
        <p className="text-sm text-gray-500 mb-6">Capture or upload an image of food items to automatically detect and customize inventory parameters.</p>
        
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6 space-x-4">
          <button 
            onClick={() => handleModeSwitch('upload')} 
            className={`flex items-center px-6 py-2 rounded-full font-bold transition-all shadow-sm ${mode === 'upload' ? 'bg-oliveGreen text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <ImageIcon className="w-4 h-4 mr-2" /> Upload
          </button>
          <button 
            onClick={() => handleModeSwitch('camera')} 
            className={`flex items-center px-6 py-2 rounded-full font-bold transition-all shadow-sm ${mode === 'camera' ? 'bg-oliveGreen text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Video className="w-4 h-4 mr-2" /> Live Camera
          </button>
        </div>

        {mode === 'upload' ? (
          <>
            <div className="mb-8 border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:bg-gray-50 hover:border-oliveGreen transition-all cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud className="w-16 h-16 text-terracotta mb-4 animate-bounce" />
                <span className="text-lg text-gray-700 font-bold">Click to upload or capture image</span>
                <span className="text-xs text-gray-400 mt-1">Supports PNG, JPG, JPEG</span>
              </label>
            </div>

            {preview && !result && (
              <div className="mb-6">
                <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-2xl shadow-md border-4 border-white" />
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="mt-6 bg-oliveGreen text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Analyze Image'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mb-6 border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[300px] bg-gray-50">
            <canvas ref={canvasRef} className="hidden" />
            <video ref={videoRef} autoPlay playsInline muted className={`max-h-64 mx-auto rounded-2xl shadow-md border-4 border-white mb-4 ${cameraActive ? 'block' : 'hidden'}`} />

            {!cameraActive ? (
              <button onClick={startCamera} className="bg-oliveGreen text-white px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition-all flex items-center shadow-lg">
                <Camera className="mr-2 w-5 h-5" /> Start Camera
              </button>
            ) : (
              <button onClick={stopCamera} className="mt-4 bg-terracotta text-white px-6 py-2 rounded-full font-bold hover:bg-opacity-90 transition-all flex items-center shadow-md">
                <Square className="mr-2 w-4 h-4" /> Stop Camera
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="mt-8 border-t border-gray-200 pt-8 text-left">
            <h3 className="text-2xl font-black text-center text-oliveGreen mb-6">Analysis Results</h3>
            {result.detected_items.length === 0 ? (
              <p className="text-red-500 bg-red-50 p-4 rounded-xl font-semibold text-center border border-red-200">No food items detected. Try a clearer image or adjust camera angles.</p>
            ) : (
              <div>
                <img src={result.annotated_image} alt="Detected" className="max-h-64 mx-auto rounded-2xl shadow-md border-4 border-white mb-8" />
                
                {/* Custom Configuration Form */}
                <h4 className="font-extrabold text-lg text-gray-700 mb-4 text-center">Customize Detected Items</h4>
                <div className="space-y-6 max-w-xl mx-auto mb-8">
                  {formItems.map((item) => (
                    <div key={item.id} className="p-5 bg-white border border-warmBeige rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                        <span className="font-extrabold text-lg text-gray-800 capitalize">{item.item_name}</span>
                        <span className="text-xs bg-oliveGreen bg-opacity-10 text-oliveGreen font-bold px-2.5 py-0.5 rounded-full">
                          {(item.confidence_score * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Storage Location</label>
                          <select
                            value={item.storage_location}
                            onChange={(e) => updateFormItem(item.id, 'storage_location', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-oliveGreen transition-all"
                          >
                            <option value="fridge">🧊 Fridge</option>
                            <option value="freezer">❄️ Freezer</option>
                            <option value="pantry">📦 Pantry</option>
                            <option value="countertop">🍽️ Countertop</option>
                            <option value="outside">☀️ Outside (Room Temp)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Days Stored Already</label>
                          <input
                            type="number"
                            min="0"
                            value={item.days_already_stored}
                            onChange={(e) => updateFormItem(item.id, 'days_already_stored', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-oliveGreen transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateFormItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-oliveGreen transition-all"
                          />
                        </div>

                        <div className="flex items-center space-x-2 mt-4 sm:col-span-2">
                          <input
                            type="checkbox"
                            id={`perish-${item.id}`}
                            checked={item.is_perishable}
                            onChange={(e) => updateFormItem(item.id, 'is_perishable', e.target.checked)}
                            className="w-4 h-4 text-oliveGreen border-gray-300 rounded focus:ring-oliveGreen cursor-pointer"
                          />
                          <label htmlFor={`perish-${item.id}`} className="text-xs font-bold text-gray-500 select-none cursor-pointer">
                            Is Highly Perishable? (milk, meat, fish, cooked food)
                          </label>
                        </div>
                      </div>

                      {item.storage_location === 'outside' && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-orange-700 leading-tight">
                            ⚠️ Storing outside Room Temp degrades shelf-life significantly. Highly perishable items spoil after Day 1.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!added ? (
                  <div className="text-center">
                    <button
                      onClick={handleAddToInventory}
                      disabled={loading}
                      className="bg-terracotta text-white px-10 py-3.5 rounded-full font-bold hover:bg-opacity-90 transition-all shadow-xl hover:shadow-2xl cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Adding to Inventory...' : 'Add All to Inventory'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 max-w-xl mx-auto flex items-center justify-center text-green-700 font-bold text-lg shadow-sm">
                    <CheckCircle className="mr-2 text-green-500 w-6 h-6 animate-pulse" /> All items successfully added to inventory!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
