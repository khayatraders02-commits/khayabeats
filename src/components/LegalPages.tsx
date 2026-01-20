import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-background p-6 safe-area-top safe-area-bottom"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      
      <div className="prose prose-invert prose-sm max-w-none space-y-6">
        <p className="text-muted-foreground">Last updated: January 2026</p>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing and using KhayaBeats ("the App"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
          <p className="text-muted-foreground">
            KhayaBeats is a music streaming application that allows users to search, stream, and organize music content. The service is provided "as is" and we reserve the right to modify, suspend, or discontinue the service at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. User Accounts</h2>
          <p className="text-muted-foreground">
            To access certain features of the App, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. User Conduct</h2>
          <p className="text-muted-foreground">You agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Use the App for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any portion of the App</li>
            <li>Interfere with or disrupt the App or servers</li>
            <li>Reverse engineer or decompile any part of the App</li>
            <li>Use automated systems to access the App</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Intellectual Property</h2>
          <p className="text-muted-foreground">
            The App and its original content, features, and functionality are owned by KhayaBeats and are protected by international copyright, trademark, and other intellectual property laws. Music content accessed through the App remains the property of respective rights holders.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Disclaimer of Warranties</h2>
          <p className="text-muted-foreground">
            THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. WE MAKE NO WARRANTIES, EXPRESSED OR IMPLIED, REGARDING THE APP'S OPERATION OR THE INFORMATION, CONTENT, OR MATERIALS INCLUDED THEREIN.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            IN NO EVENT SHALL KHAYABEATS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF THE APP.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Service on this page. Your continued use of the App after any changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about these Terms, please contact us at support@khayabeats.app
          </p>
        </section>
      </div>
    </motion.div>
  );
};

export const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-background p-6 safe-area-top safe-area-bottom"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-invert prose-sm max-w-none space-y-6">
        <p className="text-muted-foreground">Last updated: January 2026</p>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Information We Collect</h2>
          <p className="text-muted-foreground">We collect information you provide directly to us, including:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Email address and account credentials</li>
            <li>Profile information (display name, avatar)</li>
            <li>Music preferences and listening history</li>
            <li>Playlists and favorites</li>
            <li>Device information and usage data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. How We Use Your Information</h2>
          <p className="text-muted-foreground">We use the information we collect to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Personalize your music experience</li>
            <li>Create personalized playlists and recommendations</li>
            <li>Communicate with you about updates and features</li>
            <li>Protect against fraud and unauthorized access</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Data Storage and Security</h2>
          <p className="text-muted-foreground">
            We implement industry-standard security measures to protect your personal information. Your data is stored securely using encrypted databases. We retain your information only as long as necessary to provide our services or as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Data Sharing</h2>
          <p className="text-muted-foreground">
            We do not sell, trade, or rent your personal information to third parties. We may share information with service providers who assist in operating our App, subject to confidentiality agreements.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Your Rights</h2>
          <p className="text-muted-foreground">You have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Cookies and Tracking</h2>
          <p className="text-muted-foreground">
            We use essential cookies and local storage to maintain your session and preferences. We do not use tracking cookies for advertising purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Children's Privacy</h2>
          <p className="text-muted-foreground">
            Our App is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy, please contact us at privacy@khayabeats.app
          </p>
        </section>
      </div>
    </motion.div>
  );
};
