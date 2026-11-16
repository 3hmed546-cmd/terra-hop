/**
 * Pure TypeScript Code128 SVG Barcode Generator.
 * Generates razor-sharp, zero-dependency vector barcodes optimized for
 * thermal label printers (300+ DPI, Xprinter/Zebra) and standard A4/A6 paper.
 */

const PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_B = 104;
const STOP = 106;

export function generateCode128Svg(text: string, height = 45, barWidth = 2): string {
  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP);

  let x = 6;
  let rects = "";

  for (const c of codes) {
    const pattern = PATTERNS[c];
    if (!pattern) continue;
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const w = parseInt(pattern[j], 10) * barWidth;
      if (isBar) {
        rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000" />`;
      }
      x += w;
      isBar = !isBar;
    }
  }

  const totalWidth = x + 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 16}" width="${totalWidth}" height="${height + 16}" style="display:block;margin:0 auto;max-width:100%;">
    ${rects}
    <text x="${totalWidth / 2}" y="${height + 13}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="700" text-anchor="middle" fill="#000000" letter-spacing="2">${text}</text>
  </svg>`;
}
