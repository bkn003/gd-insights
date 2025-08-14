import React from 'react';
import { Navigation } from '@/components/Navigation';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

export const MainApp = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Main Content */}
      <main className="container mx-auto py-12">
        <h1 className="text-2xl font-bold mb-4">Welcome to the App!</h1>
        <p>This is the main content area of your application.</p>
      </main>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};
