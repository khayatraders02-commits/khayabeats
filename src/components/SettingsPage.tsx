import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, ChevronRight, User, Bell, Shield, FileText, 
  HelpCircle, LogOut, Camera, Moon, Globe, Download, Trash2
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

export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      });
      
      if (error) throw error;
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
            <SettingItem 
              icon={User} 
              title="Edit Profile" 
              subtitle="Name, photo, and more"
            />
            <Separator className="mx-4" />
            <SettingItem 
              icon={Bell} 
              title="Notifications" 
              subtitle="Push notifications and alerts"
              rightElement={<Switch defaultChecked />}
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
            />
          </div>
        </div>

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
    </motion.div>
  );
};
