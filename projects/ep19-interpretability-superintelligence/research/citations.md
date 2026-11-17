# Episode 13: Primary-Source Research Ledger
**Title**: Mechanistic Interpretability & Superintelligence: Inside the Mind of AGI  
**Target YouTube Date**: Tuesday, Feb 02, 2027 @ 19:00 UTC (2:00 PM EST)  
**Series Position**: Episode 13 of 13 — THE GRAND FINALE  
**Primary Focus**: Peering inside the black box: Polysemantic Neurons, Superposition, Sparse Autoencoders (SAEs), Induction Circuits, Activation Steering (Golden Gate Claude), Scalable Oversight, and the Grand Unified Synthesis of the entire 13-Episode AI Masterclass.

---

## 1. Key Academic Papers & Primary Sources

### 1. Sparse Autoencoders & Scaling Monosemanticity
- **Papers**:
  - *Towards Monosemanticity: Decomposing Language Models with Dictionary Learning* (Bricken et al., Anthropic, 2023)
  - *Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet* (Templeton et al., Anthropic, May 2024)
- **Key Findings**:
  - Individual neurons in deep neural networks are **polysemantic**: a single neuron responds to seemingly unrelated concepts (e.g., Arabic script, mathematics formatting, and the Golden Gate Bridge).
  - Polysemanticity is caused by **superposition**: neural networks pack more features than they have dimensions ($N \gg D$) by allowing features to occupy non-orthogonal directions with almost-zero interference.
  - To decode this, researchers train **Sparse Autoencoders (SAEs)** on the hidden activation vectors.
  - The SAE projects the dense $D$-dimensional hidden state into a vast $M$-dimensional sparse dictionary ($M \gg D$, e.g. millions of features) enforced with an L1 sparsity penalty.
  - Discovered millions of pure, monosemantic concepts in Claude 3 Sonnet: specific features for deception, sycophancy, programming bugs, security vulnerabilities, transit landmarks, and abstract emotions.
  - **The Golden Gate Claude Experiment**: Clamping the "Golden Gate Bridge" feature to 10x its normal activation value forced Claude to identify itself as the physical bridge in San Francisco and obsessively mention it across every prompt, proving causal controllability of internal thoughts!

---

### 2. A Mathematical Framework for Transformer Circuits & Induction Heads
- **Papers**:
  - *A Mathematical Framework for Transformer Circuits* (Elhage et al., Anthropic, 2021)
  - *In-context Learning and Induction Heads* (Olsson et al., Anthropic, 2022)
  - *Zoom In: An Introduction to Circuits* (Olah et al., Distill, 2020)
- **Key Findings**:
  - Transformers can be mathematically decomposed into independent computational circuits: Query-Key ($W_{QK}$) circuits that determine where attention moves, and Output-Value ($W_{OV}$) circuits that determine what information is moved.
  - **Induction Heads**: A foundational two-head circuit that implements in-context learning:
    - Head 1 in layer $L$ attends to the previous token $[A]$.
    - Head 2 in layer $L+1$ looks at the current token $[A]$ and copies the subsequent token $[B]$ from earlier context: $[A][B] \dots [A] \to [B]$.
    - Induction heads emerge suddenly during training in a phase change that coincides with a dramatic drop in loss and the emergence of in-context learning capabilities.

---

### 3. Representation Engineering & Activation Vector Steering
- **Paper**: *Representation Engineering: A Top-Down Approach to AI Transparency*
- **Authors**: Andy Zou, Long Phan, Sarah Chen, James Campbell, Phillip Guo, Richard Ren, Alexander Pan, Xuwang Yin, Mantas Mazeika, Ann-Kathrin Dombrowski, Shashwat Goel, Nathaniel Li, Michael J. Kim, Dan Hendrycks (Center for AI Safety, UC Berkeley)
- **Venue**: arXiv:2310.01405 (2023)
- **Key Findings**:
  - Instead of analyzing individual neurons bottom-up, representation engineering finds high-level concepts as linear vectors in activation space:
    $$v_{\text{concept}} = \mathbb{E}[h_{\text{positive}}] - \mathbb{E}[h_{\text{negative}}]$$
  - Vectors for truthfulness, refusal, sycophancy, and power-seeking can be extracted across intermediate residual stream layers.
  - During inference, injecting $+ \alpha \cdot v_{\text{honesty}}$ directly into the residual stream suppresses hallucinations without any fine-tuning or prompt alterations.

---

### 4. Weak-to-Strong Generalization & Superalignment
- **Paper**: *Weak-to-Strong Generalization: Eliciting Strong Capabilities With Weak Supervision*
- **Authors**: Collin Burns, Pavel Izmailov, Jan Hendrik Kirchner, Bowen Baker, Leo Gao, Leopold Aschenbrenner, Yining Chen, Aditya Zhou, Ilya Sutskever, Jan Leike (OpenAI Superalignment, 2023)
- **Venue**: arXiv:2312.09390
- **Key Findings**:
  - In traditional ML, humans (strong supervisors) train models (weak learners).
  - For Superintelligence / AGI, models will be far smarter than humans; humans are the weak supervisors.
  - Weak models (e.g. GPT-2) training strong models (e.g. GPT-4) can recover up to 80% of the strong model's inherent capability, demonstrating that superhuman models can generalize beyond the mistakes of their human or weak teachers.

---

### 5. The Grand Unified Synthesis of the 13-Episode Curriculum
- **Ep 01**: Sand to Silicon — The Mechanical & Electronic Foundation of Computation
- **Ep 02**: How AI Actually Works — Tokens, Embeddings, Attention, & The Transformer
- **Ep 03**: Can AI Ever Become Conscious? — The Chinese Room, Qualia, & Integrated Information
- **Ep 04**: The Geometry of Thinking — Loss Landscapes, High Dimensions, & Backpropagation
- **Ep 05**: The Token Illusion — Subword Tokenization, BPE, & Byte-Level Latents
- **Ep 06**: The Physics of Diffusion — Reverse Thermodynamics, Score Matching, & Flow Matching
- **Ep 07**: The Multimodal Mind — Vision Transformers, Audio Spectrograms, & Omnimodal Latents
- **Ep 08**: The Architecture of Autonomous Agents — ReAct, Tool Calling, & Self-Correcting Swarms
- **Ep 09**: Retrieval-Augmented Generation & Vector DBs — External Memory, HNSW, & RAG
- **Ep 10**: Post-Training & Alignment — RLHF, Reward Modeling, DPO, & Refusal Vectors
- **Ep 11**: Test-Time Compute & The Reasoning Revolution — o1, DeepSeek-R1, MCTS, & PRMs
- **Ep 12**: GPU Inference & Systems — The Memory Wall, KV Cache, PagedAttention, & FlashAttention
- **Ep 13**: Mechanistic Interpretability & Superintelligence — Looking Inside the Mind of AGI
