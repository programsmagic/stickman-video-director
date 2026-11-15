# Episode 05: Primary Academic Research & Citation Ledger
### *The Token Illusion: How Machines Read Without Eyes*

## Core Research Papers

1. **Neural Machine Translation of Rare Words with Subword Units** (Sennrich, Haddow, & Birch, ACL 2016)
   - *Key Finding*: Introduction of Byte-Pair Encoding (BPE) compression for neural language models, replacing fixed word vocabularies with frequency-driven subword merging.
   - *DOI / Citation*: `arXiv:1508.07909`

2. **SentencePiece: A Simple and Language Independent Subword Tokenizer and Detokenizer for Neural Text Processing** (Kudo & Richardson, EMNLP 2018)
   - *Key Finding*: Treating text as raw Unicode byte streams without whitespace assumptions; unigram language model segmentation for language-agnostic tokenization.
   - *DOI / Citation*: `arXiv:1808.06226`

3. **SolidGoldMagikarp and Other Anomalous Tokens** (Land & Rumbelow, LessWrong 2023)
   - *Key Finding*: Discovery of "glitch tokens" in GPT tokenizers resulting from Reddit scraping, producing negative inner-product embeddings that break LLM attention.
   - *Source*: Alignment Research Center / LessWrong Investigation

4. **Tokenization Falls Short: The Impact of Tokenization on Subword Inequity** (Petrov et al., EMNLP 2023)
   - *Key Finding*: English text requires ~1.3 tokens per word, whereas low-resource languages (Hindi, Arabic, Swahili) require up to 6–10 tokens per word, causing massive latency and cost disparities.
   - *DOI / Citation*: `arXiv:2305.15425`

5. **Byte Latent Transformer: Patches vs. Bytes** (Meta FAIR, 2024)
   - *Key Finding*: Eliminating tokenizers entirely by operating on raw bytes grouped into dynamically pooled entropy patches.
   - *DOI / Citation*: `arXiv:2412.09871`
