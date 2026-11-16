# Academic Citations & Theoretical Foundation: Episode 11 (EP17)
**Title**: Test-Time Compute & The Reasoning Revolution: Inside OpenAI o1, DeepSeek-R1, MCTS & Process Reward Models  
**Series Position**: Episode 11 of 13  
**Verified Primary Sources**:

1. **OpenAI (2024)**  
   *Learning to Reason with LLMs* (OpenAI Technical Report).  
   - **Key Finding**: Discovered a new scaling law orthogonal to Kaplan & Chinchilla: model accuracy on complex reasoning tasks (AIME, GPQA, Codeforces) scales monotonically with test-time compute (number of generated thinking tokens). Introduced `<thought>` tokens and chain-of-thought reinforcement learning.

2. **DeepSeek-AI (2025)**  
   *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Large-Scale Reinforcement Learning* (DeepSeek-AI Technical Report, arXiv:2501.12948).  
   - **Key Finding**: Proved that reasoning behaviors (backtracking, self-verification, and "aha moments") emerge naturally from pure reinforcement learning (DeepSeek-R1-Zero via Group Relative Policy Optimization - GRPO) using only rule-based verifiable rewards (math and code verification), without requiring expensive human-annotated chain-of-thought demonstrations.

3. **Lightman et al. (2023)**  
   *Let's Verify Step by Step* (OpenAI, arXiv:2305.20050).  
   - **Key Finding**: Process-supervised Reward Models (PRMs) drastically outperform Outcome-supervised Reward Models (ORMs). By scoring every individual deduction step rather than merely the final answer, PRMs pinpoint the exact moment a logical error occurs, preventing deceptive reasoning and catastrophic error propagation.

4. **Yao et al. (2023)**  
   *Tree of Thoughts: Deliberate Problem Solving with Large Language Models* (Princeton University & Google DeepMind, arXiv:2305.10601).  
   - **Key Finding**: Formulates reasoning as tree search over discrete token states. Generalizes chain-of-thought into branching trees evaluated via lookahead heuristics and backtracking, mirroring human System 2 cognitive deliberation.

5. **Silver et al. (2016 / 2017)**  
   *Mastering the game of Go with deep neural networks and tree search* (Nature, 529:484–489).  
   *Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm* (AlphaZero).  
   - **Key Finding**: The synthesis of deep neural policy networks with Monte Carlo Tree Search (MCTS) enables discovery of super-human strategies through test-time simulation, providing the intellectual lineage for modern AI test-time reasoning loops.

6. **Snell et al. (2024)**  
   *Scaling LLM Test-Time Compute Optimally Can Be More Effective than Scaling Parameters* (UC Berkeley, arXiv:2408.03314).  
   - **Key Finding**: On hard problems, trading test-time compute (revision, search, sampling) allows a smaller 8B model to outperform a 70B parameter model by more than 4x compute efficiency, breaking the assumption that only larger models can solve harder problems.
