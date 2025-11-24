import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export const usePushNotifications = () => {
  const { isAdmin } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    // Request permission for admin users
    if (isAdmin && isSupported && permission === 'default') {
      requestPermission();
    }
  }, [isAdmin, isSupported, permission]);

  const requestPermission = async () => {
    if (!isSupported) {
      console.log('Push notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        console.log('Notification permission granted');
        
        // Register service worker if not already registered
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          console.log('Service Worker is ready:', registration);
        }
      }
      
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const sendNotification = async (title: string, body: string, url?: string) => {
    if (!isSupported || permission !== 'granted') {
      return false;
    }

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NEW_GD_ENTRY',
          title,
          body,
          url: url || '/'
        });
        return true;
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  };

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification
  };
};
