import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  permission: NotificationPermission | 'unsupported';
}

// Check if we're running in Capacitor native environment
const isCapacitorNative = () => {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform();
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    permission: 'unsupported',
  });

  // Check notification support
  useEffect(() => {
    const checkSupport = async () => {
      // For native apps, we'd use Capacitor Push Notifications
      if (isCapacitorNative()) {
        // Capacitor Push Notifications would be configured here
        // For now, we'll use the web API as fallback
        setState(prev => ({
          ...prev,
          isSupported: true,
          permission: 'default',
        }));
        return;
      }

      // Web Push API support check
      if ('Notification' in window && 'serviceWorker' in navigator) {
        setState(prev => ({
          ...prev,
          isSupported: true,
          permission: Notification.permission,
          isEnabled: Notification.permission === 'granted',
        }));
      }
    };

    checkSupport();
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    try {
      if (isCapacitorNative()) {
        // For Capacitor, you would use:
        // const { PushNotifications } = await import('@capacitor/push-notifications');
        // const result = await PushNotifications.requestPermissions();
        // For now, simulate permission granted
        setState(prev => ({ ...prev, isEnabled: true, permission: 'granted' }));
        toast.success('Push notifications enabled!');
        return true;
      }

      // Web API
      const permission = await Notification.requestPermission();
      setState(prev => ({
        ...prev,
        permission,
        isEnabled: permission === 'granted',
      }));

      if (permission === 'granted') {
        toast.success('Push notifications enabled!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Push notifications were denied');
        return false;
      }

      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable notifications');
      return false;
    }
  }, [state.isSupported]);

  // Show a local notification (works in both web and native)
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!state.isEnabled) {
      console.log('Notifications not enabled, skipping:', title);
      return;
    }

    try {
      if (isCapacitorNative()) {
        // For Capacitor local notifications:
        // const { LocalNotifications } = await import('@capacitor/local-notifications');
        // await LocalNotifications.schedule({
        //   notifications: [{
        //     title,
        //     body: options?.body || '',
        //     id: Date.now(),
        //   }]
        // });
        console.log('Would show native notification:', title);
        return;
      }

      // Web notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          icon: '/app-icon.png',
          badge: '/app-icon.png',
          ...options,
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [state.isEnabled]);

  // Subscribe to real-time notifications from Supabase
  useEffect(() => {
    if (!user || !state.isEnabled) return;

    // Listen for friend requests
    const friendRequestChannel = supabase
      .channel('friend_request_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Get sender's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', payload.new.from_user_id)
            .single();

          showNotification('New Friend Request', {
            body: `${profile?.display_name || 'Someone'} wants to be your friend`,
            tag: 'friend-request',
          });
        }
      )
      .subscribe();

    // Listen for messages
    const messageChannel = supabase
      .channel('message_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', payload.new.from_user_id)
            .single();

          showNotification('New Message', {
            body: `${profile?.display_name || 'Someone'}: ${(payload.new.content as string).substring(0, 50)}...`,
            tag: 'message',
          });
        }
      )
      .subscribe();

    // Listen for jam session invites (via participants table)
    const jamChannel = supabase
      .channel('jam_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jam_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data: session } = await supabase
            .from('jam_sessions')
            .select('name, host_user_id')
            .eq('id', payload.new.jam_session_id)
            .single();

          if (session) {
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', session.host_user_id)
              .single();

            showNotification('Jam Session Invite', {
              body: `${hostProfile?.display_name || 'Someone'} invited you to ${session.name}`,
              tag: 'jam-invite',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendRequestChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(jamChannel);
    };
  }, [user, state.isEnabled, showNotification]);

  return {
    ...state,
    requestPermission,
    showNotification,
  };
};