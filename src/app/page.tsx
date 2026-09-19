import { redirect } from 'next/navigation'

export default function Home() {
  // Automatically send visitors to the signup page
  redirect('/signup')
}