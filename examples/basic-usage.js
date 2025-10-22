import axios from 'axios';

const PROXY_URL = 'http://localhost:3001/api/proxy/chat';

async function basicExample() {
  console.log('🚀 Basic Usage Example\n');

  try {
    // Simple question - will be routed to cheapest model
    console.log('1. Sending simple question...');
    const response1 = await axios.post(PROXY_URL, {
      prompt: 'What is 2 + 2?',
      model: 'gpt-4',
      provider: 'openai'
    });

    console.log('✅ Response:', response1.data.response);
    console.log('📊 Model used:', response1.data.model);
    console.log('💰 Cost saved:', `$${response1.data.cost.saved.toFixed(6)}`);
    console.log('⚡ Processing time:', `${response1.data.processingTime}ms`);
    console.log('🎯 Cache hit:', response1.data.cacheHit ? 'YES' : 'NO');
    console.log('');

    // Same question again - should hit cache
    console.log('2. Sending same question again (should hit cache)...');
    const response2 = await axios.post(PROXY_URL, {
      prompt: 'What is 2 + 2?',
      model: 'gpt-4',
      provider: 'openai'
    });

    console.log('✅ Response:', response2.data.response);
    console.log('🎯 Cache hit:', response2.data.cacheHit ? 'YES' : 'NO');
    console.log('⚡ Processing time:', `${response2.data.processingTime}ms (much faster!)`);
    console.log('');

    // Medium complexity question
    console.log('3. Sending medium complexity question...');
    const response3 = await axios.post(PROXY_URL, {
      prompt: 'Write a function in JavaScript that checks if a string is a palindrome',
      model: 'gpt-4',
      provider: 'openai'
    });

    console.log('✅ Response:', response3.data.response.substring(0, 100) + '...');
    console.log('📊 Model used:', response3.data.model);
    console.log('💰 Cost saved:', `$${response3.data.cost.saved.toFixed(6)}`);
    console.log('🎯 Routing reason:', response3.data.routingReason);
    console.log('');

    // Complex question
    console.log('4. Sending complex question...');
    const response4 = await axios.post(PROXY_URL, {
      prompt: 'Explain the differences between microservices and monolithic architecture, including pros, cons, and when to use each. Provide real-world examples.',
      model: 'gpt-4',
      provider: 'openai'
    });

    console.log('✅ Response:', response4.data.response.substring(0, 100) + '...');
    console.log('📊 Model used:', response4.data.model);
    console.log('💰 Original cost:', `$${response4.data.cost.original.toFixed(6)}`);
    console.log('💰 Optimized cost:', `$${response4.data.cost.optimized.toFixed(6)}`);
    console.log('💰 Cost saved:', `$${response4.data.cost.saved.toFixed(6)}`);
    console.log('');

    console.log('✨ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

basicExample();
