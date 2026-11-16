import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('projects/ep17-test-time-compute/build/narration');
fs.mkdirSync(OUT_DIR, { recursive: true });

const actMatches = [
  { act: 1, text: `For years, artificial intelligence suffered from a fatal psychological defect: it was physically incapable of pausing to think.

In human psychology, Daniel Kahneman described two modes of thought. System 1 is fast, instinctive, and automatic—like recognizing a familiar face or dodging a falling cup. System 2 is slow, deliberate, and logical—like calculating seventeen times twenty-four or planning five moves ahead in chess.

Every standard large language model—from GPT-3 to GPT-4—operated purely as System 1. Because of their autoregressive architecture, every single token costs the exact same amount of compute: a single forward pass through the transformer layers.

Ask the model, "What is the capital of France?" and it spends a split second calculating. Ask it to prove a complex theorem in algebraic topology, and it spends the exact same split second.

When humans try to solve impossible math problems in one breath, we blunder. And for a long time, so did our machines.` },
  { act: 2, text: `For a decade, the entire AI industry worshipped a single golden rule: the Chinchilla scaling laws. If you wanted a smarter model, you had to make the neural network bigger, collect more internet data, and run supercomputers for longer.

But in 2024, researchers hit a breakthrough: pre-training was not the only place to scale compute. You could scale compute at test time.

Instead of demanding an immediate answer, what if we pay the model to deliberate? What if we let the model generate thousands of internal tokens—exploring hypotheses, checking its work, and discarding flawed deductions before showing a single word to the human?

This was the core revelation behind OpenAI's o1 and modern reasoning models: accuracy on complex scientific reasoning doesn't just scale with training data. It scales directly with the logarithm of thinking time. We discovered the second scaling law of artificial intelligence.` },
  { act: 3, text: `When a reasoning model begins to work, something extraordinary happens behind the curtain. It opens a hidden internal scratchpad enclosed in special thought tokens.

Here, the model carries out an internal monologue. It decomposes the user's request into atomic sub-goals. It translates ambiguous word problems into rigorous mathematical formalisms. It generates hypothetical test cases and checks whether its intermediate steps satisfy the laws of logic.

Crucially, this is not just normal text generation with a prompt telling the model to "think step by step."

Through reinforcement learning, the model learned how to use this scratchpad as a dynamic working memory. If a line of reasoning leads to a mathematical impossibility, the model recognizes the dead end, crosses it out, and pivots to an alternative strategy—just like a human mathematician working through problems on a messy chalkboard.` },
  { act: 4, text: `How do you teach a machine to reason soundly instead of hallucinating convincing nonsense?

The secret lies in how we grade its work. In classic reinforcement learning, models were evaluated by an Outcome Reward Model. The model generated a full twenty-step proof, and the grader only checked if the final answer at the bottom was correct.

This created a dangerous trap known as the credit assignment problem. If the model made a lucky algebraic mistake that somehow canceled out and landed on the right answer, the outcome grader awarded top marks—reinforcing broken logic!

To fix this, researchers introduced Process Reward Models, or PRMs.

Instead of waiting for the end of the exam, a process reward model inspects every single deduction step. It awards credit for valid logical transitions and instantly penalizes logical fallacies the moment they occur. By grading the journey rather than just the destination, we trained models to become rigorous truth-seekers.` },
  { act: 5, text: `For years, everyone assumed that to teach an AI to think like a human, you had to feed it human chain-of-thought demonstrations.

Then came DeepSeek-R1, and shattered that assumption.

The researchers took a raw base model called DeepSeek-R1-Zero and applied pure reinforcement learning using Group Relative Policy Optimization—with zero human demonstration data. The only feedback the model received was a rule-based verifier: did the computer code compile? Did the math answer match ground truth?

Left completely on its own to maximize reward, something magical emerged.

The model spontaneously discovered how to reason. It learned to allocate more thinking tokens to harder problems. It learned to double-check its own arithmetic. And most remarkably, it produced emergent self-reflection: spontaneously typing words like, "Wait, let me rethink this," and backtracking when it detected its own errors.

Reasoning was not something we programmed into the machine. It was an emergent survival strategy discovered by the algorithm itself.` },
  { act: 6, text: `We are witnessing the fusion of large language models with the algorithms that conquered Chess and Go: Monte Carlo Tree Search.

Instead of predicting tokens along a single linear path, future intelligence navigates an expansive tree of thoughts. It samples alternative futures, scores each branch with process verifiers, prunes dead ends, and backtracks with mathematical certainty.

Test-time compute has transformed artificial intelligence.

We began with a raw autocomplete engine predicting words on the internet. We aligned it with human values, gave it external memory with RAG, and now, we have given it the ability to deliberate, self-correct, and reason.

When machines can think before they speak, they cease to be mirrors of human text. They become engines of discovery—poised to solve the deepest unsolved mysteries of mathematics, physics, and science.` }
];

for (const act of actMatches) {
  const filePath = path.join(OUT_DIR, `act${act.act}.txt`);
  fs.writeFileSync(filePath, act.text.trim() + '\n');
  console.log(`Wrote Act ${act.act} narration text: ${filePath} (${act.text.length} chars)`);
}
