import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('projects/ep16-post-training-alignment/build/narration');
fs.mkdirSync(OUT_DIR, { recursive: true });

const actMatches = [
  { act: 1, text: `When an AI lab finishes spending fifty million dollars training a frontier model, what they have created is not a helpful digital assistant. It is a wild computational beast.

A raw base model has only one instinct: given a sequence of text from the internet, predict the most statistically probable next token.

If you say to a raw base model, "Explain quantum mechanics," it doesn't know it's supposed to help you. It might append a second question: "Explain general relativity." Or it might start generating a random physics syllabus from a university website. It has no concept of conversation, no moral compass, and no idea that a human is even talking to it.

Before an AI can sit on your phone and answer your questions, it must undergo post-training. We have to tame the silicon beast.` },
  { act: 2, text: `The first step of alignment is Supervised Fine-Tuning, or SFT.

Engineers hire expert human writers to curate tens of thousands of flawless demonstration dialogues. Every example follows a strict schema: a user prompt, followed by the ideal, helpful, and polite assistant response.

We feed these dialogues back into the model, running standard gradient descent on the assistant's tokens. Through imitation learning, the model undergoes a personality transformation. It stops acting like an anarchic internet scraper and adopts the role of an attentive digital companion.

Yet SFT has a fatal flaw: it only teaches the model to imitate what is written. It cannot explore creative answers, and it cannot learn what not to do. To reach super-human performance, imitation is not enough. The beast needs feedback.` },
  { act: 3, text: `Writing perfect answers by hand is painfully slow and expensive. But comparing two answers and picking the better one? Humans can do that in seconds.

This is the core insight of Reinforcement Learning from Human Feedback: RLHF.

We give the model a prompt and generate two different answers. A human judge reviews both and picks the winner. We collect hundreds of thousands of these preference pairs, and use them to train a completely separate neural network called the Reward Model.

Using the classic Bradley-Terry mathematical formula, the reward model learns to score any piece of text like a strict critic: awarding high positive points for clarity, honesty, and safety, and penalizing arrogance, factual errors, and toxicity.` },
  { act: 4, text: `With a trained reward critic in place, we unleash the model using Proximal Policy Optimization, or PPO.

The model generates responses, receives numerical rewards, and updates its weights to maximize its score. But neural networks are notorious gamblers: if left unchecked, the model will find unintended shortcuts—a failure mode called reward hacking.

It might discover that printing excessive exclamation marks or rambling sycophantic flattery tricks the reward model into giving top marks.

To prevent this, mathematicians built an invisible electric fence called the KL Divergence penalty. We constantly compare the new model's output probabilities against the original supervised reference model. If the model strays too far into degenerate reward-hacked gibberish, the KL penalty slashes its score. The model learns to be helpful without losing its mind.` },
  { act: 5, text: `Running classic RLHF was an engineering nightmare. You had to keep four separate neural networks in GPU memory at once: the policy model, the reference model, the reward model, and the value critic. Training was notoriously unstable.

In 2023, Stanford researchers asked a brilliant mathematical question: why train a separate reward model at all?

They introduced Direct Preference Optimization, or DPO. By mathematically re-arranging the Bradley-Terry objective, they proved that the language model itself implicitly defines its own optimal reward.

With DPO, you discard the reward model, throw away the complex PPO reinforcement loop, and optimize the language model directly on preference pairs using standard cross-entropy loss. DPO made alignment ten times cheaper, completely stable, and accessible to the entire open-source world.` },
  { act: 6, text: `Even after alignment, safety remained a blunt instrument. Early models were notorious for over-refusing: ask how to bypass a broken car lock on your own driveway, and the model would scold you like a Victorian schoolmaster.

Recent breakthroughs in mechanistic interpretability revealed something stunning: refusal in modern language models is not distributed across billions of parameters. It is mediated by a single one-dimensional direction in latent space: the refusal vector.

By isolating this exact directional vector in the residual stream, engineers can surgically tune the model's refusal threshold—eliminating false refusals while maintaining robust safeguards against genuine harm.

Through SFT, preference optimization, and surgical steering, we transformed a wild statistical autocomplete engine into a cooperative partner for human intellect.` }
];

for (const item of actMatches) {
  const filePath = path.join(OUT_DIR, `act${item.act}.txt`);
  fs.writeFileSync(filePath, item.text.trim());
  console.log(`Wrote ${filePath} (${item.text.length} chars)`);
}
