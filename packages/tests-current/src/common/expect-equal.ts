export function expectEqual(actual: any, expected: any, msg: string) {
	try {
		expect(actual).toBe(expected)
	} catch (e) {
		throw new Error(`${msg} incorrect ${e}`)
	}
}

export function expectLength(actual: any, expectedLength: any, msg: string) {
	try {
		expect(actual).toHaveLength(expectedLength)
	} catch (e) {
		throw new Error(`${msg} incorrect size ${e}`)
	}
}
