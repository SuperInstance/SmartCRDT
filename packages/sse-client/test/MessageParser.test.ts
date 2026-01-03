/**
 * MessageParser Tests
 */

import { describe, it, expect } from 'vitest';
import { MessageParser } from '../src/MessageParser.js';

describe('MessageParser', () => {
  describe('parseLine', () => {
    it('should parse simple data line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('data: hello world', 0);
      expect(result.field).toBe('data');
      expect(result.value).toBe('hello world');
      expect(result.line).toBe(0);
    });

    it('should parse event line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('event: custom', 0);
      expect(result.field).toBe('event');
      expect(result.value).toBe('custom');
    });

    it('should parse id line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('id: 12345', 0);
      expect(result.field).toBe('id');
      expect(result.value).toBe('12345');
    });

    it('should parse retry line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('retry: 5000', 0);
      expect(result.field).toBe('retry');
      expect(result.value).toBe('5000');
    });

    it('should handle empty line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('', 0);
      expect(result.field).toBeNull();
      expect(result.value).toBe('');
    });

    it('should handle comment line', () => {
      const parser = new MessageParser();
      const result = parser.parseLine(': this is a comment', 0);
      expect(result.field).toBe('comment');
      expect(result.value).toBe('this is a comment');
    });

    it('should handle line starting with colon', () => {
      const parser = new MessageParser();
      const result = parser.parseLine(':data test', 0);
      expect(result.field).toBe('comment');
    });

    it('should handle line without colon', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('data', 0);
      expect(result.field).toBe('data');
      expect(result.value).toBe('');
    });

    it('should handle multiple colons', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('data: key: value', 0);
      expect(result.field).toBe('data');
      expect(result.value).toBe('key: value');
    });

    it('should trim whitespace', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('  data:   hello   ', 0);
      expect(result.field).toBe('data');
      expect(result.value).toBe('hello');
    });

    it('should handle space after colon', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('data: hello', 0);
      expect(result.value).toBe('hello');
    });

    it('should handle no space after colon', () => {
      const parser = new MessageParser();
      const result = parser.parseLine('data:hello', 0);
      expect(result.value).toBe('hello');
    });
  });

  describe('splitLines', () => {
    it('should split by LF', () => {
      const parser = new MessageParser();
      const lines = parser.splitLines('line1\nline2\nline3');
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split by CRLF', () => {
      const parser = new MessageParser();
      const lines = parser.splitLines('line1\r\nline2\r\nline3');
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle mixed line endings', () => {
      const parser = new MessageParser();
      const lines = parser.splitLines('line1\nline2\r\nline3');
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle single line', () => {
      const parser = new MessageParser();
      const lines = parser.splitLines('single line');
      expect(lines).toEqual(['single line']);
    });

    it('should handle empty string', () => {
      const parser = new MessageParser();
      const lines = parser.splitLines('');
      expect(lines).toEqual(['']);
    });
  });

  describe('groupIntoBlocks', () => {
    it('should parse single message', () => {
      const parser = new MessageParser();
      const lines = ['data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].event).toBe('message');
      expect(blocks[0].data).toBe('hello');
    });

    it('should parse multiple messages', () => {
      const parser = new MessageParser();
      const lines = ['data: hello', '', 'data: world', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].data).toBe('hello');
      expect(blocks[1].data).toBe('world');
    });

    it('should parse multi-line data', () => {
      const parser = new MessageParser();
      const lines = ['data: line1', 'data: line2', 'data: line3', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].data).toBe('line1\nline2\nline3');
    });

    it('should parse custom event type', () => {
      const parser = new MessageParser();
      const lines = ['event: custom', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].event).toBe('custom');
      expect(blocks[0].data).toBe('hello');
    });

    it('should parse message ID', () => {
      const parser = new MessageParser();
      const lines = ['id: 12345', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe('12345');
    });

    it('should parse retry value', () => {
      const parser = new MessageParser();
      const lines = ['retry: 5000', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].retry).toBe(5000);
    });

    it('should ignore invalid retry', () => {
      const parser = new MessageParser();
      const lines = ['retry: invalid', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].retry).toBeNull();
    });

    it('should ignore comments', () => {
      const parser = new MessageParser();
      const lines = [': comment', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].data).toBe('hello');
    });

    it('should ignore unknown fields', () => {
      const parser = new MessageParser();
      const lines = ['unknown: value', 'data: hello', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].data).toBe('hello');
    });

    it('should handle unterminated final block', () => {
      const parser = new MessageParser();
      const lines = ['data: hello'];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].data).toBe('hello');
    });

    it('should handle multiple consecutive empty lines', () => {
      const parser = new MessageParser();
      const lines = ['data: hello', '', '', 'data: world', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks).toHaveLength(2);
    });

    it('should reset event type for each block', () => {
      const parser = new MessageParser();
      const lines = ['event: custom1', 'data: hello', '', 'data: world', ''];
      const blocks = parser.groupIntoBlocks(lines);
      expect(blocks[0].event).toBe('custom1');
      expect(blocks[1].event).toBe('message');
    });
  });

  describe('convertBlocksToMessages', () => {
    it('should convert block to message', () => {
      const parser = new MessageParser();
      const blocks = [
        { event: 'message', data: 'hello', id: '123', retry: null }
      ];
      const messages = parser.convertBlocksToMessages(blocks, 'https://example.com');
      expect(messages).toHaveLength(1);
      expect(messages[0].event).toBe('message');
      expect(messages[0].data).toBe('hello');
      expect(messages[0].id).toBe('123');
      expect(messages[0].origin).toBe('https://example.com');
      expect(messages[0].timestamp).toBeGreaterThan(0);
    });

    it('should parse JSON data', () => {
      const parser = new MessageParser();
      const blocks = [
        { event: 'message', data: '{"key":"value"}', id: null, retry: null }
      ];
      const messages = parser.convertBlocksToMessages(blocks, 'https://example.com');
      expect(messages[0].json).toEqual({ key: 'value' });
    });

    it('should not fail on invalid JSON', () => {
      const parser = new MessageParser();
      const blocks = [
        { event: 'message', data: 'not json', id: null, retry: null }
      ];
      const messages = parser.convertBlocksToMessages(blocks, 'https://example.com');
      expect(messages[0].json).toBeUndefined();
    });

    it('should use last event ID if block ID is null', () => {
      const parser = new MessageParser();
      parser.lastEventId = '999';
      const blocks = [
        { event: 'message', data: 'hello', id: null, retry: null }
      ];
      const messages = parser.convertBlocksToMessages(blocks, 'https://example.com');
      expect(messages[0].id).toBe('999');
    });
  });

  describe('parse', () => {
    it('should parse complete SSE stream', () => {
      const parser = new MessageParser();
      const raw = 'data: hello\n\ndata: world\n\n';
      const messages = parser.parse(raw, 'https://example.com');
      expect(messages).toHaveLength(2);
      expect(messages[0].data).toBe('hello');
      expect(messages[1].data).toBe('world');
    });

    it('should parse complex SSE stream', () => {
      const parser = new MessageParser();
      const raw = 'event: custom\nid: 123\ndata: hello\n\n';
      const messages = parser.parse(raw, 'https://example.com');
      expect(messages).toHaveLength(1);
      expect(messages[0].event).toBe('custom');
      expect(messages[0].id).toBe('123');
      expect(messages[0].data).toBe('hello');
    });

    it('should handle empty data', () => {
      const parser = new MessageParser();
      const raw = 'data:\n\n';
      const messages = parser.parse(raw, 'https://example.com');
      expect(messages).toHaveLength(1);
      expect(messages[0].data).toBe('');
    });
  });

  describe('parseMessage', () => {
    it('should parse simple message', () => {
      const parser = new MessageParser();
      const message = parser.parseMessage('hello', 'message', '123', 'https://example.com');
      expect(message.data).toBe('hello');
      expect(message.event).toBe('message');
      expect(message.id).toBe('123');
      expect(message.origin).toBe('https://example.com');
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it('should parse JSON message', () => {
      const parser = new MessageParser();
      const message = parser.parseMessage('{"key":"value"}', 'message', null, 'https://example.com');
      expect(message.json).toEqual({ key: 'value' });
    });
  });

  describe('validateMessage', () => {
    it('should validate correct message', () => {
      const parser = new MessageParser();
      const message = {
        id: '123',
        event: 'message',
        data: 'hello',
        origin: 'https://example.com',
        timestamp: Date.now()
      };
      expect(parser.validateMessage(message)).toBe(true);
    });

    it('should reject message without data', () => {
      const parser = new MessageParser();
      const message = {
        id: '123',
        event: 'message',
        data: '',
        origin: 'https://example.com',
        timestamp: Date.now()
      };
      expect(parser.validateMessage(message)).toBe(false);
    });

    it('should reject message with invalid timestamp', () => {
      const parser = new MessageParser();
      const message = {
        id: '123',
        event: 'message',
        data: 'hello',
        origin: 'https://example.com',
        timestamp: -1
      };
      expect(parser.validateMessage(message)).toBe(false);
    });
  });

  describe('getLastEventId', () => {
    it('should return empty initially', () => {
      const parser = new MessageParser();
      expect(parser.getLastEventId()).toBe('');
    });

    it('should return last event ID after parsing', () => {
      const parser = new MessageParser();
      parser.parse('id: 123\ndata: test\n\n', 'https://example.com');
      expect(parser.getLastEventId()).toBe('123');
    });
  });

  describe('resetLastEventId', () => {
    it('should reset last event ID', () => {
      const parser = new MessageParser();
      parser.parse('id: 123\ndata: test\n\n', 'https://example.com');
      parser.resetLastEventId();
      expect(parser.getLastEventId()).toBe('');
    });
  });

  describe('isValidJSON', () => {
    it('should return true for valid JSON', () => {
      const parser = new MessageParser();
      expect(parser.isValidJSON('{"key":"value"}')).toBe(true);
      expect(parser.isValidJSON('[]')).toBe(true);
      expect(parser.isValidJSON('null')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      const parser = new MessageParser();
      expect(parser.isValidJSON('not json')).toBe(false);
      expect(parser.isValidJSON('')).toBe(false);
    });
  });

  describe('safeJSONParse', () => {
    it('should parse valid JSON', () => {
      const parser = new MessageParser();
      expect(parser.safeJSONParse('{"key":"value"}', {})).toEqual({ key: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const parser = new MessageParser();
      const fallback = { default: true };
      expect(parser.safeJSONParse('not json', fallback)).toBe(fallback);
    });
  });

  describe('buildEvent', () => {
    it('should build simple event', () => {
      const parser = new MessageParser();
      const event = parser.buildEvent('message', 'hello');
      expect(event).toContain('data:hello');
      expect(event).toContain('\n\n');
    });

    it('should build event with custom type', () => {
      const parser = new MessageParser();
      const event = parser.buildEvent('custom', 'hello');
      expect(event).toContain('event:custom');
      expect(event).toContain('data:hello');
    });

    it('should build event with ID', () => {
      const parser = new MessageParser();
      const event = parser.buildEvent('message', 'hello', '123');
      expect(event).toContain('id:123');
    });

    it('should build event with retry', () => {
      const parser = new MessageParser();
      const event = parser.buildEvent('message', 'hello', undefined, 5000);
      expect(event).toContain('retry:5000');
    });

    it('should handle multi-line data', () => {
      const parser = new MessageParser();
      const event = parser.buildEvent('message', 'line1\nline2');
      expect(event).toContain('data:line1');
      expect(event).toContain('data:line2');
    });
  });

  describe('formatData', () => {
    it('should format single line', () => {
      const parser = new MessageParser();
      const lines = parser.formatData('hello');
      expect(lines).toEqual(['data:hello']);
    });

    it('should format multi-line', () => {
      const parser = new MessageParser();
      const lines = parser.formatData('line1\nline2');
      expect(lines).toEqual(['data:line1', 'data:line2']);
    });
  });
});
