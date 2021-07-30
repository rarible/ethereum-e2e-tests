import { Action } from "@rarible/action"

declare type Arr = readonly unknown[];

export async function runAction<T extends Arr>(action: OrPromise<Action<any, T>>) {
	const a = await action
	for(let i = 0; i < a.ids.length; i ++) {
		await a.run(i)
	}
	return await a.result
}
