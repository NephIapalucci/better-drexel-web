import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		lib: {
			entry: 'src/degreeworks/degreeworks.ts',
			name: 'better-drexel-web',
			fileName: 'degreeworks'
		},
		rollupOptions: {
			external: ['chrome']
		},
		emptyOutDir: true,
		outDir: "dist/degreeworks"
	},
	assetsInclude: ['**/*.css']
});
