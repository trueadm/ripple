const { createLanguageServicePlugin } = require('@volar/typescript/lib/quickstart/createLanguageServicePlugin.js')
const { getRippleLanguagePlugin } = require('./language.js')
const path = require('path');
const fs = require('fs');

module.exports = createLanguageServicePlugin((ts, info) => {
  const workspaceFolder = info.project.getCurrentDirectory();
  const ripple_path = getRipplePath(workspaceFolder);
  if (!ripple_path) {
    console.error("Ripple compiler not found in workspace:", workspaceFolder);
    return { languagePlugins: [getRippleLanguagePlugin()] };
  }

  // Validate the ripple path before importing for security
  const validatedPath = validateRipplePath(ripple_path);

  let ripple;

  console.log('Importing ripple compiler...');
  try {
    ripple = require(validatedPath);
    console.log('Ripple compiler imported successfully');

    // Test if the compiler has the expected methods
    if (!ripple || typeof ripple.compile_to_volar_mappings !== 'function') {
      throw new Error('Ripple compiler does not have expected compile_to_volar_mappings method');
    }
  } catch (importError) {
    console.error('Failed to import ripple compiler:', importError);
    throw new Error(`Failed to import ripple compiler: ${importError.message}`);
  }

  return {
    languagePlugins: [getRippleLanguagePlugin(ripple)],
    setup(language) {
      const languageService = info.languageService;
      info.languageService = new Proxy(languageService, {
        get(target, prop) {
          if (prop === 'getSyntacticDiagnostics') {
            return getSyntacticDiagnostics;
          }
          if (prop === 'getSemanticDiagnostics') {
            return getSemanticDiagnostics;
          }
          return target[prop];
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        }
      });

      function getSyntacticDiagnostics(fileName) {
        return isErrorMode(fileName)
          ? []
          : languageService.getSyntacticDiagnostics(fileName);
      }

      function getSemanticDiagnostics(fileName) {
        return isErrorMode(fileName)
          ? []
          : languageService.getSemanticDiagnostics(fileName);
      }

      function isErrorMode(fileName) {
        const sourceScript = language.scripts.get(fileName);
        return !!sourceScript.generated?.root?.isErrorMode;
      }
    },
  };
});


function validateRipplePath(ripple_path) {
  if (!ripple_path) {
    throw new Error('Ripple path is required');
  }

  // Ensure path exists
  if (!fs.existsSync(ripple_path)) {
    throw new Error(`Ripple compiler not found at path: ${ripple_path}`)
  }

  // Ensure path is absolute and points to expected ripple location
  const normalizedPath = path.resolve(ripple_path);

  // Must end with the expected ripple compiler path
  const isValidPath = normalizedPath.includes('ripple/src/compiler/index.js') ||
    normalizedPath.includes('ripple\\src\\compiler\\index.js');

  if (!isValidPath) {
    throw new Error('Invalid ripple compiler path: must point to ripple/src/compiler/index.js');
  }

  // Prevent directory traversal attacks
  if (normalizedPath.includes('..')) {
    throw new Error('Path traversal not allowed in ripple path');
  }

  // Additional security: ensure the path doesn't contain suspicious patterns
  const suspiciousPatterns = ['/etc/', '/bin/', '/usr/bin/', 'C:\\Windows\\', 'C:\\System32\\'];
  for (const pattern of suspiciousPatterns) {
    if (normalizedPath.includes(pattern)) {
      throw new Error('Suspicious path detected in ripple path');
    }
  }

  console.log('Validated ripple path:', normalizedPath);
  return normalizedPath;
}

function getRipplePath(folder) {
  // Try to find ripple compiler in workspace
  const workspaceRipplePath = path.join(
    folder,
    'node_modules',
    'ripple',
    'src',
    'compiler',
    'index.js',
  );
  console.log("Checking ripple path:", workspaceRipplePath)

  if (fs.existsSync(workspaceRipplePath)) {
    console.log("Found ripple compiler at: ", workspaceRipplePath)
    return workspaceRipplePath;
  }

  // Also try packages/ripple for monorepo structure
  const monorepoRipplePath = path.join(
    folder,
    'packages',
    'ripple',
    'src',
    'compiler',
    'index.js',
  );
  console.log("Checking monorepo ripple path:", monorepoRipplePath)

  if (fs.existsSync(monorepoRipplePath)) {
    console.log("Found ripple compiler at:", monorepoRipplePath)
    return monorepoRipplePath;
  }
}
