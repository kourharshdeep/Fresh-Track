import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Info, Bell, AlertOctagon, Flame } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get-alerts`);
      setAlerts(res.data);
      // Trigger notifications for new expiring soon / outside items
      triggerBrowserNotifications(res.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const triggerBrowserNotifications = (alertList) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showNotifications(alertList);
        }
      });
    } else if (Notification.permission === 'granted') {
      showNotifications(alertList);
    }
  };

  const showNotifications = (alertList) => {
    // Read from sessionStorage to avoid spamming the user in the same session
    const notified = JSON.parse(sessionStorage.getItem('freshtrack_notified_alerts') || '[]');
    const newNotified = [...notified];

    alertList.forEach(alert => {
      // If we haven't notified for this specific item in this session
      if (!notified.includes(alert.id)) {
        let title = "FreshTrack Alert";
        let body = alert.message || `Your ${alert.item_name} is expiring soon!`;
        
        if (alert.alert_type === 'outside') {
          title = "⚠️ Food Stored Outside!";
        } else if (alert.alert_type === 'expired_on_entry') {
          title = "🚨 Food Expired on Entry!";
        } else if (alert.alert_type === 'red') {
          title = "🚨 Food Expiring Immediately!";
        }

        try {
          new Notification(title, {
            body: body
          });
          newNotified.push(alert.id);
        } catch (e) {
          console.error("Failed to show browser notification:", e);
        }
      }
    });

    sessionStorage.setItem('freshtrack_notified_alerts', JSON.stringify(newNotified));
  };

  const getAlertStyles = (type) => {
    switch (type) {
      case 'outside':
        return {
          card: 'bg-orange-50 border-orange-500 text-orange-900',
          icon: <AlertTriangle className="w-8 h-8 mr-4 text-orange-500 flex-shrink-0" />
        };
      case 'expired_on_entry':
        return {
          card: 'bg-red-100 border-red-600 text-red-950 font-semibold',
          icon: <AlertOctagon className="w-8 h-8 mr-4 text-red-600 flex-shrink-0 animate-bounce" />
        };
      case 'red':
        return {
          card: 'bg-red-50 border-red-500 text-red-900',
          icon: <Flame className="w-8 h-8 mr-4 text-red-500 flex-shrink-0 animate-pulse" />
        };
      case 'yellow':
      default:
        return {
          card: 'bg-yellow-50 border-yellow-500 text-yellow-900',
          icon: <AlertTriangle className="w-8 h-8 mr-4 text-yellow-500 flex-shrink-0" />
        };
    }
  };

  if (loading) return <div className="text-center py-12 text-lg text-gray-600">Loading alerts...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-oliveGreen tracking-tight">Expiry & Storage Alerts</h2>
          <p className="text-sm text-gray-500">Real-time alerts for highly perishable items stored outside, expired on entry, or expiring soon.</p>
        </div>
        
        {/* Enable Notification Button */}
        {('Notification' in window) && Notification.permission !== 'granted' && (
          <button 
            onClick={() => Notification.requestPermission().then(p => { if (p === 'granted') alert('Notifications enabled!') })}
            className="flex items-center bg-oliveGreen text-white px-4 py-2 rounded-full text-xs font-bold shadow hover:bg-opacity-90 transition-all cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 mr-1.5 animate-bounce" /> Enable Browser Notifications
          </button>
        )}
      </div>
      
      {alerts.length === 0 ? (
        <div className="bg-green-50 text-green-700 p-8 rounded-3xl flex items-center shadow-sm border border-green-200">
          <Info className="mr-4 w-8 h-8 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold">All clean! No warnings detected.</p>
            <p className="text-sm text-green-600">All inventory items are stored appropriately and have good remaining shelf life.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, idx) => {
            const styles = getAlertStyles(alert.alert_type);
            return (
              <div 
                key={idx} 
                className={`p-6 rounded-2xl shadow-sm flex items-center justify-between border-l-4 transition-all hover:shadow-md ${styles.card}`}
              >
                <div className="flex items-center">
                  {styles.icon}
                  <div>
                    <h3 className="font-extrabold text-lg capitalize tracking-tight">{alert.item_name}</h3>
                    <p className="text-sm leading-relaxed opacity-90 mt-0.5">
                      {alert.message || `Expires in ${alert.days_remaining} day${alert.days_remaining !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                
                {/* Visual badge indicator */}
                <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-wider bg-white bg-opacity-65 px-2.5 py-1 rounded-full text-gray-700 border border-gray-100">
                  {alert.alert_type}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Alerts;
