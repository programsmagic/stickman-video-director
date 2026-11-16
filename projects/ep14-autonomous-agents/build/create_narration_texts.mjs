import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_PATH = path.resolve('projects/ep14-autonomous-agents/script/script.md');
const OUT_DIR = path.resolve('projects/ep14-autonomous-agents/build/narration');
fs.mkdirSync(OUT_DIR, { recursive: true });

const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

const actMatches = [
  { act: 1, text: `For the first few years of the AI revolution, large language models were like caged oracles.

You could ask them to explain quantum physics, translate ancient Greek, or write a Shakespearean sonnet, and they would answer with astonishing brilliance. But they were completely trapped inside their own heads.

If you asked them what the weather was outside right now, they had no eyes to see. If you asked them to run a program, they had no fingers to type. If a fire broke out in the room, they could calculate the rate of heat transfer, but could not pour a single drop of water.

They were passive next-token predictors, frozen in time at the date of their training cut-off. To turn a passive predictor into an autonomous agent, we had to give the brain hands, a tool belt, and the ability to interact with the physical world.` },
  { act: 2, text: `In 2022, researchers at Princeton and Google introduced a breakthrough framework called ReAct: Reasoning and Acting.

Before ReAct, AI models tried to solve problems in one of two flawed ways. Either they purely reasoned through chain-of-thought, hallucinating facts when they did not know the answer, or they blindly took actions without planning ahead.

ReAct unites both into an infinite three-part loop. First comes Thought: the model silently plans its next step on an internal scratchpad.

Second comes Action: the model chooses a specific tool, like searching Google or querying a database.

And third comes Observation: the external world executes the command and feeds the real result back into the prompt. By turning this three-gear loop over and over, the model navigates complex tasks one step at a time.` },
  { act: 3, text: `But how does a neural network made of floating-point probabilities actually talk to a computer terminal or an API?

Computers are ruthless. If a program expects valid code and you give it conversational English, the system crashes.

The secret is structured tool calling. During fine-tuning, models are trained on strict JSON schemas that describe every available function, its parameters, and required types.

When the agent decides to act, its attention mechanism suppresses ordinary conversational tokens. Instead, it constrains its output logits to emit perfectly formatted, machine-readable JSON: the exact tool name, followed by its arguments.

The neural network stops behaving like a chat partner, and starts behaving like an API compiler.` },
  { act: 4, text: `Once the model emits a tool call, control passes completely outside the neural network to an execution harness called the environment.

The harness reads the JSON payload, checks permissions inside a secure sandbox, and runs the real command. It executes the shell script, queries the SQL database, or navigates a browser page.

Crucially, the model does not run the code itself—it delegates execution to the computer.

The computer captures the standard output, errors, and return codes, and injects that raw text back into the agent's context window as an Observation. The agent reads what the world just did, updates its understanding, and decides what to do next.` },
  { act: 5, text: `What separates a naive script from a truly intelligent agent is how it responds when things go wrong.

In traditional software, an unhandled error crashes the entire program. But in an autonomous agent, an error is simply another observation.

Through a technique called Reflexion, pioneered by researchers at MIT and Princeton, when an agent hits a syntax error, a 404 page, or a failing unit test, it does not panic.

It reads the error message, logs a self-reflective note about what went wrong into its working memory, and backtracks. It analyzes the bug, rewrites the code, and tests again until the build passes. True agency is the ability to recover from your own mistakes.` },
  { act: 6, text: `Today, the frontier has moved beyond single agents. We are now building multi-agent swarms.

Just like a human company, complex work is too large for a single mind. Instead, a coordinator agent breaks a massive objective into specialized roles.

One subagent researches the documentation. Another writes the code in a sandboxed branch. A third writes rigorous automated tests, while a fourth audits security. They communicate across shared message boards, challenging each other's assumptions and correcting errors in parallel.

We did not just teach computers how to talk. We gave them hands, tools, and the power to work alongside us to build the future.

I'm Magi. Subscribe to Programs Magic, and let's keep unraveling the living architecture of artificial intelligence.` }
];

for (const { act, text } of actMatches) {
  const filePath = path.join(OUT_DIR, `act${act}.txt`);
  fs.writeFileSync(filePath, text.trim() + '\n');
  console.log(`✓ Wrote Act ${act} narration text: ${filePath}`);
}
