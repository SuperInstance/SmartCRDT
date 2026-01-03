/**
 * Mock Data Generators for LangGraph Examples
 *
 * Generate realistic mock data for testing and demonstrations
 */

import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Mock Message Generator
 */
export class MockMessageGenerator {
  /**
   * Generate a conversation
   */
  static generateConversation(rounds = 3): BaseMessage[] {
    const messages: BaseMessage[] = [];

    const humanPrompts = [
      'Hello, can you help me with something?',
      'I need to analyze some data.',
      'What are the key findings?',
      'Can you explain that in more detail?',
      'Thank you for your help.',
    ];

    const aiResponses = [
      'Of course! I\'m here to help. What do you need?',
      'I\'d be happy to help analyze your data. Please share it.',
      'Based on my analysis, there are several important patterns.',
      'Let me break that down for you step by step.',
      'You\'re welcome! Let me know if you need anything else.',
    ];

    for (let i = 0; i < rounds; i++) {
      messages.push(new HumanMessage(humanPrompts[i % humanPrompts.length]));
      messages.push(new AIMessage(aiResponses[i % aiResponses.length]));
    }

    return messages;
  }

  /**
   * Generate system message
   */
  static generateSystemMessage(content?: string): SystemMessage {
    return new SystemMessage(
      content ||
        'You are a helpful AI assistant. Provide clear, accurate, and friendly responses.'
    );
  }

  /**
   * Generate human message
   */
  static generateHumanMessage(content?: string): HumanMessage {
    return new HumanMessage(
      content || 'Hello, I have a question about your services.'
    );
  }

  /**
   * Generate AI message
   */
  static generateAIMessage(content?: string): AIMessage {
    return new AIMessage(
      content || 'Of course! I\'d be happy to help answer your questions.'
    );
  }
}

/**
 * Mock User Data Generator
 */
export class MockUserDataGenerator {
  /**
   * Generate a random user
   */
  static generateUser() {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const domains = ['example.com', 'test.com', 'demo.com', 'sample.com'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];

    return {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      age: Math.floor(Math.random() * 50) + 20,
      city: this.getRandomCity(),
      country: this.getRandomCountry(),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Generate multiple users
   */
  static generateUsers(count = 10) {
    return Array.from({ length: count }, () => this.generateUser());
  }

  private static getRandomCity() {
    const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Sydney', 'Berlin', 'Toronto', 'Singapore'];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  private static getRandomCountry() {
    const countries = ['USA', 'UK', 'Japan', 'France', 'Australia', 'Germany', 'Canada', 'Singapore'];
    return countries[Math.floor(Math.random() * countries.length)];
  }
}

/**
 * Mock Code Review Data Generator
 */
export class MockCodeReviewGenerator {
  /**
   * Generate a code snippet
   */
  static generateCodeSnippet(language = 'typescript') {
    const snippets: Record<string, string> = {
      typescript: `
function calculateTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const cart = [
  { price: 10, quantity: 2 },
  { price: 5, quantity: 3 }
];

console.log(calculateTotal(cart));
`,
      javascript: `
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const cart = [
  { price: 10, quantity: 2 },
  { price: 5, quantity: 3 }
];

console.log(calculateTotal(cart));
`,
      python: `
def calculate_total(items):
    return sum(item['price'] * item['quantity'] for item in items)

cart = [
    {'price': 10, 'quantity': 2},
    {'price': 5, 'quantity': 3}
]

print(calculate_total(cart))
`,
    };

    return snippets[language] || snippets.typescript;
  }

  /**
   * Generate code review comments
   */
  static generateReviewComments() {
    const comments = [
      { line: 2, type: 'suggestion', message: 'Consider adding input validation' },
      { line: 5, type: 'issue', message: 'Magic numbers should be constants' },
      { line: 8, type: 'praise', message: 'Good use of reduce function' },
      { line: 10, type: 'suggestion', message: 'Add JSDoc comments for better documentation' },
    ];

    return comments.slice(0, Math.floor(Math.random() * comments.length) + 1);
  }

  /**
   * Generate a pull request
   */
  static generatePullRequest() {
    const titles = [
      'Fix calculation bug in checkout',
      'Add user authentication',
      'Implement search functionality',
      'Refactor database layer',
      'Add unit tests for payment module',
    ];

    return {
      id: `pr_${Date.now()}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      author: MockUserDataGenerator.generateUser(),
      branch: `feature/${Math.random().toString(36).substring(2, 8)}`,
      baseBranch: 'main',
      status: this.getRandomStatus(),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: Math.floor(Math.random() * 5),
      comments: Math.floor(Math.random() * 20),
    };
  }

  private static getRandomStatus() {
    const statuses = ['open', 'merged', 'closed', 'draft'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}

/**
 * Mock Customer Support Data Generator
 */
export class MockSupportDataGenerator {
  /**
   * Generate a support ticket
   */
  static generateTicket() {
    const subjects = [
      'Unable to login to my account',
      'Payment failed during checkout',
      'Feature request: Dark mode',
      'Bug report: App crashes on startup',
      'Question: How do I export my data?',
    ];

    const priorities = ['low', 'medium', 'high', 'urgent'];
    const statuses = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];

    return {
      id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      description: this.generateDescription(),
      customer: MockUserDataGenerator.generateUser(),
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      category: this.getRandomCategory(),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      assignedTo: Math.random() > 0.5 ? MockUserDataGenerator.generateUser() : null,
      messages: this.generateTicketMessages(),
    };
  }

  /**
   * Generate multiple tickets
   */
  static generateTickets(count = 20) {
    return Array.from({ length: count }, () => this.generateTicket());
  }

  private static generateDescription() {
    const descriptions = [
      'I have been trying to access my account for the past hour but keep getting an error message.',
      'My payment was declined but my card is valid and I have sufficient funds.',
      'It would be great if you could add a dark mode option to the application.',
      'The application crashes every time I try to open it on my device.',
      'I would like to know how to export my data in CSV format.',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private static getRandomCategory() {
    const categories = ['technical', 'billing', 'feature', 'bug', 'question'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private static generateTicketMessages() {
    const count = Math.floor(Math.random() * 5) + 1;
    const messages: Array<{ role: string; content: string; timestamp: string }> = [];

    for (let i = 0; i < count; i++) {
      const isCustomer = i % 2 === 0;
      messages.push({
        role: isCustomer ? 'customer' : 'agent',
        content: isCustomer
          ? 'I am still experiencing this issue. Can you please help?'
          : 'Thank you for reaching out. I am looking into this now.',
        timestamp: new Date(Date.now() - (count - i) * 60 * 60 * 1000).toISOString(),
      });
    }

    return messages;
  }
}

/**
 * Mock Data Analysis Data Generator
 */
export class MockAnalysisDataGenerator {
  /**
   * Generate time series data
   */
  static generateTimeSeriesData(points = 100) {
    const data: Array<{ timestamp: string; value: number }> = [];
    const now = Date.now();
    let value = 100;

    for (let i = points - 1; i >= 0; i--) {
      const change = (Math.random() - 0.5) * 10;
      value = Math.max(0, value + change);
      data.push({
        timestamp: new Date(now - i * 60 * 60 * 1000).toISOString(),
        value: parseFloat(value.toFixed(2)),
      });
    }

    return data;
  }

  /**
   * Generate dataset
   */
  static generateDataset(rows = 1000) {
    const columns = ['id', 'name', 'category', 'value', 'timestamp'];
    const categories = ['A', 'B', 'C', 'D'];
    const data: Record<string, unknown>[] = [];

    for (let i = 0; i < rows; i++) {
      data.push({
        id: i,
        name: `Item ${i}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        value: parseFloat((Math.random() * 1000).toFixed(2)),
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return { columns, data };
  }

  /**
   * Generate analysis result
   */
  static generateAnalysisResult() {
    return {
      summary: {
        totalRows: Math.floor(Math.random() * 10000) + 100,
        totalColumns: Math.floor(Math.random() * 20) + 5,
        missingValues: Math.floor(Math.random() * 100),
        duplicateRows: Math.floor(Math.random() * 50),
      },
      statistics: {
        mean: parseFloat((Math.random() * 100).toFixed(2)),
        median: parseFloat((Math.random() * 100).toFixed(2)),
        stdDev: parseFloat((Math.random() * 20).toFixed(2)),
        min: parseFloat((Math.random() * 10).toFixed(2)),
        max: parseFloat((Math.random() * 100 + 50).toFixed(2)),
      },
      insights: [
        'Data shows a clear upward trend over the past month',
        'Peak values occur on weekdays',
        'Category B has the highest average value',
      ],
    };
  }
}

/**
 * Mock Content Creation Data Generator
 */
export class MockContentGenerator {
  /**
   * Generate blog post
   */
  static generateBlogPost() {
    const titles = [
      'The Future of AI in Software Development',
      '10 Best Practices for Clean Code',
      'Understanding Distributed Systems',
      'A Guide to Modern Web Development',
      'Introduction to Machine Learning',
    ];

    return {
      id: `post_${Date.now()}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      author: MockUserDataGenerator.generateUser(),
      content: this.generateContent(),
      tags: this.generateTags(),
      status: this.getRandomStatus(),
      publishedAt:
        Math.random() > 0.5
          ? new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      views: Math.floor(Math.random() * 10000),
      likes: Math.floor(Math.random() * 500),
    };
  }

  private static generateContent() {
    return `
# Introduction

This is a comprehensive guide on the topic. We will explore various aspects and best practices.

## Main Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Key Points

- First important point
- Second important point
- Third important point

## Conclusion

In summary, we have covered the essential aspects of this topic. Thank you for reading!
    `.trim();
  }

  private static generateTags() {
    const allTags = ['AI', 'Development', 'Tutorial', 'Best Practices', 'Technology', 'Programming'];
    const count = Math.floor(Math.random() * 4) + 2;
    const shuffled = allTags.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private static getRandomStatus() {
    const statuses = ['draft', 'review', 'published', 'archived'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}

/**
 * Mock Sentiment Data Generator
 */
export class MockSentimentGenerator {
  /**
   * Generate text with sentiment
   */
  static generateTextWithSentiment() {
    const sentiments = ['positive', 'neutral', 'negative'];
    const texts: Record<string, string[]> = {
      positive: [
        'This is amazing! I love it.',
        'Great job on the recent update.',
        'Excellent service and support.',
        'I am very satisfied with the product.',
      ],
      neutral: [
        'The application works as expected.',
        'I have a question about the features.',
        'Can you provide more information?',
        'The product is decent.',
      ],
      negative: [
        'I am experiencing issues with the app.',
        'The service is not working properly.',
        'I am disappointed with the quality.',
        'This needs improvement.',
      ],
    };

    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    const text = texts[sentiment][Math.floor(Math.random() * texts[sentiment].length)];

    return {
      text,
      sentiment,
      confidence: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)),
    };
  }

  /**
   * Generate sentiment analysis result
   */
  static generateSentimentAnalysis() {
    return {
      sentiment: this.getRandomSentiment(),
      score: parseFloat((Math.random() * 2 - 1).toFixed(2)),
      confidence: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)),
      emotions: {
        joy: parseFloat(Math.random().toFixed(2)),
        sadness: parseFloat(Math.random().toFixed(2)),
        anger: parseFloat(Math.random().toFixed(2)),
        fear: parseFloat(Math.random().toFixed(2)),
        surprise: parseFloat(Math.random().toFixed(2)),
      },
    };
  }

  private static getRandomSentiment() {
    const sentiments = ['positive', 'neutral', 'negative'];
    return sentiments[Math.floor(Math.random() * sentiments.length)];
  }
}

/**
 * Mock Error Generator
 */
export class MockErrorGenerator {
  /**
   * Generate a random error
   */
  static generateError() {
    const errors = [
      {
        type: 'NetworkError',
        message: 'Failed to connect to server',
        code: 'NET_001',
        retryable: true,
      },
      {
        type: 'ValidationError',
        message: 'Invalid input data',
        code: 'VAL_001',
        retryable: false,
      },
      {
        type: 'AuthenticationError',
        message: 'Invalid credentials',
        code: 'AUTH_001',
        retryable: false,
      },
      {
        type: 'RateLimitError',
        message: 'Too many requests',
        code: 'RATE_001',
        retryable: true,
      },
      {
        type: 'TimeoutError',
        message: 'Request timed out',
        code: 'TIMEOUT_001',
        retryable: true,
      },
    ];

    return errors[Math.floor(Math.random() * errors.length)];
  }
}
