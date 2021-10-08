import { EthereumContract } from "@rarible/ethereum-provider"
import { Address } from "@rarible/protocol-api-client"

export function transferErc20(c: EthereumContract, to: Address, amount: number) {
	return c.functionCall("transfer", to, amount).send()
}