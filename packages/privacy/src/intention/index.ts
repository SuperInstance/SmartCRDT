/**
 * @lsi/privacy/intention - Intent encoding with ε-differential privacy
 *
 * This module provides privacy-preserving intent encoding that transforms
 * user queries into vectors that capture semantic intent while providing
 * differential privacy guarantees.
 */

export {
  IntentEncoder,
  cosineSimilarity,
  euclideanDistance,
} from "./IntentEncoder.js";
