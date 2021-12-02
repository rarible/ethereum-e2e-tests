export const RETRY_ATTEMPTS = 8
export const TEST_TIMEOUT = 30000

function getMessage(message: any): string {
	let testName = expect.getState().currentTestName
	return `--- ${testName} ---\n${message}`
}

export function printLog(message: any, ...optionalParams: any[]) {
	let fullMessage = getMessage(message)
	console.log(fullMessage, optionalParams)
}

export function printError(message: any, ...optionalParams: any[]) {
	let fullMessage = getMessage(message)
	console.error(fullMessage, optionalParams)
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
		printError(`failed '${computationName}'`, e)
		throw e
	}
}
