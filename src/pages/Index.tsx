import { Smartphone, Zap, Shield, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">My App</h1>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Smartphone className="w-10 h-10 text-primary" />
        </div>
        
        <h2 className="text-3xl font-bold text-foreground mb-3">
          Welcome to Your App
        </h2>
        
        <p className="text-muted-foreground text-lg mb-8 max-w-sm">
          Your native mobile app is ready. Start building something amazing!
        </p>

        <Button size="lg" className="mb-12 px-8">
          Get Started
        </Button>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
          <FeatureItem icon={Zap} label="Fast" />
          <FeatureItem icon={Shield} label="Secure" />
          <FeatureItem icon={Heart} label="Beautiful" />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="px-6 py-4 border-t border-border bg-card">
        <div className="flex justify-around items-center">
          <NavItem icon={Smartphone} label="Home" active />
          <NavItem icon={Zap} label="Features" />
          <NavItem icon={Heart} label="Favorites" />
        </div>
      </nav>
    </div>
  );
};

const FeatureItem = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
      <Icon className="w-6 h-6 text-secondary-foreground" />
    </div>
    <span className="text-sm text-muted-foreground">{label}</span>
  </div>
);

const NavItem = ({ icon: Icon, label, active }: { icon: React.ElementType; label: string; active?: boolean }) => (
  <button className="flex flex-col items-center gap-1">
    <Icon className={`w-6 h-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
    <span className={`text-xs ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
      {label}
    </span>
  </button>
);

export default Index;
