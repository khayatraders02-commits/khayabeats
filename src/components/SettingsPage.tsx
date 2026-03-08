import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, ChevronRight, User, Bell, Shield, FileText, 
  HelpCircle, LogOut, Camera, Moon, Globe, Download, Trash2, Phone, RefreshCw, Clock, Disc3,
  Server, Upload, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useOnboarding } from '@/components/Onboarding';
import { useAudioQuality, AUDIO_QUALITY_OPTIONS } from '@/hooks/useAudioQuality';
import { SleepTimerSheet } from '@/components/SleepTimerSheet';
import { AudioQualitySheet } from '@/components/AudioQualitySheet';
import { useServerStatus } from '@/hooks/useServerStatus';

export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const { isEnabled: notificationsEnabled, requestPermission, isSupported } = usePushNotifications();
  const { resetOnboarding } = useOnboarding();
  const { quality, qualityInfo } = useAudioQuality();
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showAudioQuality, setShowAudioQuality] = useState(false);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const cookieFileRef = useRef<HTMLInputElement>(null);
  const { isOnline, serverUrl, checkServerHealth } = useServerStatus();

  const checkAuthStatus = async () => {
    setCheckingAuth(true);
    try {
      const r = await fetch(`${serverUrl}/auth-status`, { signal: AbortSignal.timeout(8000) });
      const data = await r.json();
      setAuthStatus(data);
    } catch {
      setAuthStatus({ status: 'unreachable' });
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleCookieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      if (!text.includes('youtube.com') && !text.includes('.youtube.com')) {
        toast.error('This doesn\'t look like a YouTube cookies file');
        return;
      }
      const r = await fetch(`${serverUrl}/upload-cookies`, {
        method: 'POST',
        body: text,
      });
      const data = await r.json();
      if (data.success !== false) {
        toast.success('Cookies uploaded! Songs should work now.');
        await checkAuthStatus();
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Failed to upload cookies. Is the server running?');
    } finally {
      setUploading(false);
      if (cookieFileRef.current) cookieFileRef.current.value = '';
    }
  };

  // Load display name from profiles table on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data?.display_name) {
        setDisplayName(data.display_name);
      } else {
        setDisplayName(user.user_metadata?.display_name || user.user_metadata?.full_name || '');
      }
    };
    
    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      // Update profiles table
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      });
      
      if (profileError) throw profileError;
      
      // Also update user metadata for consistency
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      
      if (authError) console.warn('Could not update user metadata:', authError);
      
      toast.success('Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleClearCache = async () => {
    try {
      // Clear localStorage cache
      const keysToKeep = ['khayabeats_audio_quality', 'khayabeats_onboarding_complete'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key) && key.startsWith('khayabeats')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear any IndexedDB offline storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      toast.success('Cache cleared successfully!');
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const SettingItem = ({ 
    icon: Icon, 
    title, 
    subtitle, 
    onClick, 
    rightElement,
    danger 
  }: { 
    icon: React.ElementType; 
    title: string; 
    subtitle?: string; 
    onClick?: () => void; 
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors text-left ${danger ? 'hover:bg-destructive/10' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-destructive/20' : 'bg-primary/10'}`}>
        <Icon size={20} className={danger ? 'text-destructive' : 'text-primary'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${danger ? 'text-destructive' : ''}`}>{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {rightElement || <ChevronRight size={20} className="text-muted-foreground" />}
    </motion.button>
  );

  if (!user) {
    return (
      <div className="text-center py-20">
        <Settings size={48} className="mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to access settings</h2>
        <p className="text-muted-foreground mb-6">Manage your account and preferences</p>
        <Button onClick={() => navigate('/auth')} className="kb-gradient-bg">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-8"
    >
      {/* Profile Header */}
      <div className="text-center mb-8">
        <div className="relative inline-block mb-4">
          <Avatar className="w-24 h-24 border-4 border-primary/20">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="kb-gradient-bg text-2xl text-white">
              {displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <Dialog>
            <DialogTrigger asChild>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Camera size={14} className="text-white" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Email: {user.email}
                </p>
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  className="w-full kb-gradient-bg"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <h1 className="text-xl font-bold">{displayName || 'Music Lover'}</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Account */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Account</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <Dialog>
              <DialogTrigger asChild>
                <div>
                  <SettingItem 
                    icon={User} 
                    title="Edit Profile" 
                    subtitle="Name, photo, and more"
                  />
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayNameEdit">Display Name</Label>
                    <Input
                      id="displayNameEdit"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Email: {user.email}
                  </p>
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="w-full kb-gradient-bg"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Separator className="mx-4" />
            <SettingItem 
              icon={Bell} 
              title="Notifications" 
              subtitle={notificationsEnabled ? "Enabled" : "Disabled"}
              rightElement={
                <Switch 
                  checked={notificationsEnabled} 
                  onCheckedChange={() => !notificationsEnabled && requestPermission()}
                  disabled={!isSupported}
                />
              }
            />
          </div>
        </div>

        {/* Playback */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Playback</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <SettingItem 
              icon={Disc3} 
              title="Audio Quality" 
              subtitle={`${qualityInfo.label} (${qualityInfo.bitrate})`}
              onClick={() => setShowAudioQuality(true)}
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Clock} 
              title="Sleep Timer" 
              subtitle="Auto-pause music after a set time"
              onClick={() => setShowSleepTimer(true)}
            />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Preferences</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <SettingItem 
              icon={Moon} 
              title="Dark Mode" 
              subtitle="Always on"
              rightElement={<Switch defaultChecked disabled />}
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Download} 
              title="Download Quality" 
              subtitle="High (320kbps)"
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Globe} 
              title="Language" 
              subtitle="English"
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={RefreshCw} 
              title="Reset Onboarding" 
              subtitle="Show tutorial again"
              onClick={() => {
                resetOnboarding();
                toast.success('Onboarding reset! Refresh to see it again.');
              }}
            />
          </div>
        </div>

        {/* Storage */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Storage</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <SettingItem 
              icon={Trash2} 
              title="Clear Cache" 
              subtitle="Free up storage space"
              onClick={handleClearCache}
            />
          </div>
        </div>

        {/* Server Management */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Server</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <SettingItem
              icon={Server}
              title="Server Status"
              subtitle={isOnline ? 'Online ✅' : 'Offline ❌'}
              rightElement={
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              }
              onClick={() => {
                checkServerHealth();
                setShowServerDialog(true);
                checkAuthStatus();
              }}
            />
          </div>
        </div>

        {/* Server Dialog */}
        <Dialog open={showServerDialog} onOpenChange={setShowServerDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server size={20} />
                Server Management
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm font-medium flex items-center gap-1 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                  {isOnline ? <><CheckCircle size={14} /> Online</> : <><XCircle size={14} /> Offline</>}
                </span>
              </div>

              {/* Auth Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Authentication</span>
                <span className="text-sm text-muted-foreground">
                  {checkingAuth ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : authStatus?.method === 'cookies' ? (
                    <span className="text-green-500">Cookies ✅</span>
                  ) : authStatus?.method === 'oauth' ? (
                    <span className="text-green-500">OAuth ✅</span>
                  ) : authStatus?.status === 'unreachable' ? (
                    <span className="text-red-500">Unreachable</span>
                  ) : (
                    <span className="text-yellow-500">Not configured</span>
                  )}
                </span>
              </div>

              {/* Cookie Upload */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a <code className="bg-muted px-1 rounded">cookies.txt</code> file exported from your browser to authenticate with YouTube.
                </p>
                <input
                  ref={cookieFileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleCookieUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => cookieFileRef.current?.click()}
                  disabled={uploading || !isOnline}
                  className="w-full"
                  variant="outline"
                >
                  {uploading ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Uploading...</>
                  ) : (
                    <><Upload size={16} className="mr-2" /> Upload cookies.txt</>
                  )}
                </Button>
                {!isOnline && (
                  <p className="text-xs text-destructive">Server must be online to upload cookies.</p>
                )}
              </div>

              {/* Refresh */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { checkServerHealth(); checkAuthStatus(); }}
              >
                <RefreshCw size={14} className="mr-2" /> Refresh Status
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Legal */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-4">Legal</h3>
          <div className="kb-glass rounded-2xl overflow-hidden">
            <SettingItem 
              icon={FileText} 
              title="Terms of Service"
              onClick={() => navigate('/terms')}
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Shield} 
              title="Privacy Policy"
              onClick={() => navigate('/privacy')}
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Phone} 
              title="Contact Us"
              subtitle="Get in touch with support"
              onClick={() => navigate('/contact')}
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={HelpCircle} 
              title="Help & Support"
            />
          </div>
        </div>

        {/* Sign Out */}
        <div className="kb-glass rounded-2xl overflow-hidden">
          <SettingItem 
            icon={LogOut} 
            title="Sign Out" 
            onClick={handleSignOut}
            danger
          />
        </div>

        {/* App Info */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">KhayaBeats v1.0.0</p>
          <p className="text-xs text-muted-foreground/50">Made with ❤️</p>
        </div>
      </div>

      {/* Sheets */}
      <SleepTimerSheet open={showSleepTimer} onOpenChange={setShowSleepTimer} />
      <AudioQualitySheet open={showAudioQuality} onOpenChange={setShowAudioQuality} />
    </motion.div>
  );
};
