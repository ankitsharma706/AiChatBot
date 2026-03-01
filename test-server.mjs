// Quick diagnostic — run with: node test-server.mjs
import 'dotenv/config';
import { getAIResponse } from './src/services/ai.service.js';
import { loadDocsContext } from './src/services/rag.service.js';

console.log('\n═══════════════════════════════════');
console.log('  Afterma Backend — Diagnostic Test');
console.log('═══════════════════════════════════\n');

// 1. Check env
const key = process.env.OPENROUTER_API_KEY;
console.log('✅ API Key loaded:', key ? key.slice(0, 12) + '...' : '❌ MISSING');
console.log('✅ Model:', process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free');

// 2. Test RAG
console.log('\n── RAG Test ─────────────────────────');
try {
  const ctx = await loadDocsContext('delivery ke baad bukhar aur dard ho raha hai');
  console.log(`✅ RAG returned ${ctx.length} chars`);
  console.log('Preview:', ctx.slice(0, 200).replace(/\n/g, ' '));
} catch (e) {
  console.error('❌ RAG Error:', e.message);
}

// 3. Test full AI call
console.log('\n── AI Service Test ──────────────────');
try {
  const result = await getAIResponse('Mujhe delivery ke baad thakaan ho rahi hai, kya karna chahiye?');
  console.log('✅ AI Response received!');
  console.log('   Triage:', result.triage);
  console.log('   Message:', result.message?.slice(0, 100));
} catch (e) {
  console.error('❌ AI Error:', e.message);
  console.error('   Stack:', e.stack?.split('\n').slice(0, 3).join('\n'));
}

console.log('\n═══════════════════════════════════\n');
