import { motion } from 'framer-motion';
import { Phone, Mail, MessageCircle, ExternalLink, Heart, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const ContactPage = () => {
  const contactMethods = [
    {
      icon: Phone,
      label: 'Phone',
      value: '+27 61 939 1305',
      href: 'tel:+27619391305',
      description: 'Primary contact number',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: Phone,
      label: 'Alternative Phone',
      value: '+27 69 458 1417',
      href: 'tel:+27694581417',
      description: 'Secondary contact number',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: '+27 61 939 1305',
      href: 'https://wa.me/27619391305',
      description: 'Chat with us on WhatsApp',
      color: 'from-green-400 to-green-600',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'khayatraders02@gmail.com',
      href: 'mailto:khayatraders02@gmail.com',
      description: 'Send us an email',
      color: 'from-red-500 to-pink-600',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 pb-8"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <motion.div
          className="w-20 h-20 mx-auto rounded-full kb-gradient-bg flex items-center justify-center mb-4"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Heart size={36} className="text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Have questions, feedback, or need support? We'd love to hear from you!
        </p>
      </div>

      {/* Contact Methods */}
      <div className="space-y-3">
        {contactMethods.map((method, index) => (
          <motion.a
            key={method.label}
            href={method.href}
            target={method.href.startsWith('http') ? '_blank' : undefined}
            rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="block"
          >
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-none bg-card/50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.color} flex items-center justify-center flex-shrink-0`}>
                  <method.icon size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{method.label}</p>
                  <p className="text-sm text-muted-foreground">{method.value}</p>
                </div>
                <ExternalLink size={18} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.a>
        ))}
      </div>

      <Separator />

      {/* About Section */}
      <Card className="border-none bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="kb-gradient-text">KhayaBeats</span>
          </CardTitle>
          <CardDescription>
            Your premium music streaming experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            KhayaBeats is designed to provide you with the best music streaming experience. 
            Stream millions of songs, discover new artists, and enjoy personalized recommendations 
            based on your listening habits.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Free Streaming
            </span>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Synced Lyrics
            </span>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Offline Mode
            </span>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Social Jams
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => window.location.href = '/terms'}
        >
          <FileText size={20} />
          <span className="text-sm">Terms of Service</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => window.location.href = '/privacy'}
        >
          <Shield size={20} />
          <span className="text-sm">Privacy Policy</span>
        </Button>
      </div>

      {/* Version */}
      <p className="text-center text-xs text-muted-foreground">
        KhayaBeats v1.0.0 • Made with ❤️ in South Africa
      </p>
    </motion.div>
  );
};

export default ContactPage;
