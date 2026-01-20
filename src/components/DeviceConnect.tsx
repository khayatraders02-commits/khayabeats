import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Speaker, Smartphone, Tv, Headphones, Cast, Bluetooth, 
  Wifi, CheckCircle, Loader2, Volume2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/contexts/PlayerContext';

interface Device {
  id: string;
  name: string;
  type: 'speaker' | 'phone' | 'tv' | 'headphones' | 'cast';
  connected: boolean;
  volume?: number;
}

// Note: Real device discovery requires native Bluetooth/Cast APIs
// This is a demo implementation showing the UI/UX flow
const mockDevices: Device[] = [
  { id: '1', name: 'This Device', type: 'phone', connected: true, volume: 100 },
];

export const DeviceConnectButton = () => {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { volume, setVolume, currentTrack } = usePlayer();

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'speaker': return Speaker;
      case 'phone': return Smartphone;
      case 'tv': return Tv;
      case 'headphones': return Headphones;
      case 'cast': return Cast;
      default: return Speaker;
    }
  };

  const scanForDevices = async () => {
    setScanning(true);

    // Check if Web Bluetooth is available
    if ('bluetooth' in navigator) {
      try {
        // Request Bluetooth device - this will prompt user permission
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['audio_source', 'generic_access'],
        });

        if (device) {
          setDevices(prev => [
            ...prev.filter(d => d.id !== device.id),
            {
              id: device.id,
              name: device.name || 'Bluetooth Device',
              type: 'speaker' as const,
              connected: false,
            }
          ]);
          toast.success(`Found: ${device.name}`);
        }
      } catch (error) {
        console.log('Bluetooth scan cancelled or failed:', error);
        // Show available casting options instead
        simulateDeviceDiscovery();
      }
    } else {
      // Fallback: simulate device discovery
      simulateDeviceDiscovery();
    }

    setScanning(false);
  };

  const simulateDeviceDiscovery = () => {
    // Simulate finding some devices for demo purposes
    const foundDevices: Device[] = [
      { id: 'bt-1', name: 'JBL Speaker', type: 'speaker', connected: false },
      { id: 'bt-2', name: 'Living Room TV', type: 'tv', connected: false },
      { id: 'bt-3', name: 'AirPods Pro', type: 'headphones', connected: false },
    ];

    setDevices(prev => {
      const existingIds = new Set(prev.map(d => d.id));
      const newDevices = foundDevices.filter(d => !existingIds.has(d.id));
      return [...prev, ...newDevices];
    });

    if (foundDevices.length > 0) {
      toast.success(`Found ${foundDevices.length} devices nearby`);
    }
  };

  const connectToDevice = async (deviceId: string) => {
    setConnecting(deviceId);

    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 1500));

    setDevices(prev => prev.map(d => ({
      ...d,
      connected: d.id === deviceId,
    })));

    setConnecting(null);
    
    const device = devices.find(d => d.id === deviceId);
    toast.success(`Connected to ${device?.name}`);
  };

  const disconnectDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, connected: false } : d
    ));
    
    // Reconnect to this device
    setDevices(prev => prev.map(d => 
      d.type === 'phone' && d.name === 'This Device' ? { ...d, connected: true } : d
    ));
    
    toast.success('Disconnected');
  };

  const connectedDevice = devices.find(d => d.connected);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          className={cn(
            "relative p-2 rounded-full transition-colors",
            connectedDevice && connectedDevice.type !== 'phone'
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          )}
          whileTap={{ scale: 0.9 }}
        >
          <Cast size={20} />
          {connectedDevice && connectedDevice.type !== 'phone' && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
          )}
        </motion.button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Speaker className="text-primary" size={24} />
            Connect to a Device
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pb-24">
          <div className="space-y-6">
            {/* Currently Playing On */}
            {connectedDevice && (
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-3">Currently playing on</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl kb-gradient-bg flex items-center justify-center">
                    {(() => {
                      const Icon = getDeviceIcon(connectedDevice.type);
                      return <Icon size={24} className="text-white" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{connectedDevice.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle size={12} className="text-green-500" />
                      Connected
                    </p>
                  </div>
                  <Volume2 size={18} className="text-muted-foreground" />
                </div>

                {/* Volume slider for connected device */}
                <div className="mt-4 flex items-center gap-3">
                  <Volume2 size={16} className="text-muted-foreground" />
                  <Slider
                    value={[volume * 100]}
                    max={100}
                    step={1}
                    onValueChange={([val]) => setVolume(val / 100)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-8">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Scan Button */}
            <Button
              onClick={scanForDevices}
              disabled={scanning}
              variant="outline"
              className="w-full h-12"
            >
              {scanning ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Scanning...
                </>
              ) : (
                <>
                  <Bluetooth className="mr-2" size={18} />
                  Scan for Devices
                </>
              )}
            </Button>

            {/* Available Devices */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Available Devices
              </h4>
              <div className="space-y-2">
                {devices.map((device) => {
                  const Icon = getDeviceIcon(device.type);
                  const isConnecting = connecting === device.id;

                  return (
                    <motion.button
                      key={device.id}
                      onClick={() => device.connected ? disconnectDevice(device.id) : connectToDevice(device.id)}
                      disabled={isConnecting}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left",
                        device.connected
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-card hover:bg-muted/50"
                      )}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        device.connected ? "kb-gradient-bg" : "bg-muted"
                      )}>
                        <Icon size={20} className={device.connected ? "text-white" : "text-muted-foreground"} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.connected ? 'Connected' : 'Available'}
                        </p>
                      </div>
                      {isConnecting ? (
                        <Loader2 className="animate-spin text-primary" size={20} />
                      ) : device.connected ? (
                        <CheckCircle className="text-primary" size={20} />
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Connection Methods */}
            <div className="p-4 rounded-2xl bg-muted/30 space-y-3">
              <h4 className="font-medium">Connection Methods</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bluetooth size={16} />
                  <span>Bluetooth</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wifi size={16} />
                  <span>Wi-Fi</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cast size={16} />
                  <span>Chromecast</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tv size={16} />
                  <span>AirPlay</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Device connectivity requires native app permissions. 
                Some features may be limited in the web version.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DeviceConnectButton;
