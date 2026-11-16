# Episode 16 Research Dossier & Citation Ledger
**Topic**: Post-Training & Alignment: Taming the Silicon Beast (SFT, RLHF, DPO & Refusal Vectors)  
**Series Position**: Episode 10 of 13  
**Status**: Verified & Peer-Reviewed  

---

## 1. Primary Academic Sources & Citation Ledger

### 1. InstructGPT & Foundational RLHF
- **Citation**: Ouyang, L., Wu, J., Jiang, X., Almeida, D., Wainwright, C. L., Mishkin, P., Zhang, C., Agarwal, S., Slama, K., Ray, A., Schulman, J., Hilton, J., Kelton, F., Miller, L., Simens, M., Askell, A., Welinder, P., Christiano, P., Leike, J., & Lowe, R. (2022). *Training language models to follow instructions with human feedback*. Advances in Neural Information Processing Systems (NeurIPS 2022), 35, 27730-27744.
- **Core Insight**: Raw pre-trained base models predict internet continuations, not helpful answers. Alignment is a 3-stage process:
  1. Supervised Fine-Tuning (SFT) on human demonstration prompts and completions.
  2. Training a Reward Model $r_\psi(x, y)$ using pairwise comparisons via the Bradley-Terry preference model:
     $$\mathcal{L}_{\text{RM}}(\psi) = -\mathbb{E}_{(x, y_w, y_l)}\left[\log \sigma\left(r_\psi(x, y_w) - r_\psi(x, y_l)\right)\right]$$
  3. Reinforcement Learning via Proximal Policy Optimization (PPO) against the reward model, with a Kullback-Leibler (KL) divergence penalty against the reference model $\pi_{\text{SFT}}$ to prevent policy collapse:
     $$\max_\theta \mathbb{E}_{x \sim \mathcal{D}, y \sim \pi_\theta}\left[r_\psi(x, y) - \beta D_{\text{KL}}(\pi_\theta(y|x) \parallel \pi_{\text{SFT}}(y|x))\right]$$

### 2. Direct Preference Optimization (DPO)
- **Citation**: Rafailov, R., Sharma, A., Mitchell, E., Ermon, S., Manning, C. D., & Finn, C. (2023). *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*. NeurIPS 2023.
- **Core Insight**: Derives an analytical closed-form mapping between the reward function and optimal policy:
  $$r(x, y) = \beta \log \frac{\pi_\theta(y|x)}{\pi_{\text{ref}}(y|x)} + \beta \log Z(x)$$
  Substituting this directly into the Bradley-Terry objective completely eliminates the separate reward model and PPO reinforcement loop:
  $$\mathcal{L}_{\text{DPO}}(\theta; \pi_{\text{ref}}) = -\mathbb{E}_{(x, y_w, y_l)}\left[\log \sigma\left(\beta \log \frac{\pi_\theta(y_w|x)}{\pi_{\text{ref}}(y_w|x)} - \beta \log \frac{\pi_\theta(y_l|x)}{\pi_{\text{ref}}(y_l|x)}\right)\right]$$
  Achieves equal or superior alignment stability with simple cross-entropy-style binary classification loss.

### 3. Refusal Steering Vectors & Representation Engineering
- **Citation**: Arditi, A., Obeso, O., Akyürek, E., et al. (2024). *Refusal in Language Models Is Mediated by a Single Direction*. arXiv:2406.11717.
- **Core Insight**: Discovers that refusal behavior (e.g. "I cannot assist with that request") is represented as a single 1D directional vector $\vec{r}$ in the residual stream activations across intermediate layers.
  - Adding $+c \cdot \vec{r}$ forces the model to refuse even harmless queries.
  - Subtracting $-c \cdot \vec{r}$ ("abliteration") completely removes refusal behavior without retraining or degrading general reasoning benchmarks (MMLU, GSM8K).
- **Citation**: Zou, A., Phan, L., Chen, S., et al. (2023). *Representation Engineering: A Top-Down Approach to AI Transparency*. arXiv:2310.01405.

### 4. Constitutional AI & RL from AI Feedback (RLAIF)
- **Citation**: Bai, Y., Kadavath, S., Kundu, S., et al. (2022). *Constitutional AI: Harmlessness from AI Feedback*. Anthropic.
- **Core Insight**: Replaces expensive human preference labelers with an AI model governed by explicit constitutional principles (critique $\to$ revision $\to$ preference ranking).

---

## 2. Technical Metaphors & Visual Language
1. **The Wild Computational Stallion**: Raw base model charging across an open desert, endlessly predicting internet completions.
2. **The SFT Golden Leash**: Human demonstrator teaching the stallion to sit, respond, and halt on user requests.
3. **The Bradley-Terry Duel**: Two competing answers on an arena stage; judges raise scorecards ($y_w \succ y_l$) feeding a reward meter.
4. **The KL Divergence Electric Fence**: High-voltage harmonic fence preventing the model from wandering too far into degenerate reward-hacked gibberish.
5. **The DPO Tuning Fork**: Bypassing the complicated PPO machinery by tuning output log-ratios directly against human preferences.
6. **The Refusal Vector Compass**: A surgical 1D compass needle in the neural residual stream; tilting the needle switches between helpful assistant and impenetrable stone wall.
