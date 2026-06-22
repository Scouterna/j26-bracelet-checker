import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const BASE = "/_services/bracelet-checker";

export default defineConfig({
	base: BASE,
	plugins: [
		devtools(),
		nitro({ baseURL: BASE }),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart({ router: { basepath: BASE } }),
		tailwindcss(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
	server: {
		allowedHosts: ["local.j26.se"],
	},
});
