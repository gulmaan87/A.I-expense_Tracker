// Test script for Google Gemini integration
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGemini() {
  try {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your-google-api-key-here') {
      console.log('⚠️  GOOGLE_API_KEY not set. Please add your Google API key to .env file');
      console.log('   Get your API key from: https://makersuite.google.com/app/apikey');
      return;
    }

    console.log('🧪 Testing Google Gemini integration...');
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent("Hello! Please respond with 'Gemini is working!' if you can read this.");
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini Response:', text);
    console.log('🎉 Google Gemini integration is working perfectly!');
    
  } catch (error) {
    console.error('❌ Gemini test failed:', error.message);
    if (error.message.includes('API_KEY_INVALID')) {
      console.log('💡 Please check your GOOGLE_API_KEY in the .env file');
    }
  }
}

testGemini();
