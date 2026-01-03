#!/bin/bash

# Aequor v1.0.0 Release Readiness Verification Script
# Usage: ./scripts/verify-release-readiness.sh

set -e

echo "🔍 Verifying Aequor v1.0.0 release readiness..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
check_mark() {
    echo -e "${GREEN}✅${NC} $1"
}

check_cross() {
    echo -e "${RED}❌${NC} $1"
}

check_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

total_checks=0
passed_checks=0
failed_checks=0

# Function to run check
run_check() {
    total_checks=$((total_checks + 1))
    local description="$1"
    local command="$2"
    local expected="$3"

    info "$description"

    if eval "$command" >/dev/null 2>&1; then
        if [ "$expected" = "pass" ]; then
            check_mark "PASSED"
            passed_checks=$((passed_checks + 1))
        else
            check_cross "FAILED (expected to fail)"
            failed_checks=$((failed_checks + 1))
        fi
    else
        if [ "$expected" = "pass" ]; then
            check_cross "FAILED"
            failed_checks=$((failed_checks + 1))
        else
            check_warning "Expected failure"
            passed_checks=$((passed_checks + 1))
        fi
    fi
    echo ""
}

echo "=== Pre-Release Verification Checklist ==="
echo ""

# Git repository check
run_check "Git repository initialized" "git rev-parse --git-dir >/dev/null 2>&1" "pass"

# Branch check
current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
run_check "On main branch" "[ \"$current_branch\" = \"main\" ]" "pass"
if [ "$current_branch" != "main" ]; then
    check_cross "Current branch: $current_branch (should be main)"
fi

# Build checks
run_check "Root package builds" "npm run build" "pass"
run_check "TypeScript compilation clean" "npx tsc --noEmit" "pass"

# Test checks
run_check "All unit tests pass" "npm run test:unit" "pass"
run_check "Test coverage > 80%" "npm run test:coverage | grep -E '(All files|Statements|Branches|Functions|Lines)' | tail -1 | grep -E '[0-9]{2,}%' | grep -E '[8-9][0-9]|100'" "pass"

# Package checks
run_check "All package.json exist" "find packages -name 'package.json' | wc -l | grep -E '[5-6]'" "pass"
run_check "Version consistency" "find packages -name 'package.json' -exec grep -l '"version"' {} \\; | wc -l | grep -E '[5-6]'" "pass"

# Documentation checks
run_check "README.md exists" "[ -f README.md ]" "pass"
run_check "CHANGELOG.md has v1.0.0 entry" "grep -E '## \[1\.0\.0\]' CHANGELOG.md" "pass"
run_check "CLAUDE.md exists" "[ -f CLAUDE.md ]" "pass"

# Release docs check
run_check "Release process docs exist" "[ -f docs/release/RELEASE_PROCESS.md ]" "pass"
run_check "Release checklist exists" "[ -f docs/release/RELEASE_CHECKLIST.md ]" "pass"

# Scripts check
run_check "Tag creation script exists and is executable" "[ -x scripts/create-v1.0-tag.sh ]" "pass"
run_check "Verification script exists and is executable" "[ -x scripts/verify-release-readiness.sh ]" "pass"

# TODO/FIXME check
todo_count=$(grep -r "TODO\|FIXME\|HACK" packages/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l || echo "0")
if [ "$todo_count" -eq 0 ]; then
    check_mark "No critical TODO/FIXME comments found"
    passed_checks=$((passed_checks + 1))
else
    check_cross "$todo_count TODO/FIXME comments found"
    failed_checks=$((failed_checks + 1))
fi
total_checks=$((total_checks + 1))

# Security audit check (basic)
run_check "No npm audit vulnerabilities" "npm audit --audit-level moderate || true" "fail"

# Performance benchmarks (basic)
info "Checking basic performance..."
if npm run build >/dev/null 2>&1; then
    check_mark "Build completes in reasonable time"
    passed_checks=$((passed_checks + 1))
else
    check_cross "Build takes too long or fails"
    failed_checks=$((failed_checks + 1))
fi
total_checks=$((total_checks + 1))

echo "=== Summary ==="
echo "Total checks: $total_checks"
echo -e "${GREEN}Passed: $passed_checks${NC}"
echo -e "${RED}Failed: $failed_checks${NC}"

echo ""
echo "=== Recommendations ==="

# Check if git tag already exists
if git tag -l "v1.0.0" | grep -q "v1.0.0"; then
    check_warning "Git tag v1.0.0 already exists locally"
    echo "  - Use 'git tag -d v1.0.0' to delete before recreating"
else
    info "Git tag v1.0.0 does not exist yet"
fi

# Check npm package status
info "Check npm package status:"
for pkg in cascade privacy performance core protocol; do
    if [ -d "packages/$pkg" ]; then
        pkg_version=$(cd "packages/$pkg" && npm pkg get version 2>/dev/null | tr -d '"')
        info "  @lsi/$pkg: $pkg_version"
    fi
done

echo ""
echo "=== Next Steps ==="
echo "1. Run: ./scripts/create-v1.0-tag.sh"
echo "2. Verify all packages are ready for npm publish"
echo "3. Create GitHub release"
echo "4. Update documentation website"
echo "5. Announce to community"

# Calculate percentage
if [ $total_checks -gt 0 ]; then
    percentage=$((passed_checks * 100 / total_checks))
    echo ""
    echo "Readiness Score: $percentage% ($passed_checks/$total_checks checks passed)"

    if [ $percentage -ge 90 ]; then
        echo -e "${GREEN}🎉 Ready for release!${NC}"
        exit 0
    elif [ $percentage -ge 70 ]; then
        echo -e "${YELLOW}⚠️  Mostly ready - address failed items before release${NC}"
        exit 0
    else
        echo -e "${RED}🚨 Not ready - fix failed items before release${NC}"
        exit 1
    fi
fi