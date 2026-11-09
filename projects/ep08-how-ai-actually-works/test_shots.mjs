import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const OUTPUT_DIR = path.resolve('projects/ep08-how-ai-actually-works/assets');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 1. SHOT 2.3: 3D SUPERMARKET & THE VECTOR MATH SCALE (KING - MAN + WOMAN = QUEEN)
function renderVectorScaleFrame() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 850);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.textAlign = 'left';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('HOW COMPUTERS DO MATH WITH WORDS: THE VECTOR MIRACLE', 60, 65);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('In Embedding Space, words are GPS coordinates. You can literally add and subtract thoughts!', 60, 95);

  // Big Central Wooden Balance Scale
  const fulcrumX = 640;
  const fulcrumY = 460;

  // Fulcrum Triangle
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fulcrumX, fulcrumY);
  ctx.lineTo(fulcrumX - 40, fulcrumY + 80);
  ctx.lineTo(fulcrumX + 40, fulcrumY + 80);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Balance Beam (Horizontal / Balanced)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(fulcrumX - 380, fulcrumY);
  ctx.lineTo(fulcrumX + 380, fulcrumY);
  ctx.stroke();

  // Left Pan Strings & Tray (KING - MAN + WOMAN)
  const leftX = fulcrumX - 320;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fulcrumX - 320, fulcrumY); ctx.lineTo(leftX - 80, fulcrumY + 110);
  ctx.moveTo(fulcrumX - 320, fulcrumY); ctx.lineTo(leftX + 80, fulcrumY + 110);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(leftX - 100, fulcrumY + 110, 200, 22, 10);
  ctx.fill(); ctx.stroke();

  // Left Word Blocks: KING - MAN + WOMAN
  // Block KING
  ctx.fillStyle = '#4F46E5';
  ctx.strokeStyle = '#818CF8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(leftX - 85, fulcrumY + 35, 75, 70, 8); ctx.fill(); ctx.stroke();
  ctx.font = '900 16px monospace'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
  ctx.fillText('KING', leftX - 47, fulcrumY + 75);

  // Minus Sign
  ctx.font = '900 24px monospace'; ctx.fillStyle = '#EF4444';
  ctx.fillText('-', leftX - 2, fulcrumY + 75);

  // Block MAN
  ctx.fillStyle = '#0284C7'; ctx.strokeStyle = '#38BDF8';
  ctx.beginPath(); ctx.roundRect(leftX + 15, fulcrumY + 35, 75, 70, 8); ctx.fill(); ctx.stroke();
  ctx.font = '900 16px monospace'; ctx.fillStyle = '#FFFFFF';
  ctx.fillText('MAN', leftX + 52, fulcrumY + 75);

  // + WOMAN floating above
  ctx.font = '900 24px monospace'; ctx.fillStyle = '#10B981';
  ctx.fillText('+', leftX, fulcrumY + 20);

  ctx.fillStyle = '#EC4899'; ctx.strokeStyle = '#F472B6';
  ctx.beginPath(); ctx.roundRect(leftX - 45, fulcrumY - 60, 90, 70, 8); ctx.fill(); ctx.stroke();
  ctx.font = '900 15px monospace'; ctx.fillStyle = '#FFFFFF';
  ctx.fillText('+ WOMAN', leftX, fulcrumY - 20);

  // Equals Sign in Center
  ctx.font = '900 48px monospace'; ctx.fillStyle = '#FACC15'; ctx.textAlign = 'center';
  ctx.fillText('=', fulcrumX, fulcrumY - 60);

  // Right Pan Strings & Tray (QUEEN!)
  const rightX = fulcrumX + 320;
  ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fulcrumX + 320, fulcrumY); ctx.lineTo(rightX - 80, fulcrumY + 110);
  ctx.moveTo(fulcrumX + 320, fulcrumY); ctx.lineTo(rightX + 80, fulcrumY + 110);
  ctx.stroke();

  ctx.fillStyle = '#1E293B'; ctx.strokeStyle = '#10B981'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(rightX - 100, fulcrumY + 110, 200, 22, 10);
  ctx.fill(); ctx.stroke();

  // Glowing QUEEN Block
  ctx.save();
  ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 28;
  ctx.fillStyle = '#FACC15'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(rightX - 70, fulcrumY + 20, 140, 85, 10); ctx.fill(); ctx.stroke();
  ctx.restore();

  ctx.font = '900 24px monospace'; ctx.fillStyle = '#0F172A'; ctx.textAlign = 'center';
  ctx.fillText('QUEEN!', rightX, fulcrumY + 72);

  // Subtitle Pill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(140, 620, WIDTH - 280, 52, 10);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 15px monospace';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('VECTOR ARITHMETIC: [0.85, -0.42, 0.91] - [0.72, -0.40, 0.11] + [0.12, 0.88, 0.94] = QUEEN', WIDTH / 2, 652);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'shot_2_vector_math.png'), canvas.toBuffer('image/png'));
  console.log('✓ Rendered shot_2_vector_math.png');
}

// 2. SHOT 4.2: THE DETECTIVE STICKMAN WITH REASONING SCRATCHPAD (<think> TOKENS)
function renderDetectiveReasoningFrame() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 850);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.textAlign = 'left';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillStyle = '#10B981';
  ctx.fillText('SYSTEM 2 REASONING: OPENAI o1 / o3 & DEEPSEEK-R1', 60, 65);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Instead of guessing instantly, the model generates secret "thinking tokens" to verify logic.', 60, 95);

  // Left: Fast Chatbot Failing
  const fBoxX = 60, fBoxY = 135, fBoxW = 420, fBoxH = 460;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(fBoxX, fBoxY, fBoxW, fBoxH, 12);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 16px monospace';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('SPECIES 1: FAST NEXT-TOKEN CHATBOT', fBoxX + fBoxW / 2, fBoxY + 38);

  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('"How many letter \'r\'s in strawberry?"', fBoxX + fBoxW / 2, fBoxY + 80);

  // Buzzer & Wrong Answer
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(fBoxX + 60, fBoxY + 115, fBoxW - 120, 50, 10);
  ctx.fill();
  ctx.font = '900 20px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('ANSWER: "TWO!" [WRONG]', fBoxX + fBoxW / 2, fBoxY + 147);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('No internal deliberation.', fBoxX + fBoxW / 2, fBoxY + 200);
  ctx.fillText('Predicts most frequent token association.', fBoxX + fBoxW / 2, fBoxY + 225);
  ctx.fillText('Fails simple counting & trick riddles.', fBoxX + fBoxW / 2, fBoxY + 250);

  // Right: Detective Stickman with Glowing Scratchpad (o1 & DeepSeek-R1)
  const dBoxX = 520, dBoxY = 135, dBoxW = 700, dBoxH = 460;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(dBoxX, dBoxY, dBoxW, dBoxH, 12);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '900 16px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('SPECIES 2: REASONING MODEL (INTERNAL SCRATCHPAD)', dBoxX + 25, dBoxY + 38);

  // Glowing <think> Scratchpad Window
  const scX = dBoxX + 25, scY = dBoxY + 60, scW = dBoxW - 50, scH = 260;
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(scX, scY, scW, scH, 8);
  ctx.fill(); ctx.stroke();

  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('<think>  // HIDDEN CHAIN OF THOUGHT (TEST-TIME COMPUTE)', scX + 18, scY + 30);

  const thoughts = [
    '1. Parse the target word: "s-t-r-a-w-b-e-r-r-y"',
    '2. Enumerate each character position with 1-based indexing:',
    '   pos 1: s | pos 2: t | pos 3: r [MATCH #1]',
    '   pos 4: a | pos 5: w | pos 6: b | pos 7: e',
    '   pos 8: r [MATCH #2] | pos 9: r [MATCH #3] | pos 10: y',
    '3. Double-check length: 10 letters. Verify matches: 3, 8, 9.',
    '4. Conclusion: Exactly 3 occurrences of letter \'r\'.'
  ];

  ctx.font = '12px monospace';
  ctx.fillStyle = '#FEF08A';
  thoughts.forEach((line, i) => {
    ctx.fillText(line, scX + 18, scY + 65 + i * 26);
  });

  ctx.fillStyle = '#38BDF8';
  ctx.fillText('</think>', scX + 18, scY + 248);

  // Final Output
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.roundRect(dBoxX + 25, dBoxY + 340, dBoxW - 50, 52, 8);
  ctx.fill();

  ctx.font = '900 18px monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('FINAL USER RESPONSE: "There are 3 letter \'r\'s in strawberry."', dBoxX + 45, dBoxY + 372);

  // Bottom Tag
  ctx.font = 'italic 12px sans-serif';
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText('Trained via Reinforcement Learning (PPO / GRPO): AI rewarded for arriving at verifiable truth.', dBoxX + 30, dBoxY + 425);

  // Bottom Banner
  ctx.textAlign = 'center';
  ctx.font = '900 15px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('REASONING TOKENS ALLOW AI TO DOUBLE-CHECK, BACKTRACK, AND SELF-CORRECT!', WIDTH / 2, 640);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'shot_4_reasoning_scratchpad.png'), canvas.toBuffer('image/png'));
  console.log('✓ Rendered shot_4_reasoning_scratchpad.png');
}

// 3. SHOT 5.2: MIXTURE OF EXPERTS (MoE) — 64 CHEFS IN A RESTAURANT
function renderMoEKitchenFrame() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 850);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.textAlign = 'left';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillStyle = '#A855F7';
  ctx.fillText('MIXTURE OF EXPERTS (MoE): HOW DEEPSEEK-V3 SAVED 95% POWER', 60, 65);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('671 Billion Total Parameters, but only 37 Billion activated per token!', 60, 95);

  // Left: Incoming Token Order
  const ordX = 60, ordY = 140, ordW = 280, ordH = 440;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(ordX, ordY, ordW, ordH, 12);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 16px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('CUSTOMER ORDER (TOKEN)', ordX + ordW / 2, ordY + 40);

  // Glowing Ticket
  ctx.fillStyle = '#FEF08A';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(ordX + 25, ordY + 70, ordW - 50, 130, 8);
  ctx.fill(); ctx.stroke();

  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#451A03';
  ctx.fillText('TOKEN #492:', ordX + ordW / 2, ordY + 110);
  ctx.font = '900 22px monospace';
  ctx.fillText('"def solve():"', ordX + ordW / 2, ordY + 145);
  ctx.font = '12px sans-serif';
  ctx.fillText('[Type: Python Code]', ordX + ordW / 2, ordY + 175);

  // Smart Router
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.roundRect(ordX + 25, ordY + 230, ordW - 50, 50, 10);
  ctx.fill();
  ctx.font = '900 15px monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('SMART ROUTER', ordX + ordW / 2, ordY + 260);

  ctx.font = '12.5px sans-serif';
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText('Router analyzes token and', ordX + ordW / 2, ordY + 320);
  ctx.fillText('selects only the top 8 experts.', ordX + ordW / 2, ordY + 345);
  ctx.fillText('Other 56 experts sleep!', ordX + ordW / 2, ordY + 370);

  // Right: The Kitchen of 64 Chefs
  const kitX = 380, kitY = 140, kitW = 840, kitH = 440;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(kitX, kitY, kitW, kitH, 12);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '900 16px monospace';
  ctx.fillStyle = '#A855F7';
  ctx.fillText('64 SPECIALIZED MINI-BRAINS (EXPERTS)', kitX + 30, kitY + 40);

  // Grid of 64 Expert Chefs (8 x 8)
  const cols = 8, rows = 6;
  const cw = 88, ch = 48;
  const startX = kitX + 30, startY = kitY + 65;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const ex = startX + c * (cw + 12);
      const ey = startY + r * (ch + 10);

      // Experts 14 and 15 are active Python Coding Experts!
      const isActive = (idx === 14 || idx === 15 || idx === 2);

      ctx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(30, 41, 59, 0.6)';
      ctx.strokeStyle = isActive ? '#10B981' : '#475569';
      ctx.lineWidth = isActive ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(ex, ey, cw, ch, 6);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = isActive ? '#10B981' : '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText(`EXP #${idx + 1}`, ex + cw / 2, ey + 20);

      ctx.font = 'bold 9.5px monospace';
      ctx.fillStyle = isActive ? '#10B981' : '#64748B';
      ctx.fillText(isActive ? '[ACTIVE]' : 'zzz sleeping', ex + cw / 2, ey + 36);
    }
  }

  // Connecting Energy Lines from Router to Active Chefs
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#10B981';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(ordX + ordW, ordY + 255);
  ctx.bezierCurveTo(ordX + ordW + 80, ordY + 255, startX + 6 * 100 - 80, startY + 1 * 58 + 24, startX + 6 * 100, startY + 1 * 58 + 24);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bottom Banner
  ctx.textAlign = 'center';
  ctx.font = '900 15px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('INSTEAD OF FIRING 671 BILLION PARAMETERS: WE ONLY WAKE UP THE 37 BILLION WE NEED!', WIDTH / 2, 640);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'shot_5_moe_kitchen.png'), canvas.toBuffer('image/png'));
  console.log('✓ Rendered shot_5_moe_kitchen.png');
}

renderVectorScaleFrame();
renderDetectiveReasoningFrame();
renderMoEKitchenFrame();
