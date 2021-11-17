export function expectEqual(actual: any, expected: any, msg: String) {
	try {
		expect(actual).toBe(expected)
	} catch (e) {
		throw new Error(`${msg} incorrect ${e}`)
	}
}