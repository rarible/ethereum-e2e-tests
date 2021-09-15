module.exports = {
	roots: ["<rootDir>/src"],
	setupFilesAfterEnv: [
		"./jest.setup.js",
	],
	transform: {
		"^.+\\.ts?$": "ts-jest",
	},
}
