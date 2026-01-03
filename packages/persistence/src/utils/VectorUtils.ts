export class VectorUtils {
  static dotProduct(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Vectors must have the same length. Got ${a.length} and ${b.length}`);
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }
    return result;
  }

  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const dotProduct = this.dotProduct(a, b);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  static normalize(vector: Float32Array): Float32Array {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return new Float32Array(vector.length);
    }
    return vector.map(val => val / magnitude);
  }

  static vectorToBuffer(vector: Float32Array): Buffer {
    return Buffer.from(vector.buffer);
  }

  static bufferToVector(buffer: Buffer): Float32Array {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
  }

  static generateRandomVector(dimensions: number): Float32Array {
    const vector = new Float32Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      vector[i] = (Math.random() - 0.5) * 2; // -1 to 1
    }
    return vector;
  }

  static validateDimensions(vector: Float32Array, expectedDimensions: number): void {
    if (vector.length !== expectedDimensions) {
      throw new Error(`Vector must have ${expectedDimensions} dimensions. Got ${vector.length}`);
    }
  }
}