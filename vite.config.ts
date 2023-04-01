import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		lib: {
			entry: ['src/degreeworks/degreeworks.ts', "src/drexelone/drexelone.ts"],
			name: 'better-drexel-web',
			fileName: (_format, entryName) => `${entryName}.js`,
			formats: ["es"]
		},
		rollupOptions: {
			external: ['chrome'],
			output: {
				format: "es"
			}
		},
		emptyOutDir: true,
		outDir: "dist",
		minify: true
	},
	assetsInclude: ['**/*.css', "**/*.png"],
});
