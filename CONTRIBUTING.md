# Contributing to ScreenPrompt

Thank you for your interest in contributing to ScreenPrompt! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to see if the bug has already been reported
2. If not, [open a new issue](../../issues/new?template=bug_report.md) with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Windows version and Python version
   - Screenshots if applicable

### Requesting Features

1. **Check existing issues** for similar requests
2. [Open a feature request](../../issues/new?template=feature_request.md) with:
   - Clear description of the feature
   - Use case / why it would be useful
   - Any implementation ideas (optional)

### Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** (see below)
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/screenprompt.git
   cd screenprompt
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the application:
   ```bash
   python src/main.py
   ```

## Code Style Guidelines

### General

- **Language**: All code, comments, and documentation must be in English
- **Python version**: 3.10+ (use modern type hints)
- **Line length**: 100 characters max
- **Imports**: Standard library first, then third-party, then local

### File Headers

Every `.py` file must include the MIT license header:

```python
# MIT License
#
# Copyright (c) 2026 ScreenPrompt Contributors
#
# [Full license text...]
```

### Naming Conventions

- **Variables/functions**: `snake_case`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private methods**: `_leading_underscore`

### Documentation

- Add docstrings to all public functions and classes
- Keep comments concise and meaningful
- Update README.md for user-facing changes
- Update CLAUDE.md for implementation patterns

## Testing

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Application starts without errors
- [ ] Window appears and is draggable
- [ ] Settings panel opens and closes correctly
- [ ] Changes in settings apply in real-time
- [ ] Settings are saved and persist after restart
- [ ] Capture exclusion works in OBS/Zoom
- [ ] Keyboard shortcuts function correctly
- [ ] Click-through mode works and can be unlocked
- [ ] No errors in console output

### Test with Screen Capture

Test capture exclusion with:
- OBS Studio
- Zoom screen share
- Windows Snipping Tool
- Microsoft Teams (desktop app)

## Architecture

```
screenprompt/
├── src/
│   ├── main.py           # Main application window
│   ├── settings_ui.py    # Settings panel UI
│   └── config_manager.py # Configuration handling
├── tests/                # Test files
├── requirements.txt      # Dependencies
├── README.md            # User documentation
├── CONTRIBUTING.md      # This file
├── LICENSE              # MIT License
└── CLAUDE.md            # Development rules & patterns
```

## Questions?

If you have questions, feel free to open an issue with the "question" label.

Thank you for contributing!
