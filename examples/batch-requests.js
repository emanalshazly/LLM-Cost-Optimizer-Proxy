import axios from 'axios';

const PROXY_URL = 'http://localhost:3001/api/proxy/chat';

async function batchExample() {
  console.log('🔄 Batch Processing Example\n');

  const questions = [
    'What is the capital of France?',
    'What is 10 * 5?',
    'Who wrote Romeo and Juliet?',
    'What is the speed of light?',
    'What is the largest planet in our solar system?'
  ];

  try {
    console.log(`Processing ${questions.length} questions...\n`);

    const startTime = Date.now();
    let totalSaved = 0;
    let totalOriginalCost = 0;
    let totalOptimizedCost = 0;

    // Process all questions in parallel
    const responses = await Promise.all(
      questions.map(prompt =>
        axios.post(PROXY_URL, {
          prompt,
          model: 'gpt-4',
          provider: 'openai'
        })
      )
    );

    responses.forEach((response, index) => {
      const data = response.data;
      totalSaved += data.cost.saved;
      totalOriginalCost += data.cost.original;
      totalOptimizedCost += data.cost.optimized;

      console.log(`${index + 1}. Question: ${questions[index]}`);
      console.log(`   Answer: ${data.response.substring(0, 60)}...`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Cost: $${data.cost.optimized.toFixed(6)} (saved $${data.cost.saved.toFixed(6)})`);
      console.log(`   Cache: ${data.cacheHit ? 'HIT' : 'MISS'}`);
      console.log('');
    });

    const totalTime = Date.now() - startTime;

    console.log('📊 Batch Summary:');
    console.log(`   Total questions: ${questions.length}`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Avg time per question: ${(totalTime / questions.length).toFixed(0)}ms`);
    console.log(`   Original cost: $${totalOriginalCost.toFixed(6)}`);
    console.log(`   Optimized cost: $${totalOptimizedCost.toFixed(6)}`);
    console.log(`   Total saved: $${totalSaved.toFixed(6)}`);
    console.log(`   Savings: ${((totalSaved / totalOriginalCost) * 100).toFixed(1)}%`);
    console.log('');

    console.log('✨ Batch processing completed successfully!');

    // Run the same batch again to demonstrate caching
    console.log('\n🔄 Running the same batch again to demonstrate caching...\n');
    const cacheStartTime = Date.now();
    const cachedResponses = await Promise.all(
      questions.map(prompt =>
        axios.post(PROXY_URL, {
          prompt,
          model: 'gpt-4',
          provider: 'openai'
        })
      )
    );

    const cacheTime = Date.now() - cacheStartTime;
    const cacheHits = cachedResponses.filter(r => r.data.cacheHit).length;

    console.log('📊 Cached Batch Results:');
    console.log(`   Cache hits: ${cacheHits}/${questions.length}`);
    console.log(`   First run time: ${totalTime}ms`);
    console.log(`   Cached run time: ${cacheTime}ms`);
    console.log(`   Speed improvement: ${((totalTime / cacheTime) * 100).toFixed(0)}% faster!`);
    console.log('');

    console.log('✨ Cache demonstration completed!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

batchExample();
