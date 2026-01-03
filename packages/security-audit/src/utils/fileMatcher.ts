/**
 * File matching utilities for security scanning
 */

import { glob } from "glob";
import { minimatch } from "minimatch";

/**
 * Check if file matches include patterns
 */
export function fileMatchesPatterns(
  filePath: string,
  include: string[],
  exclude: string[]
): boolean {
  // Normalize path
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Check exclude patterns first
  for (const pattern of exclude) {
    if (minimatch(normalizedPath, pattern)) {
      return false;
    }
  }

  // Check include patterns
  for (const pattern of include) {
    if (minimatch(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Get files matching glob patterns
 */
export async function getMatchingFiles(
  directories: string[],
  include: string[],
  exclude: string[]
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const dir of directories) {
    const patterns = include.map((p) => `${dir}/${p}`);
    const files = await glob(patterns, {
      absolute: true,
      ignore: exclude.map((p) => `${dir}/${p}`),
      nodir: true,
    });

    allFiles.push(...files);
  }

  // Deduplicate
  return Array.from(new Set(allFiles));
}

/**
 * Check if file is binary
 */
export function isBinaryFile(filePath: string, content: Buffer): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();

  // Known binary extensions
  const binaryExtensions = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "ico",
    "pdf",
    "zip",
    "tar",
    "gz",
    "exe",
    "dll",
    "so",
    "dylib",
    "woff",
    "woff2",
    "ttf",
    "eot",
  ]);

  if (ext && binaryExtensions.has(ext)) {
    return true;
  }

  // Check for null bytes (common in binary files)
  if (content.includes(0)) {
    return true;
  }

  return false;
}

/**
 * Get file language from extension
 */
export function getFileLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    h: "c",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
  };

  return ext ? languageMap[ext] || "unknown" : "unknown";
}
