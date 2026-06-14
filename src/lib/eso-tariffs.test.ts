import { describe, expect, it } from "vitest";
import { parseEsoTariffs } from "./eso-tariffs";

// Mirrors the real ESO 2026 table layout: low-voltage value precedes the
// medium-voltage value within each row, decimals use Lithuanian commas.
const SAMPLE_HTML = `
<table>
	<tr><td>Atsiskaitymas už atgautą energijos kiekį</td><td>0,0726</td><td>0,02904</td><td>Eur/kWh</td></tr>
	<tr><td>Atsiskaitymas už leistiną generuoti elektrinės galią</td><td>5,0336</td><td>2,0207</td><td>Eur/kW/mėn.</td></tr>
	<tr><td>Atsiskaitymas kilovatvalandėmis kiekiu pagal procentus</td><td>37% (gaminančiam vartotojui lieka 63%)</td><td>21% (gaminančiam vartotojui lieka 79%)</td><td></td></tr>
</table>
`;

describe("parseEsoTariffs", () => {
	it("extracts the low-voltage reclaim fee, capacity fee, and user energy share", () => {
		const tariffs = parseEsoTariffs(SAMPLE_HTML);

		expect(tariffs).not.toBeNull();
		expect(tariffs?.reclaimFeePerKWh).toBeCloseTo(0.0726, 4);
		expect(tariffs?.capacityFeePerKW).toBeCloseTo(5.0336, 4);
		// Grid keeps 37%, so 63% remains for the prosumer.
		expect(tariffs?.energyShare).toBeCloseTo(0.63, 4);
	});

	it("returns null when the page does not contain the expected labels", () => {
		expect(parseEsoTariffs("<p>Page moved.</p>")).toBeNull();
	});

	it("returns null when a parsed value is out of a sane range", () => {
		const bogus = SAMPLE_HTML.replace("0,0726", "999,0");
		expect(parseEsoTariffs(bogus)).toBeNull();
	});
});
