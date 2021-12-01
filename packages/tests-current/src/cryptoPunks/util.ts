export const RETRY_ATTEMPTS = 8

export function printLog(message?: any, ...optionalParams: any[]) {
	let testName = expect.getState().currentTestName
	console.log(`--- ${testName} ---\n${message}`, optionalParams)
}

export async function runLogging<T extends any>(
	computationName: string,
	computation: Promise<T>
): Promise<T> {
	try {
		printLog(`started '${computationName}'`)
		let result = await computation
		printLog(`finished '${computationName}'`)
		return result
	} catch (e) {
		printLog(`failed '${computationName}'`, e)
		throw e
	}
}
