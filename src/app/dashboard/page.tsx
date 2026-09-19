'use client'

import { useLanguage } from '@/context/LanguageContext'

export default function DashboardPage() {
  const { t } = useLanguage();

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('dashboard')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">{t('activeAgents')}</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">1</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">{t('messagesToday')}</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">{t('subscription')}</h3>
          <p className="text-lg font-semibold text-green-600 mt-2">{t('freeTrial')}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('agentStatus')}</h3>
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-700">{t('readyToConfigure')}</span>
        </div>
        <p className="text-gray-500 mt-4">
          {t('goToKnowledge')}
        </p>
      </div>
    </div>
  )
}