import { motion, AnimatePresence } from 'framer-motion';
import { ServerOff, RefreshCw } from 'lucide-react';
import { useServerStatus } from '@/hooks/useServerStatus';
import { cn } from '@/lib/utils';

export const ServerStatusBanner = () => {
  const { isOnline, isChecking, checkServerHealth } = useServerStatus();

  return (
    <AnimatePresence>
      {!isOnline && !isChecking && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <ServerOff size={16} className="text-destructive" />
            <span className="text-sm font-medium text-destructive">Server Offline</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={checkServerHealth}
            className="p-1.5 rounded-full hover:bg-background/50 transition-colors"
          >
            <RefreshCw size={14} className="text-muted-foreground" />
          </motion.button>
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
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        isOnline 
          ? "bg-primary/10 text-primary" 
          : "bg-destructive/10 text-destructive"
      )}
    >
      {isChecking ? (
        <>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span>...</span>
        </>
      ) : isOnline ? (
        <>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span>Online</span>
          {cacheStats && cacheStats.totalFiles > 0 && (
            <span className="text-muted-foreground ml-1">
              • {cacheStats.totalFiles}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
          <span>Offline</span>
        </>
      )}
    </motion.div>
  );
};
