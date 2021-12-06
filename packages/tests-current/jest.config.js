module.exports = {
	roots: ["<rootDir>/src"],
	setupFilesAfterEnv: [
		"./jest.setup.js",
	],
	transform: {
		"^.+\\.ts?$": "ts-jest",
	},
	moduleNameMapper: {
		"source-map-support/register": "identity-obj-proxy",
	},
}
