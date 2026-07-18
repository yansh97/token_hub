import { describe, expect, it } from "vitest";

import {
  toPricingRows,
  toPricingSettingsInput,
  type ModelPricingFormRow,
} from "@/features/pricing/form";
import type { ModelPricingSettings } from "@/features/pricing/types";

const settings: ModelPricingSettings = {
  version: "catalog.test",
  source: null,
  models: [
    {
      modelId: "gpt-5.6-sol",
      aliases: ["openai/gpt-5.6-sol"],
      priceMultiplierScaled: 1_250_000_000_000,
      standard: {
        inputNanoUsdPerToken: 5_000,
        outputNanoUsdPerToken: 30_000,
        cacheReadNanoUsdPerToken: 500,
        cacheWriteNanoUsdPerToken: 6_250,
        cacheWrite5mNanoUsdPerToken: 6_250,
        cacheWrite1hNanoUsdPerToken: null,
        imageInputNanoUsdPerToken: null,
        imageOutputNanoUsdPerToken: 30_000,
      },
      serviceTierProfiles: {
        priority: {
          inputNanoUsdPerToken: 10_000,
          outputNanoUsdPerToken: 60_000,
          cacheReadNanoUsdPerToken: 1_000,
          cacheWriteNanoUsdPerToken: 12_500,
          cacheWrite5mNanoUsdPerToken: null,
          cacheWrite1hNanoUsdPerToken: null,
          imageInputNanoUsdPerToken: null,
          imageOutputNanoUsdPerToken: null,
        },
      },
      longContext: {
        threshold: 272_000,
        inputMultiplierScaled: 2_000_000_000_000,
        outputMultiplierScaled: 1_500_000_000_000,
      },
    },
  ],
};

describe("pricing/form", () => {
  it("maps standard and advanced profiles into editable strings", () => {
    const row = toPricingRows(settings)[0];

    expect(row).toMatchObject({
      modelId: "gpt-5.6-sol",
      priceMultiplier: "1.25",
      standard: {
        input: "5.000",
        cacheRead: "0.500",
        cacheWrite: "6.250",
        cacheWrite5m: "6.250",
        cacheWrite1h: "",
        imageOutput: "30.000",
      },
      longContext: {
        enabled: true,
        threshold: "272000",
        inputMultiplier: "2",
        outputMultiplier: "1.5",
      },
    });
    expect(row.serviceTierProfiles.priority.input).toBe("10.000");
  });

  it("round trips profiles without collapsing missing and explicit zero", () => {
    const rows = toPricingRows(settings);
    rows[0].standard.imageInput = "0";
    const result = toPricingSettingsInput(rows);

    expect(result).toEqual({
      ok: true,
      input: {
        models: [
          expect.objectContaining({
            modelId: "gpt-5.6-sol",
            standard: expect.objectContaining({
              imageInputNanoUsdPerToken: 0,
              cacheWrite1hNanoUsdPerToken: null,
            }),
            serviceTierProfiles: expect.objectContaining({
              priority: expect.objectContaining({
                inputNanoUsdPerToken: 10_000,
              }),
            }),
            longContext: {
              threshold: 272_000,
              inputMultiplierScaled: 2_000_000_000_000,
              outputMultiplierScaled: 1_500_000_000_000,
            },
          }),
        ],
      },
    });
  });

  it("rejects duplicate providerless aliases", () => {
    const row = toPricingRows(settings)[0];
    const duplicate: ModelPricingFormRow = {
      ...row,
      id: "second",
      modelId: "openai/gpt-5.6-sol",
      aliasesText: "",
    };

    expect(toPricingSettingsInput([row, duplicate]).ok).toBe(false);
  });

  it("parses decimal prices and fixed point multipliers precisely", () => {
    const row = toPricingRows(settings)[0];
    row.modelId = "kimi-k2.6";
    row.aliasesText = "moonshotai/kimi-k2.6";
    row.priceMultiplier = "0.2166535361";
    row.standard.input = "0.750";
    row.longContext.enabled = false;
    const result = toPricingSettingsInput([row]);

    expect(result).toEqual({
      ok: true,
      input: {
        models: [
          expect.objectContaining({
            modelId: "kimi-k2.6",
            priceMultiplierScaled: 216_653_536_100,
            standard: expect.objectContaining({ inputNanoUsdPerToken: 750 }),
            longContext: null,
          }),
        ],
      },
    });
  });

  it("rejects invalid prices, multipliers, and service tier names", () => {
    const row = toPricingRows(settings)[0];
    expect(toPricingSettingsInput([{ ...row, priceMultiplier: "0" }]).ok).toBe(
      false,
    );
    expect(
      toPricingSettingsInput([
        { ...row, standard: { ...row.standard, cacheWrite: "-1" } },
      ]).ok,
    ).toBe(false);
    expect(
      toPricingSettingsInput([
        {
          ...row,
          serviceTierProfiles: { "": row.serviceTierProfiles.priority },
        },
      ]).ok,
    ).toBe(false);
  });
});
