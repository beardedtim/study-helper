import * as crypto from "node:crypto";

export const genGoodEnoughID = ({
  prefix = "",
  length = 15,
}: {
  prefix?: string;
  length?: number;
} = {}) =>
  `${prefix}${crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)}`;
