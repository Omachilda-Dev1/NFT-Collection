# 🔧 Fix PowerShell Script Execution

## The Problem

You're seeing this error:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because 
running scripts is disabled on this system.
```

## Quick Solutions

### Solution 1: Use Batch Files (Easiest)

We've created batch files that work without PowerShell:

```bash
# Install dependencies
setup.bat

# Run tests
run-tests.bat
```

Just double-click these files or run them from CMD!

### Solution 2: Use CMD Instead of PowerShell

1. Open **Command Prompt** (not PowerShell)
2. Navigate to your project:
   ```cmd
   cd "C:\Users\HP\Desktop\omachilda.dev\Smart Contracts\NFT-Collection"
   ```
3. Run commands:
   ```cmd
   npm test
   npm run compile
   npm run deploy:local
   ```

### Solution 3: Fix PowerShell Policy (Permanent)

**Option A: Current User Only (Recommended)**

1. Open PowerShell as **Administrator**
2. Run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Type `Y` and press Enter
4. Close and reopen PowerShell
5. Now you can run `npm test`

**Option B: For This Process Only (Temporary)**

In your current PowerShell window:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Then run:
```powershell
npm test
```

### Solution 4: Use Git Bash

If you have Git installed:

1. Open **Git Bash**
2. Navigate to project:
   ```bash
   cd ~/Desktop/omachilda.dev/Smart\ Contracts/NFT-Collection
   ```
3. Run commands:
   ```bash
   npm test
   npm run compile
   ```

## Verification

After applying any solution, test it:

```bash
npm test
```

You should see:
```
37 passing (7s)
```

## Understanding Execution Policies

PowerShell has security policies that prevent scripts from running:

- **Restricted** (default): No scripts allowed
- **RemoteSigned**: Local scripts OK, downloaded scripts need signature
- **Bypass**: All scripts allowed (use carefully)

## Recommended Approach

For this project, use **batch files**:
- ✅ No policy changes needed
- ✅ Works immediately
- ✅ Simple to use
- ✅ Safe

## All Available Batch Files

```bash
setup.bat          # Install dependencies
run-tests.bat      # Run all tests
```

## If Nothing Works

Use Node.js directly:

```bash
# Instead of: npm test
node node_modules/hardhat/internal/cli/cli.js test

# Instead of: npm run compile
node node_modules/hardhat/internal/cli/cli.js compile
```

## Common Issues

### "npm not found"
- Ensure Node.js is installed
- Restart terminal after installation
- Check PATH environment variable

### "Cannot find module"
- Run `setup.bat` first
- Or manually: `npm install`

### "Permission denied"
- Run as Administrator
- Check file permissions
- Use batch files instead

## Testing Your Fix

Run this command to verify everything works:

```bash
# Using batch file
run-tests.bat

# Or using CMD
npm test

# Or using PowerShell (after fix)
npm test
```

Expected output:
```
✔ Should set the correct name and symbol
✔ Should set the correct owner
...
37 passing (7s)
```

## Need More Help?

1. Check which terminal you're using:
   - PowerShell → Use batch files or fix policy
   - CMD → Should work directly
   - Git Bash → Should work directly

2. Verify Node.js installation:
   ```bash
   node --version
   npm --version
   ```

3. Try the simplest solution first (batch files)

## Summary

**Easiest Solution**: Use `run-tests.bat`

**Best Solution**: Fix PowerShell policy once

**Alternative**: Use CMD or Git Bash

All solutions work - choose what's most comfortable for you!

---

**Quick Start**: Just run `run-tests.bat` and you're done! ✅
