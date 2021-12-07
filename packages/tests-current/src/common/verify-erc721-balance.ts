import {Contract} from "web3-eth-contract"
import {retry} from "./retry"
import {toBn} from "./to-bn"

export async function verifyErc721Balance(c: Contract, owner: string, value: number | string) {
	await retry(10, async () => {
		const actualBalance = toBn(await c.methods.balanceOf(owner).call()).toString()
		expect(actualBalance).toBe(`${value}`)
	})
}
