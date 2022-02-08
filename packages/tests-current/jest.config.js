module.exports = {
	roots: ["<rootDir>/src"],
	setupFilesAfterEnv: [
		"./jest.setup.js",
	],
	transform: {
		"^.+\\.ts?$": "ts-jest",
	},
	reporters: [
		"default",
		["<rootDir>/../../node_modules/jest-html-reporters", {}],
	],
}
