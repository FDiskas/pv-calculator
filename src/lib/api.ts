import { createServerFn } from "@tanstack/react-start";

interface EleringPricePoint {
	timestamp: number; // Unix seconds
	price: number; // €/MWh
}

/** Elering NordPool price response, keyed by country code (ee, lt, lv, fi). */
export interface EleringPriceResponse {
	success: boolean;
	data: Record<string, EleringPricePoint[]>;
}

export const fetchNordPoolPrices = createServerFn({ method: "GET" })
	.inputValidator((data: { year: string }) => data)
	.handler(async ({ data }): Promise<EleringPriceResponse> => {
		const { year } = data;
		const start = `${year}-04-01T00:00:00Z`;
		const end = `${Number.parseInt(year, 10) + 1}-03-31T23:59:59Z`;

		const res = await fetch(
			`https://dashboard.elering.ee/api/nps/price?start=${start}&end=${end}`,
		);
		if (!res.ok) {
			throw new Error(`Failed to fetch from Elering: ${res.statusText}`);
		}

		return res.json();
	});
