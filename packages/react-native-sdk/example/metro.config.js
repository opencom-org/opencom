const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages - order matters!
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Packages that must resolve from example app's node_modules to prevent duplicates
const singletonPackages = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react/jsx-runtime": path.resolve(projectRoot, "node_modules/react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(projectRoot, "node_modules/react/jsx-dev-runtime"),
};
const trustedSingletonRoots = new Set(["react", "react-native"]);
const trustedSpecifierPattern = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

function isTraversalLikeSpecifier(moduleName) {
  return (
    moduleName
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..") ||
    moduleName.includes("\\") ||
    moduleName.includes("\0")
  );
}

function isTrustedSingletonSpecifier(moduleName) {
  if (Object.prototype.hasOwnProperty.call(singletonPackages, moduleName)) {
    return true;
  }

  const [root] = moduleName.split("/");
  if (!trustedSingletonRoots.has(root)) {
    return false;
  }

  if (isTraversalLikeSpecifier(moduleName)) {
    return false;
  }

  return trustedSpecifierPattern.test(moduleName);
}

// Resolve workspace packages
config.resolver.extraNodeModules = {
  "@opencom/sdk-core": path.resolve(monorepoRoot, "packages/sdk-core"),
  "@opencom/react-native-sdk": path.resolve(monorepoRoot, "packages/react-native-sdk"),
  "@opencom/convex": path.resolve(monorepoRoot, "packages/convex"),
  ...singletonPackages,
};

// Custom resolver to force singleton packages to always resolve from example app
const { resolve: defaultResolve } = config.resolver;
const fallbackResolve = (context, moduleName, platform) => {
  if (typeof defaultResolve === "function") {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isTrustedSingletonSpecifier(moduleName)) {
    try {
      const resolvedPath = require.resolve(moduleName, { paths: [projectRoot] });
      return {
        filePath: resolvedPath,
        type: "sourceFile",
      };
    } catch {
      return fallbackResolve(context, moduleName, platform);
    }
  }

  // Use default resolution for everything else
  return fallbackResolve(context, moduleName, platform);
};

// Ensure TypeScript files in workspace packages are transpiled
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];

module.exports = config;
