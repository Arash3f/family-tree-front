/**
 * Teaches `node --test` the `@/*` path alias from tsconfig.json, and lets
 * extensionless TypeScript imports resolve the way a bundler would.
 *
 * Usage: node --import ./scripts/test-alias-hook.mjs --test "src/**\/*.test.mts"
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const EXTENSIONS = [".ts", ".mts", ".tsx", ".js", ".mjs"];

/** Append the extension the bundler would have inferred. */
function withExtension(absolutePath) {
  if (existsSync(absolutePath) && path.extname(absolutePath)) return absolutePath;
  for (const extension of EXTENSIONS) {
    const candidate = `${absolutePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of EXTENSIONS) {
    const candidate = path.join(absolutePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return absolutePath;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = withExtension(path.join(sourceRoot, specifier.slice(2)));
      return nextResolve(pathToFileURL(target).href, context);
    }
    // Relative imports inside aliased files may also omit their extension.
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolved = path.resolve(parentDir, specifier);
      if (!path.extname(resolved) || !existsSync(resolved)) {
        const target = withExtension(resolved);
        if (existsSync(target)) {
          return nextResolve(pathToFileURL(target).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
