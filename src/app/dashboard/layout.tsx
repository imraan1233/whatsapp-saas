'use client'

import Link from 'next/link'
import { LanguageProvider, useLanguage } from '@/context/LanguageContext'
import { Language } from '@/lib/translations'

function SidebarContent({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();

  const languages: { code: Language; flag: string; name: string }[] = [
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'ar', flag: '🇸🇦', name: 'العربية' },
    { code: 'es', flag: '🇸', name: 'Español' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Assistent</h1>
        </div>
        
        {/* Language Switcher */}
        <div className="px-4 mb-4">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full p-2 border rounded-lg bg-gray-50 text-sm"
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            {t('dashboard')}
          </Link>
          <Link href="/dashboard/knowledge" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            {t('knowledgeBase')}
          </Link>
          <Link href="/dashboard/chat" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            {t('testChat')}
          </Link>
          <Link href="/dashboard/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            {t('settings')}
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link href="/login" className="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
            {t('logout')}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <SidebarContent>{children}</SidebarContent>
    </LanguageProvider>
  )
}