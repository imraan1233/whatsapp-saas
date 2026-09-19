'use client'

export default function PricingSection() {
  const checkoutUrl = 'https://sandbox-buy.paddle.com/checkout?items=eyJwcmljZUlkIjoicHJpXzAxbTJtcnhrcDBhd2tqNnRwcHZjYXp0NzJyIiwicXVhbnRpdHkiOjF9'

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Simple Pricing</h1>
        <p className="text-xl text-slate-600 mb-8">Choose the perfect plan for your WhatsApp AI agent</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Monthly Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-slate-200">
            <h3 className="text-2xl font-bold mb-2">Monthly Plan</h3>
            <p className="text-5xl font-bold mb-6">$41<span className="text-lg text-slate-600 font-normal">/month</span></p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Get Started - Monthly
            </a>
          </div>

          {/* Yearly Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-green-500">
            <h3 className="text-2xl font-bold mb-2">Yearly Plan</h3>
            <p className="text-5xl font-bold mb-6">$276<span className="text-lg text-slate-600 font-normal">/year</span></p>
            <p className="text-green-600 font-medium mb-6">Save 33% ($23/month)</p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Get Started - Yearly
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}