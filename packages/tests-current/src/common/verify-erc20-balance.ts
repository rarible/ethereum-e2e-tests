import { Contract } from "web3-eth-contract"
import { toBn } from "./to-bn"
import { expectEqual } from "./expect-equal"

export async function verifyErc20Balance(c: Contract, owner: string, value: number | string) {
	expectEqual(toBn(await c.methods.balanceOf(owner).call()).toString(), `${value}`, "erc20 balance")
}
