/**
 * @lsi/vljepa/y-encoder - Y-Encoder (Language Encoder) for VL-JEPA
 *
 * The Y-Encoder processes user intent text into 768-dimensional semantic embeddings.
 * It is the language component of VL-JEPA, complementary to the X-Encoder (Vision).
 *
 * ## Components
 *
 * 1. **TextTokenizer**: BPE tokenization with UI-specific vocabulary
 * 2. **EmbeddingLayer**: Token + positional embeddings (768-dim)
 * 3. **TextEncoder**: 12-layer transformer encoder
 * 4. **YEncoder**: Main encoder with pooling strategies
 * 5. **YEncoderIntentBridge**: Integration with IntentEncoder
 *
 * @version 1.0.0
 */

// ============================================================================
// MAIN Y-ENCODER
// ============================================================================

export {
  YEncoder,
  createYEncoder,
  createYEncoderFromConfig,
  PoolingStrategy,
  type YEncoderOptions,
  type EncodingResult,
} from "./YEncoder.js";

// ============================================================================
// TEXT TOKENIZER
// ============================================================================

export {
  TextTokenizer,
  SpecialToken,
  SPECIAL_TOKEN_STRINGS,
  createTokenizer,
  getSpecialTokenCount,
  type TokenizerConfig,
  type TokenizationResult,
} from "./TextTokenizer.js";

// ============================================================================
// EMBEDDING LAYER
// ============================================================================

export {
  EmbeddingLayer,
  PositionalEncodingType,
  createEmbeddingLayer,
  type EmbeddingLayerConfig,
  type EmbeddingResult,
} from "./EmbeddingLayer.js";

// ============================================================================
// TEXT ENCODER (TRANSFORMER)
// ============================================================================

export {
  MultiHeadAttention,
  FeedForwardNetwork,
  TransformerEncoderLayer,
  TextEncoder,
  createTextEncoder,
  type AttentionConfig,
  type FeedForwardConfig,
  type TransformerLayerConfig,
  type AttentionOutput,
  type LayerOutput,
} from "./TextEncoder.js";

// ============================================================================
// INTENT ENCODER INTEGRATION
// ============================================================================

export {
  YEncoderIntentBridge,
  createYEncoderIntentBridge,
  toIntentVector,
  fromIntentVector,
  embeddingSimilarity,
  fuseEmbeddings,
  type FusionConfig,
  type CombinedEncodingResult,
} from "./YEncoderIntentBridge.js";
