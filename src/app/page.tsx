'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // 1. Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard'); // Send them to dashboard if logged in
      }
    };
    checkSession();
  }, [router]);

  // 2. Auto-vanish message
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setEmail('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setMessage('❌ Error: ' + error.message);
    } else {
      setMessage('✅ Check your email! Magic link sent.');
    }

    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900 p-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        
        <div className="inline-flex items-center px-5 py-2 rounded-full bg-[#E5C158] text-gray-900 text-sm font-bold shadow-md">
          AI-Powered WhatsApp Automation
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-600">
          Build Your <span className="text-[#25D366]">AI WhatsApp Agent</span> in Minutes
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-bold">
          Automate customer support, sales, and engagement. No coding required.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto mt-10">
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-5 py-4 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent shadow-sm transition-all text-lg"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-8 py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-lg transition-all shadow-lg shadow-green-500/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Start Free Trial'}
          </button>
        </form>

        {message && (
          <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-800 font-medium animate-pulse">
            {message}
          </div>
        )}

        <p className="text-base text-gray-400 mt-6 font-medium">
          No password required. We'll email you a magic link.
        </p>
      </div>
    </main>
  );
}