interface AuctionFactory {
	start(): void;
	buyOut(): void;
	putBid(): void;
	finish(): void;
	cancel(): void;
}
