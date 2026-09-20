// GET Request: Meta uses this to verify your webhook URL
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('Webhook verification attempt:', { mode, token })

  // Check if the token matches
  if (mode === 'subscribe' && token === 'my_saas_secret_123') {
    console.log('Webhook verified successfully!')
    // Return the challenge string back to Meta
    return new NextResponse(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  console.log('Webhook verification failed - token mismatch')
  return new NextResponse('Forbidden', { status: 403 })
}