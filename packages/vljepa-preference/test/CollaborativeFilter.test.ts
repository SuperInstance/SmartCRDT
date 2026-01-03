/**
 * Tests for CollaborativeFilter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CollaborativeFilter } from "../src/models/CollaborativeFilter.js";

describe("CollaborativeFilter", () => {
  let filter: CollaborativeFilter;

  beforeEach(() => {
    filter = new CollaborativeFilter({
      method: "user_based",
      neighbors: 5,
      minOverlap: 2,
      factors: 10,
      iterations: 20,
      regularization: 0.01
    });
  });

  describe("Rating Management", () => {
    it("should add a rating", () => {
      filter.addRating({
        userId: "user-1",
        itemId: "item-1",
        rating: 5,
        timestamp: Date.now()
      });

      const rating = filter.getRating("user-1", "item-1");
      expect(rating).toBe(5);
    });

    it("should add multiple ratings", () => {
      const ratings = [
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 3, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 4, timestamp: Date.now() }
      ];

      filter.addRatings(ratings);

      expect(filter.getRating("user-1", "item-1")).toBe(5);
      expect(filter.getRating("user-1", "item-2")).toBe(3);
      expect(filter.getRating("user-2", "item-1")).toBe(4);
    });

    it("should get user ratings", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 3, timestamp: Date.now() }
      ]);

      const userRatings = filter.getUserRatings("user-1");

      expect(userRatings.size).toBe(2);
      expect(userRatings.get("item-1")).toBe(5);
      expect(userRatings.get("item-2")).toBe(3);
    });

    it("should get item ratings", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 4, timestamp: Date.now() }
      ]);

      const itemRatings = filter.getItemRatings("item-1");

      expect(itemRatings.size).toBe(2);
      expect(itemRatings.get("user-1")).toBe(5);
      expect(itemRatings.get("user-2")).toBe(4);
    });
  });

  describe("Similarity Calculation", () => {
    it("should calculate user similarity", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 3, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-2", rating: 3, timestamp: Date.now() }
      ]);

      const similarity = filter.calculateUserSimilarity("user-1", "user-2");

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should return 0 for users with no overlap", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-2", rating: 5, timestamp: Date.now() }
      ]);

      const similarity = filter.calculateUserSimilarity("user-1", "user-2");

      expect(similarity).toBe(0);
    });

    it("should calculate item similarity", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-2", rating: 5, timestamp: Date.now() }
      ]);

      const similarity = filter.calculateItemSimilarity("item-1", "item-2");

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe("User Finding", () => {
    it("should find similar users", () => {
      // Create users with similar patterns
      for (let i = 0; i < 5; i++) {
        filter.addRatings([
          { userId: `user-${i}`, itemId: "item-1", rating: 5, timestamp: Date.now() },
          { userId: `user-${i}`, itemId: "item-2", rating: 4, timestamp: Date.now() }
        ]);
      }

      const similarUsers = filter.findSimilarUsers("user-0");

      expect(similarUsers.length).toBeGreaterThan(0);
      expect(similarUsers[0]?.userId).not.toBe("user-0");
    });

    it("should sort similar users by similarity", () => {
      filter.addRatings([
        // user-1 and user-0 very similar
        { userId: "user-0", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-0", itemId: "item-2", rating: 4, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 4, timestamp: Date.now() },
        // user-2 less similar
        { userId: "user-2", itemId: "item-1", rating: 3, timestamp: Date.now() }
      ]);

      const similarUsers = filter.findSimilarUsers("user-0");

      expect(similarUsers.length).toBeGreaterThan(0);
      expect(similarUsers[0]?.similarity).toBeGreaterThanOrEqual(
        similarUsers[similarUsers.length - 1]!.similarity
      );
    });
  });

  describe("Recommendations", () => {
    it("should generate user-based recommendations", () => {
      filter.setConfig({ method: "user_based" });

      // Create user-item matrix
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          filter.addRating({
            userId: `user-${i}`,
            itemId: `item-${j}`,
            rating: Math.floor(Math.random() * 5) + 1,
            timestamp: Date.now()
          });
        }
      }

      const recommendations = filter.recommend("user-0", 5);

      expect(recommendations.userId).toBe("user-0");
      expect(recommendations.items).toBeDefined();
      expect(recommendations.method).toBe("user_based");
      expect(recommendations.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should generate item-based recommendations", () => {
      filter.setConfig({ method: "item_based" });

      // Create user-item matrix
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
          filter.addRating({
            userId: `user-${i}`,
            itemId: `item-${j}`,
            rating: Math.floor(Math.random() * 5) + 1,
            timestamp: Date.now()
          });
        }
      }

      const recommendations = filter.recommend("user-0", 5);

      expect(recommendations.method).toBe("item_based");
      expect(recommendations.items.length).toBeLessThanOrEqual(5);
    });

    it("should generate matrix factorization recommendations", () => {
      filter.setConfig({ method: "matrix_factorization" });

      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          filter.addRating({
            userId: `user-${i}`,
            itemId: `item-${j}`,
            rating: Math.floor(Math.random() * 5) + 1,
            timestamp: Date.now()
          });
        }
      }

      const recommendations = filter.recommend("user-0", 5);

      expect(recommendations.method).toBe("matrix_factorization");
      expect(recommendations.items).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should set and get configuration", () => {
      filter.setConfig({ neighbors: 20, minOverlap: 5 });

      const config = filter.getConfig();

      expect(config.neighbors).toBe(20);
      expect(config.minOverlap).toBe(5);
    });

    it("should use new configuration for recommendations", () => {
      filter.setConfig({ method: "item_based" });

      const recs = filter.recommend("user-1", 5);

      expect(recs.method).toBe("item_based");
    });
  });

  describe("Data Management", () => {
    it("should export all ratings", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 3, timestamp: Date.now() }
      ]);

      const exported = filter.exportRatings();

      expect(exported.length).toBe(2);
    });

    it("should clear all ratings", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() }
      ]);

      expect(filter.getRating("user-1", "item-1")).toBe(5);

      filter.clear();

      expect(filter.getRating("user-1", "item-1")).toBeNull();
    });
  });

  describe("Statistics", () => {
    it("should calculate statistics", () => {
      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 3, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 4, timestamp: Date.now() }
      ]);

      const stats = filter.getStatistics();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalItems).toBe(2);
      expect(stats.totalRatings).toBe(3);
      expect(stats.avgRating).toBeCloseTo(4);
      expect(stats.sparsity).toBeGreaterThanOrEqual(0);
      expect(stats.sparsity).toBeLessThanOrEqual(1);
    });

    it("should handle empty data", () => {
      const stats = filter.getStatistics();

      expect(stats.totalUsers).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.totalRatings).toBe(0);
      expect(stats.avgRating).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-existent user", () => {
      const recs = filter.recommend("non-existent", 5);

      expect(recs.items).toHaveLength(0);
    });

    it("should handle non-existent rating", () => {
      const rating = filter.getRating("user-1", "item-1");

      expect(rating).toBeNull();
    });

    it("should handle single user", () => {
      filter.addRating({
        userId: "user-1",
        itemId: "item-1",
        rating: 5,
        timestamp: Date.now()
      });

      const similarUsers = filter.findSimilarUsers("user-1");

      expect(similarUsers).toHaveLength(0);
    });

    it("should handle min overlap threshold", () => {
      filter.setConfig({ minOverlap: 5 });

      filter.addRatings([
        { userId: "user-1", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-1", itemId: "item-2", rating: 4, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-1", rating: 5, timestamp: Date.now() },
        { userId: "user-2", itemId: "item-3", rating: 3, timestamp: Date.now() }
      ]);

      const similarity = filter.calculateUserSimilarity("user-1", "user-2");

      // Only 1 common item, less than minOverlap of 5
      expect(similarity).toBe(0);
    });
  });
});
