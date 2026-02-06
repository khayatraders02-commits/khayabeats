import { motion, AnimatePresence } from 'framer-motion';
import { Server, ServerOff, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useServerStatus } from '@/hooks/useServerStatus';
import { cn } from '@/lib/utils';

export const ServerStatusBanner = () => {
  const { isOnline, isChecking, checkServerHealth, cacheStats } = useServerStatus();

  return (
    <AnimatePresence>
      {!isOnline && !isChecking && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <ServerOff size={20} className="text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-destructive">Server Offline</h4>
              <p className="text-xs text-muted-foreground">
                Start your local server to stream music
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={checkServerHealth}
              className="p-2 rounded-full bg-background/50 hover:bg-background transition-colors"
            >
              <RefreshCw size={18} className="text-muted-foreground" />
            </motion.button>
          </div>
          
          <div className="mt-3 pt-3 border-t border-destructive/20">
            <p className="text-xs text-muted-foreground font-mono">
              Run: <span className="text-foreground">cd khayabeats-server && npm start</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ServerStatusIndicator = () => {
  const { isOnline, isChecking, cacheStats } = useServerStatus();

  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
        isOnline 
          ? "bg-primary/10 text-primary border border-primary/30" 
          : "bg-destructive/10 text-destructive border border-destructive/30"
      )}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
    >
      {isChecking ? (
        <>
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span>Checking...</span>
        </>
      ) : isOnline ? (
        <>
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span>Server Online</span>
          {cacheStats && (
            <span className="text-muted-foreground">
              ({cacheStats.totalFiles} songs)
            </span>
          )}
        </>
      ) : (
        <>
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span>Offline</span>
        </>
      )}
    </motion.div>
  );
};
