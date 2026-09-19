export default function PricingPage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1 style={{ marginBottom: '20px' }}>Simple Pricing</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>Payment integration coming soon!</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '30px', border: '2px solid #ddd', borderRadius: '12px' }}>
          <h2>Monthly - $41/month</h2>
          <button disabled style={{
            padding: '15px 30px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'not-allowed'
          }}>
            Coming Soon
          </button>
        </div>
        
        <div style={{ padding: '30px', border: '2px solid #16a34a', borderRadius: '12px' }}>
          <h2>Yearly - $276/year</h2>
          <p style={{ color: '#16a34a' }}>Save 33%</p>
          <button disabled style={{
            padding: '15px 30px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'not-allowed'
          }}>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  )
}