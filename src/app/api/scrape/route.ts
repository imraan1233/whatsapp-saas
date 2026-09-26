import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Fetch the website
    const response = await fetch(url);
    const html = await response.text();
    
    // Load into Cheerio to extract text
    const $ = cheerio.load(html);

    // Remove scripts and styles so we only get readable text
    $('script').remove();
    $('style').remove();

    // Get the text and clean it up
    let text = $('body').text();
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit to 15,000 characters so we don't crash the AI
    const cleanText = text.substring(0, 15000); 

    return NextResponse.json({ text: cleanText });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Failed to scrape website' }, { status: 500 });
  }
}