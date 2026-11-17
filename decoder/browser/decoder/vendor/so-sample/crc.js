// From danilnagy/so_sample @ eb5e2617eae746d4fd9bd4f60aaf86e3ae65bc0e (MIT).
// Only relative import extensions changed. See LICENSE and PROVENANCE.md.
/** CRC-16/CCITT (polynomial 0x1021, no reflection), as Python's binascii.crc_hqx. */
export const CRC_INITIAL_STATE = 0x1d0f;
export function crcUpdate(state, byte) {
    let crc = (state ^ (byte << 8)) & 0xffff;
    for (let i = 0; i < 8; i++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
}
