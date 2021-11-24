export function expectEqual(actual: any, expected: any, msg: string) {
	try {
		expect(actual).toBe(expected)
	} catch (e) {
		throw new Error(`${msg} incorrect ${e}`)
	}
}
