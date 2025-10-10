UI Components (User Controls) go in here. 
They consist of a css and a js file.
The naming scheme is "<component-name>.js" (the code-behind), "<component-name>.css" (the styles), "<component-name>-*.js" (any additional scripts, like models, viewmodels, etc.)

### 🔧 Technical Standards

- **Naming Conventions**:
  - `camelCase` for fields and parameters
  - `PascalCase` for methods and classes
  - `_underscore` prefix for private members
  - `UPPER_SNAKE_CASE` for constants

- **Documentation**: JSDoc for all public APIs
- **Error Handling**: Always return structured results, never throw in public APIs
- **Browser Compatibility**: Works in modern browsers and Node.js
- **Memory Management**: Efficient processing with cleanup
