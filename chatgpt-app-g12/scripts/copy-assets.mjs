import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

mkdirSync(join(root, "dist"), { recursive: true });
copyFileSync(join(root, "src", "widget.html"), join(root, "dist", "widget.html"));
