import {EthAssetType} from "@rarible/ethereum-api-client"
import {CryptoPunksAssetType} from "@rarible/ethereum-api-client/build/models"
import {toAddress} from "@rarible/types"
import {cryptoPunksAddress} from "../contracts/crypto-punks"

export const punkIndex = 9
export const ORDER_TYPE_CRYPTO_PUNK = "CRYPTO_PUNK"
export const ORDER_TYPE_RARIBLE_V2 = "RARIBLE_V2"
export const ASSET_TYPE_ETH: EthAssetType = {
	"assetClass": "ETH",
}
export const ASSET_TYPE_CRYPTO_PUNK: CryptoPunksAssetType = {
	assetClass: "CRYPTO_PUNKS",
	contract: toAddress(cryptoPunksAddress),
	tokenId: punkIndex,
}
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
