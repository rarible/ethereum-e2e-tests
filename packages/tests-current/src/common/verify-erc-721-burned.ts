import { EthereumContract } from "@rarible/ethereum-provider"
import { Address } from "@rarible/ethereum-api-client"

export async function verifyErc721Burned(c: EthereumContract, owner: Address) {
	expect(await c.functionCall("balanceOf", owner).call()).toBe("0")
}
