export function getOwnershipId(contract: String, tokenId: Number, owner: String): string {
	return `${contract}:${tokenId}:${owner}`
}
