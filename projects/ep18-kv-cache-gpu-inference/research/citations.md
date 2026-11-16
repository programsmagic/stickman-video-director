# Episode 12: Primary-Source Research Ledger
**Title**: The Mechanics of GPU Inference: KV Cache, PagedAttention & The Memory Wall  
**Target YouTube Date**: Tuesday, Jan 26, 2027 @ 19:00 UTC (2:00 PM EST)  
**Series Position**: Episode 12 of 13 Masterclass Curriculum  
**Primary Focus**: The physics and computer systems architecture of AI generation: Memory Bandwidth vs Compute, Key-Value Caching, Fragmentation, PagedAttention, FlashAttention, and Speculative Decoding.

---

## 1. Key Academic Papers & Primary Sources

### 1. PagedAttention & vLLM: Virtual Memory for LLM Serving
- **Paper**: *Efficient Memory Management for Large Language Model Serving with PagedAttention*
- **Authors**: Woosuk Kwon, Zhuohan Li, Siyuan Shen, Yanping Huang, Yida Wang, Keval Patel, Dachuan Wei, Mingxi Zhang, Dan Su, Hao Zhang, Ion Stoica (UC Berkeley LMSYS / Sky Computing Lab)
- **Venue**: SOSP 2023 (ACM Symposium on Operating Systems Principles)
- **arXiv**: [2309.06180](https://arxiv.org/abs/2309.06180)
- **Key Findings**:
  - In existing LLM serving systems, KV cache memory allocation is plagued by internal fragmentation (pre-allocating contiguous memory for worst-case maximum sequence length, e.g. 2048 or 8192 tokens) and external fragmentation (memory allocations cannot be reused until the entire request terminates).
  - Systems wasted between 60% and 80% of total GPU VRAM on unused, reserved KV cache slots.
  - PagedAttention introduces an OS-inspired virtual memory architecture: KV caches are broken into fixed-size physical memory blocks (e.g., 16 or 32 tokens per block).
  - A logical-to-physical block table translates non-contiguous physical GPU VRAM addresses dynamically during decoding.
  - Eliminates almost 100% of memory waste (fragmentation dropped to under 4%), allowing 2x–4x larger batch sizes and doubling serving throughput on identical hardware.
  - Enables near-zero overhead copy-on-write memory sharing for complex generation algorithms like parallel sampling and beam search.

---

### 2. FlashAttention & FlashAttention-2: Exact Attention with IO-Awareness
- **Paper**: *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness* (NeurIPS 2022) & *FlashAttention-2* (ICLR 2024)
- **Authors**: Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré (Stanford University, Together AI)
- **arXiv**: [2205.14135](https://arxiv.org/abs/2205.14135), [2307.08691](https://arxiv.org/abs/2307.08691)
- **Key Findings**:
  - Traditional Multi-Head Attention computes $S = Q K^T \in \mathbb{R}^{N \times N}$, writes $S$ to slow High Bandwidth Memory (HBM), reads $S$ to compute $P = \text{softmax}(S)$, writes $P$ back to HBM, and then reads $P$ to compute $O = P V$.
  - These repeated read/write roundtrips to HBM throttle GPU Tensor Cores, which spend most of their time waiting on memory bus bandwidth.
  - FlashAttention applies matrix tiling: it breaks $Q, K, V$ into smaller blocks that fit directly into the ultra-fast on-chip SRAM cache (100–200 KB per Streaming Multiprocessor on modern GPUs).
  - Uses the **Online Softmax** trick (Milakov & Gimelshein, 2018) to rescale softmax accumulators incrementally on chip without ever materializing the full $N \times N$ attention matrix in HBM.
  - Yields a 2x–4x wall-clock speedup for training and prefill, with $O(N)$ memory footprint instead of quadratic $O(N^2)$.

---

### 3. The Memory Wall & Arithmetic Intensity in LLM Decoding
- **Paper**: *AI and Memory Wall* (IEEE Micro 2024) & *A Survey on Efficient Inference for Large Language Models* (2024)
- **Authors**: Amir Gholami, Zhewei Yao, Sehoon Kim, Coleman Hooper, Michael W. Mahoney, Kurt Keutzer (UC Berkeley)
- **Key Findings**:
  - Deep learning hardware operates under the **Roofline Model**: Performance is bound either by peak compute capacity (TFLOPs) or memory bandwidth (TB/s).
  - **Prefill Phase (Prompt Processing)**: Highly parallelizable. A prompt of 1,024 tokens is processed as a dense matrix multiplication (GEMM). Arithmetic intensity is high ($>100$ FLOPs per byte loaded from memory). Compute-bound.
  - **Decode Phase (Token Generation)**: Autoregressive generation generates exactly ONE token at a time. The GPU must load the entire model weight matrix (e.g. 140 GB for a 70B FP16 model) from HBM into SRAM just to do a single matrix-vector multiplication (GEMV).
  - Arithmetic intensity collapses to $\approx 1$ FLOP per byte!
  - Modern GPUs (e.g., NVIDIA H100 with 3.35 TB/s HBM3 memory bandwidth and 2,000 TFLOPs FP16 compute) have an operational intensity threshold of $\approx 600$ FLOPs/byte. At 1 FLOP/byte, the Tensor Cores sit over 99% idle!
  - Generation speed for batch size 1 is strictly capped by:
    $$\text{Tokens per second} \approx \frac{\text{Memory Bandwidth (TB/s)}}{\text{Model Parameters (Bytes)}}$$

---

### 4. KV Cache Arithmetic: The Exponential Memory Tax
- **Mathematical Formula**:
  $$\text{KV Cache Size (Bytes)} = 2 \times n_{\text{layers}} \times n_{\text{heads}} \times d_{\text{head}} \times \text{seq\_len} \times \text{batch\_size} \times \text{precision\_bytes}$$
  - Factor of 2: One tensor for Keys, one tensor for Values.
  - For Llama-2-70B (80 layers, 64 heads, 128 dimension, 16-bit float = 2 bytes):
    $$\text{KV per token} = 2 \times 80 \times 64 \times 128 \times 2 = 2.62 \text{ MB per token}$$
  - For context length 4,096 tokens: $10.7 \text{ GB}$ per single concurrent user!
  - For batch size 32: $342 \text{ GB}$ just for the KV cache—more than double the weight size of the model itself!

---

### 5. Multi-Query Attention (MQA) & Grouped-Query Attention (GQA)
- **Papers**:
  - *Fast Transformer Decoding: One Write-Head is All You Need* (Noam Shazeer, Google, 2019)
  - *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints* (Ainslie et al., Google Research, 2023)
- **Key Findings**:
  - Standard Multi-Head Attention (MHA): $H$ Query heads, $H$ Key heads, $H$ Value heads.
  - Multi-Query Attention (MQA): $H$ Query heads share 1 single Key head and 1 single Value head. Reduces KV cache bandwidth and memory by a factor of $H$ (e.g. 32x to 64x), but can degrade quality on complex associative tasks.
  - Grouped-Query Attention (GQA): Groups Query heads into $G$ groups (e.g. 8 groups for 64 heads = 8 Key/Value heads). Retains MHA-level reasoning accuracy while slashing KV cache memory and bandwidth by 8x. Adopted by Llama 3, Mistral, DeepSeek-V3, and Gemma.

---

### 6. Speculative Decoding: Beating the Memory Wall
- **Papers**:
  - *Fast Inference from Transformers via Speculative Decoding* (Leviathan et al., Google Research, ICML 2023)
  - *Accelerating Large Language Model Decoding with Speculative Sampling* (Chen et al., DeepMind, 2023)
- **Key Findings**:
  - Small "draft" model (e.g. 1B parameter model) runs fast because its weights are small enough to be loaded rapidly. It proposes $K$ tokens in sequence.
  - Large "target" model (e.g. 70B parameter model) evaluates all $K$ tokens in a single parallel forward pass (turning a memory-bandwidth-bound GEMV into a compute-bound GEMM).
  - Modified rejection sampling algorithm guarantees that the resulting token probability distribution is mathematically identical to sampling directly from the 70B model.
  - Achieves 2x to 3x wall-clock speedup without any loss of quality.
