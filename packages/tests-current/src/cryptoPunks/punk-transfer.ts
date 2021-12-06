import {Contract} from "web3-eth-contract"
import {toAddress} from "@rarible/types"
import {verifyCryptoPunkOwner} from "../common/verify-crypto-punk-owner"
import {awaitOwnershipValueToBe} from "../common/await-ownership-value-to-be"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {awaitNoOwnership} from "../common/await-no-ownership"
import {printLog} from "./util"
import {punkIndex} from "./crypto-punks"

/**
 * Returns punk to {@param targetOwner} from {@param possibleOwner} if necessary (using {@param possibleContract}).
 * If the punk already belongs to the {@param targetOwner}, the function does nothing.
 * If the punk belongs to neither of {@param targetOwner} nor {@param possibleOwner}, it throws an exception.
 */
export async function transferPunkTo(
	targetOwner: string,
	possibleOwner: string,
	possibleContract: Contract
) {
	const realOwner = await possibleContract.methods.punkIndexToAddress(punkIndex).call()
	if (realOwner.toLowerCase() === targetOwner) {
		printLog(`no need to transfer back, the punk already belongs to ${targetOwner}`)
		return
	}
	if (realOwner.toLowerCase() !== possibleOwner) {
		throw Error(`Punk with id ${punkIndex} is owned by the third side user: ${realOwner}`)
	}
	printLog(`transferring back from ${possibleOwner} to ${targetOwner}`)
	await verifyCryptoPunkOwner(possibleContract, punkIndex, possibleOwner)
	await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, possibleOwner, 1)

	await possibleContract.methods.transferPunk(toAddress(targetOwner), punkIndex).send({from: possibleOwner})
	await verifyCryptoPunkOwner(possibleContract, punkIndex, targetOwner)
	await awaitNoOwnership(cryptoPunksAddress, punkIndex, possibleOwner)
	await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, targetOwner, 1)
	printLog(`punk transferred back from ${possibleOwner} to ${targetOwner}`)
}
