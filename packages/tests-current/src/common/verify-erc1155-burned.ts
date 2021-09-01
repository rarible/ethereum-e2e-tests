import { EthereumContract } from "@rarible/ethereum-provider"
import { Address } from "@rarible/protocol-api-client"

export async function verifyErc1155Burned(c: EthereumContract, owner: Address, tokenId: string, value: number | string) {
	expect(await c.functionCall("balanceOf", owner, tokenId).call()).toBe(`${value}`)
}
