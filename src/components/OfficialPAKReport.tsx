import React, { useMemo, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { TeacherProfile, SKPEvaluation, KopSettings } from '../types';
import { SpecimenSVG } from './SpecimenSVG';
import { GOLONGAN_LIST, getTeacherLevel, GOLONGAN_BASE_VALS, getMinimalPangkat, getMinimalJenjang } from '../data/golonganData';
import { Printer, Edit3, Check, Calendar, AlertCircle, FileText, Landmark, User, Mail, Globe, Settings, GraduationCap, Download, Loader2 } from 'lucide-react';
import { toast, swal } from '../lib/toast';

// Helper canvas context for resolving modern CSS color spaces (OKLCH, OKLAB, color-mix, CSS variables) to standard RGB/HEX
const colorResolverCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (colorResolverCanvas) {
  colorResolverCanvas.width = 1;
  colorResolverCanvas.height = 1;
}
const colorResolverCtx = colorResolverCanvas ? colorResolverCanvas.getContext('2d', { willReadFrequently: true }) : null;

function resolveCssColorToRgb(colorStr: string): string {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'initial' || colorStr === 'none') {
    return colorStr;
  }
  if (!colorResolverCtx) return colorStr;
  try {
    colorResolverCtx.fillStyle = '#000000';
    colorResolverCtx.fillStyle = colorStr;
    return colorResolverCtx.fillStyle; // Automatically resolves oklch/oklab/color(...) to standard '#rrggbb' or 'rgba(...)'
  } catch (e) {
    return colorStr;
  }
}

// Deeply traverse and convert all computed styles to explicit inline sRGB styles so html2canvas renders perfectly
function prepareElementForCapture(clonedEl: HTMLElement, origEl: HTMLElement) {
  const origElements = [origEl, ...Array.from(origEl.querySelectorAll('*')) as HTMLElement[]];
  const clonedElements = [clonedEl, ...Array.from(clonedEl.querySelectorAll('*')) as HTMLElement[]];

  for (let i = 0; i < origElements.length && i < clonedElements.length; i++) {
    const orig = origElements[i];
    const clone = clonedElements[i];
    if (!orig || !clone || !clone.style) continue;

    try {
      const computed = window.getComputedStyle(orig);

      // 1. Text color
      const color = resolveCssColorToRgb(computed.color);
      if (color && color !== 'transparent') {
        clone.style.setProperty('color', color, 'important');
      }

      // 2. Background color
      const bg = resolveCssColorToRgb(computed.backgroundColor);
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        clone.style.setProperty('background-color', bg, 'important');
      }

      // 3. Borders
      const bt = resolveCssColorToRgb(computed.borderTopColor);
      const br = resolveCssColorToRgb(computed.borderRightColor);
      const bb = resolveCssColorToRgb(computed.borderBottomColor);
      const bl = resolveCssColorToRgb(computed.borderLeftColor);
      if (bt) clone.style.setProperty('border-top-color', bt, 'important');
      if (br) clone.style.setProperty('border-right-color', br, 'important');
      if (bb) clone.style.setProperty('border-bottom-color', bb, 'important');
      if (bl) clone.style.setProperty('border-left-color', bl, 'important');

      // 4. SVG fill & stroke
      if (orig instanceof SVGElement || clone instanceof SVGElement) {
        const fill = resolveCssColorToRgb(computed.fill);
        const stroke = resolveCssColorToRgb(computed.stroke);
        if (fill && fill !== 'none') clone.style.setProperty('fill', fill, 'important');
        if (stroke && stroke !== 'none') clone.style.setProperty('stroke', stroke, 'important');
      }
    } catch (e) {
      // Continue safely
    }
  }
}

function unwrapAtRule(cssText: string, ruleName: string): string {
  let result = cssText;
  if (ruleName === '@layer') {
    result = result.replace(/@layer\s+[^;{]+;/gi, '');
  }
  let searchIndex = 0;
  while (true) {
    const idx = result.toLowerCase().indexOf(ruleName, searchIndex);
    if (idx === -1) break;
    const openBraceIdx = result.indexOf('{', idx);
    if (openBraceIdx === -1) break;
    const semiIdx = result.indexOf(';', idx);
    if (semiIdx !== -1 && semiIdx < openBraceIdx) {
      searchIndex = semiIdx + 1;
      continue;
    }
    let depth = 0;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx; i < result.length; i++) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    if (closeBraceIdx !== -1) {
      const inner = result.substring(openBraceIdx + 1, closeBraceIdx);
      result = result.substring(0, idx) + inner + result.substring(closeBraceIdx + 1);
      searchIndex = idx;
    } else {
      break;
    }
  }
  return result;
}

function replaceOklchInString(cssText: string): string {
  if (!cssText || typeof cssText !== 'string') return cssText;

  let result = cssText;

  // 1. Remove @property blocks that legacy html2canvas parser cannot process
  result = result.replace(/@property\s+[^\{]+\{[^\}]*\}/gi, '');

  // 2. Unwrap @layer and @supports blocks so all utility classes (flex, grid, borders, w-20, etc.) become standard top-level CSS rules!
  result = unwrapAtRule(result, '@layer');
  result = unwrapAtRule(result, '@supports');

  // 3. Remove color space keywords from gradients and color-mix (e.g., "in oklab", "in oklch", "in lab", "in lch", "in srgb", "in hwb")
  result = result.replace(/\bin\s+(?:oklch|oklab|lch|lab|srgb|srgb-linear|hwb|xyz|xyz-d50|xyz-d65)\b/gi, '');

  // 3. Balanced parenthesis replacer for color functions
  const colorFunctions = ['color-mix', 'light-dark', 'oklch', 'oklab', 'lch', 'lab', 'hwb', 'color'];
  
  for (const funcName of colorFunctions) {
    let searchIndex = 0;
    const lowerFuncName = funcName.toLowerCase();
    
    while (true) {
      const lowerStr = result.toLowerCase();
      const idx = lowerStr.indexOf(lowerFuncName + '(', searchIndex);
      if (idx === -1) break;
      
      // Find matching closing parenthesis
      let depth = 0;
      let endIdx = -1;
      const startIdx = idx + funcName.length + 1;
      for (let i = idx + funcName.length; i < result.length; i++) {
        if (result[i] === '(') depth++;
        else if (result[i] === ')') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      
      if (endIdx !== -1) {
        const fullColorFunc = result.substring(idx, endIdx + 1);
        let replacement = resolveCssColorToRgb(fullColorFunc) || '#cbd5e1';
        
        result = result.substring(0, idx) + replacement + result.substring(endIdx + 1);
        searchIndex = idx + replacement.length;
      } else {
        break;
      }
    }
  }

  // 4. Fallback regex cleanup for any malformed or leftover strings
  result = result.replace(/oklch\s*\([^;}]*/gi, '#cbd5e1');
  result = result.replace(/oklab\s*\([^;}]*/gi, '#cbd5e1');
  result = result.replace(/lch\s*\([^;}]*/gi, '#cbd5e1');
  result = result.replace(/lab\s*\([^;}]*/gi, '#cbd5e1');
  result = result.replace(/color-mix\s*\([^;}]*/gi, '#cbd5e1');

  return result;
}

const compressLogoImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const MAX_HEIGHT = 500;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

interface OfficialPAKReportProps {
  profile: TeacherProfile;
  setProfile: (profile: TeacherProfile) => void;
  evaluations: SKPEvaluation[];
  kopSettings?: KopSettings;
  setKopSettings?: (settings: KopSettings) => void;
  selectedEvalId?: string;
  onSelectEvalId?: (id: string) => void;
}

export default function OfficialPAKReport({
  profile: rawProfile,
  setProfile,
  evaluations,
  kopSettings: propKopSettings,
  setKopSettings: propSetKopSettings,
  selectedEvalId = 'all',
  onSelectEvalId
}: OfficialPAKReportProps) {
  // Local state as fallback if not passed as props
  const [localKopSettings, setLocalKopSettings] = useState<KopSettings>(() => {
    const saved = localStorage.getItem('sipak_kop_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      logoType: 'svg-jabar' as 'svg-jabar' | 'url',
      customLogoUrl: '',
      row1: 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
      row2: 'DINAS PENDIDIKAN',
      row3: 'Jalan. Dr. Radjiman No. 6 Telp (022) 4264813 Fax. (022) 4264881',
      row4: 'Website : disdik.jabarprov.go.id',
      row5: 'e-mail: disdik@jabar.prov.go.id / sekretariatdisdikjabar@gmail.com',
      row6: 'BANDUNG - 40171'
    };
  });

  const kopSettings = propKopSettings || localKopSettings;
  const setKopSettings = propSetKopSettings || setLocalKopSettings;

  useEffect(() => {
    if (!propKopSettings) {
      localStorage.setItem('sipak_kop_settings', JSON.stringify(localKopSettings));
    }
  }, [localKopSettings, propKopSettings]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    let stageContainer: HTMLDivElement | null = null;
    
    try {
      const page1 = document.getElementById('pak-page-1');
      const page2 = document.getElementById('pak-page-2');
      const page3 = document.getElementById('pak-page-3');

      if (!page1 || !page2 || !page3) {
        toast.error("Elemen halaman laporan tidak lengkap.");
        setIsDownloading(false);
        return;
      }

      toast.info("Sedang memproses & menyusun berkas PDF PAK Resmi F4 (3 Halaman)...");

      // Create an isolated staging container positioned offscreen at (0,0)
      stageContainer = document.createElement('div');
      stageContainer.id = 'pak-pdf-render-stage';
      stageContainer.style.position = 'fixed';
      stageContainer.style.top = '0';
      stageContainer.style.left = '-9999px';
      stageContainer.style.width = '812px'; // Exact 215mm width in standard 96dpi
      stageContainer.style.minHeight = '1247px'; // Exact 330mm height
      stageContainer.style.backgroundColor = '#ffffff';
      stageContainer.style.color = '#000000';
      stageContainer.style.zIndex = '-9999';
      stageContainer.style.overflow = 'visible';
      document.body.appendChild(stageContainer);

      const pages = [page1, page2, page3];
      const pdf = new jsPDF({
        unit: 'mm',
        format: [215, 330],
        orientation: 'portrait',
        compress: true
      });

      for (let i = 0; i < pages.length; i++) {
        const origPage = pages[i];
        
        // 1. Deep clone page element into isolated stage
        const clone = origPage.cloneNode(true) as HTMLElement;
        clone.id = `capture-page-${i + 1}`;
        clone.style.width = '812px';
        clone.style.minHeight = '1247px';
        clone.style.boxSizing = 'border-box';
        clone.style.backgroundColor = '#ffffff';
        clone.style.color = '#000000';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';
        clone.style.border = 'none';

        stageContainer.innerHTML = '';
        stageContainer.appendChild(clone);

        // 2. Prepare and sanitize all computed colors to explicit inline sRGB / HEX
        prepareElementForCapture(clone, origPage);

        // 3. Render high-resolution canvas without any window offset
        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1000,
          onclone: (clonedDoc: Document) => {
            clonedDoc.querySelectorAll('style').forEach(style => {
              if (style.textContent) {
                style.textContent = replaceOklchInString(style.textContent);
              }
            });
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        if (i > 0) {
          pdf.addPage([215, 330], 'portrait');
        }

        // Place the rendered canvas image covering the 215mm x 330mm F4 page
        pdf.addImage(imgData, 'JPEG', 0, 0, 215, 330, undefined, 'FAST');
      }

      const cleanName = (profile.name || 'Guru').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanNip = (profile.nip || '').replace(/[^0-9]/g, '');
      const fileName = `PAK_${cleanName}_NIP_${cleanNip || 'Guru_PNS'}.pdf`;

      pdf.save(fileName);

      swal.fire({
        title: "Dokumen PDF Berhasil Diunduh!",
        text: `Berkas PAK resmi F4/Folio (3 Halaman Pas) milik Guru PNS "${profile.name}" berhasil diunduh dengan tata letak yang rapi dan tulisan yang jelas.`,
        icon: "success",
        confirmButtonText: "Selesai"
      });
    } catch (error) {
      console.error("Gagal mengunduh PDF:", error);
      swal.fire({
        title: "Gagal Mengunduh PDF",
        text: "Terjadi kendala saat rendering: " + (error instanceof Error ? error.message : String(error)),
        icon: "error"
      });
    } finally {
      if (stageContainer && stageContainer.parentNode) {
        stageContainer.parentNode.removeChild(stageContainer);
      }
      setIsDownloading(false);
    }
  };

  const handlePrintDocument = () => {
    try {
      const printContainer = document.getElementById('pak-print-pages');
      if (!printContainer) {
        window.print();
        return;
      }

      const printWin = window.open('', '_blank', 'width=950,height=1100');
      if (printWin) {
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(el => el.outerHTML)
          .join('\n');
        
        printWin.document.open();
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Cetak PAK Resmi F4 - ${profile.name || 'Guru PNS'}</title>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              ${styles}
              <style>
                @page {
                  size: 215mm 330mm;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: #ffffff;
                  color: #000000;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  font-family: "Times New Roman", Times, Georgia, serif;
                }
                #pak-print-pages {
                  width: 215mm !important;
                  margin: 0 auto !important;
                  padding: 0 !important;
                }
                .print-page {
                  width: 215mm !important;
                  height: 330mm !important;
                  max-height: 330mm !important;
                  box-sizing: border-box !important;
                  padding: 12mm 15mm 10mm 15mm !important;
                  margin: 0 auto !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                }
                .print-page:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                @media screen {
                  body {
                    background: #525659;
                    padding: 20px 0;
                  }
                  .print-page {
                    margin-bottom: 20px !important;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                  }
                }
              </style>
            </head>
            <body>
              <div id="pak-print-pages">
                ${printContainer.innerHTML}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                  }, 600);
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
    }
  };

  const handleMetaChange = (key: keyof TeacherProfile, value: any) => {
    setProfile({
      ...rawProfile,
      [key]: value
    });
  };

  const allSortedEvaluationsChrono = useMemo(() => {
    return [...evaluations].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year; // Oldest first
      if (a.period === 'Tahunan' && b.period !== 'Tahunan') return 1;
      if (b.period === 'Tahunan' && a.period !== 'Tahunan') return -1;
      return a.period.localeCompare(b.period);
    });
  }, [evaluations]);

  const targetEval = useMemo<SKPEvaluation | null>(() => {
    if (selectedEvalId && selectedEvalId !== 'all') {
      const found = evaluations.find(e => e.id === selectedEvalId);
      if (found) return found;
    }
    if (allSortedEvaluationsChrono.length > 0) {
      return allSortedEvaluationsChrono[allSortedEvaluationsChrono.length - 1];
    }
    return null;
  }, [selectedEvalId, evaluations, allSortedEvaluationsChrono]);

  const latestEval = targetEval;

  const sortedEvaluationsChrono = useMemo(() => {
    if (!latestEval) return allSortedEvaluationsChrono;
    const idx = allSortedEvaluationsChrono.findIndex(e => e.id === latestEval.id);
    if (idx !== -1) {
      return allSortedEvaluationsChrono.slice(0, idx + 1);
    }
    return allSortedEvaluationsChrono;
  }, [allSortedEvaluationsChrono, latestEval]);

  const sortedEvaluations = useMemo(() => {
    return [...sortedEvaluationsChrono].reverse();
  }, [sortedEvaluationsChrono]);

  const profile = useMemo<TeacherProfile>(() => {
    if (!targetEval || !targetEval.overrideData) return rawProfile;
    const ov = targetEval.overrideData;
    return {
      ...rawProfile,
      ...(ov.currentGolongan ? { currentGolongan: ov.currentGolongan } : {}),
      ...(ov.tmtCurrentPangkat ? { tmtCurrentPangkat: ov.tmtCurrentPangkat } : {}),
      ...(ov.tmtCurrentJabatan ? { tmtCurrentJabatan: ov.tmtCurrentJabatan } : {}),
      ...(ov.unitKerja ? { unitKerja: ov.unitKerja, school: ov.unitKerja } : {}),
      ...(ov.instansiBiro ? { instansiBiro: ov.instansiBiro } : {}),
      ...(ov.nomorSuratKonversi ? { nomorSuratKonversi: ov.nomorSuratKonversi } : {}),
      ...(ov.nomorSuratAkumulasi ? { nomorSuratAkumulasi: ov.nomorSuratAkumulasi } : {}),
      ...(ov.nomorSuratPenetapan ? { nomorSuratPenetapan: ov.nomorSuratPenetapan } : {}),
      ...(ov.tempatDitetapkan ? { tempatDitetapkan: ov.tempatDitetapkan } : {}),
      ...(ov.tanggalPenetapan ? { tanggalPenetapan: ov.tanggalPenetapan } : {}),
      ...(ov.pejabatPenilaiTitle ? { pejabatPenilaiTitle: ov.pejabatPenilaiTitle } : {}),
      ...(ov.pejabatPenilaiInstansi ? { pejabatPenilaiInstansi: ov.pejabatPenilaiInstansi } : {}),
      ...(ov.pejabatPenilaiNama ? { pejabatPenilaiNama: ov.pejabatPenilaiNama } : {}),
      ...(ov.pejabatPenilaiNip ? { pejabatPenilaiNip: ov.pejabatPenilaiNip } : {}),
      ...(ov.pejabatPenilaiGolongan ? { pejabatPenilaiGolongan: ov.pejabatPenilaiGolongan } : {}),
      ...(ov.pejabatPenilaiStatus ? { pejabatPenilaiStatus: ov.pejabatPenilaiStatus } : {}),
    };
  }, [rawProfile, targetEval]);

  const priorEvaluations = useMemo(() => {
    if (!latestEval) return [];
    const idx = sortedEvaluationsChrono.findIndex(e => e.id === latestEval.id);
    if (idx !== -1) {
      return sortedEvaluationsChrono.slice(0, idx);
    }
    return sortedEvaluationsChrono.filter(item => item.id !== latestEval.id);
  }, [latestEval, sortedEvaluationsChrono]);

  // Calculations
  const totalKonversi = useMemo(() => {
    return sortedEvaluationsChrono.reduce((sum, item) => sum + (item.creditEarned || 0), 0) + (profile.akIntegrasi2022 || 0);
  }, [sortedEvaluationsChrono, profile.akIntegrasi2022]);

  // Page 3 Konversi Breakdown:
  // "BARU" is latestEval
  // "LAMA" is everything else including PAK Integrasi 2022
  const { konversiLama, konversiBaru, konversiJumlah } = useMemo(() => {
    if (!latestEval) {
      return { konversiLama: profile.akIntegrasi2022 || 0, konversiBaru: 0, konversiJumlah: profile.akIntegrasi2022 || 0 };
    }
    const baru = latestEval.creditEarned || 0;
    const lama = priorEvaluations.reduce((sum, item) => sum + (item.creditEarned || 0), 0) + (profile.akIntegrasi2022 || 0);
    return {
      konversiLama: lama,
      konversiBaru: baru,
      konversiJumlah: lama + baru
    };
  }, [priorEvaluations, latestEval, profile.akIntegrasi2022]);

  const { pendidikanLama, pendidikanBaru, pendidikanJumlah } = useMemo(() => {
    const baru = latestEval ? (latestEval.akPendidikan || 0) : 0;
    const lama = (profile.akPendidikan || 0) + priorEvaluations.reduce((sum, item) => sum + (item.akPendidikan || 0), 0);
    return {
      pendidikanLama: lama,
      pendidikanBaru: baru,
      pendidikanJumlah: lama + baru
    };
  }, [priorEvaluations, latestEval, profile.akPendidikan]);

  // Grand Total cumulative (Row 4 + Row 5)
  const accumLama = useMemo(() => {
    return konversiLama + pendidikanLama;
  }, [konversiLama, pendidikanLama]);

  const accumBaru = useMemo(() => {
    return konversiBaru + pendidikanBaru;
  }, [konversiBaru, pendidikanBaru]);

  const accumJumlah = useMemo(() => {
    return accumLama + accumBaru;
  }, [accumLama, accumBaru]);

  // Targets and Deficits mapping
  const currentDetail = useMemo(() => {
    return GOLONGAN_LIST.find(g => g.id === profile.currentGolongan) || GOLONGAN_LIST[0];
  }, [profile.currentGolongan]);

  const targetDetail = useMemo(() => {
    return GOLONGAN_LIST.find(g => g.id === profile.targetGolongan) || GOLONGAN_LIST[1];
  }, [profile.targetGolongan]);

  // Clean, modern alignment with BKN incremental standards (replaces flawed absolute targets)
  const minimalPangkat = useMemo(() => {
    return getMinimalPangkat(profile.currentGolongan);
  }, [profile.currentGolongan]);

  const minimalJenjang = useMemo(() => {
    return getMinimalJenjang(profile.currentGolongan);
  }, [profile.currentGolongan]);

  const kekuranganPangkat = useMemo(() => {
    if (minimalPangkat <= 0) return 0;
    const gap = minimalPangkat - accumJumlah;
    return gap > 0 ? gap : 0;
  }, [minimalPangkat, accumJumlah]);

  const kekuranganJenjang = useMemo(() => {
    if (minimalJenjang <= 0) return 0;
    const gap = minimalJenjang - accumJumlah;
    return gap > 0 ? gap : 0;
  }, [minimalJenjang, accumJumlah]);

  const isPangkatSurplus = useMemo(() => {
    return accumJumlah >= minimalPangkat;
  }, [accumJumlah, minimalPangkat]);

  const isJenjangSurplus = useMemo(() => {
    return accumJumlah >= minimalJenjang;
  }, [accumJumlah, minimalJenjang]);

  const pangkatDiffValue = useMemo(() => {
    if (minimalPangkat <= 0) return 0;
    return Math.abs(accumJumlah - minimalPangkat);
  }, [accumJumlah, minimalPangkat]);

  const jenjangDiffValue = useMemo(() => {
    if (minimalJenjang <= 0) return 0;
    return Math.abs(accumJumlah - minimalJenjang);
  }, [accumJumlah, minimalJenjang]);

  const isJenjangChange = useMemo(() => {
    const curLevel = getTeacherLevel(profile.currentGolongan);
    const tgtLevel = getTeacherLevel(profile.targetGolongan);
    return curLevel !== tgtLevel;
  }, [profile.currentGolongan, profile.targetGolongan]);

  const isLolosPangkat = isJenjangChange 
    ? (kekuranganPangkat <= 0 && kekuranganJenjang <= 0) 
    : (kekuranganPangkat <= 0);

  const recommendationText = useMemo(() => {
    const tgtLevel = getTeacherLevel(profile.targetGolongan);
    const targetPangkatName = targetDetail.pangkat.replace(/\(s1\)/i, '').trim().toUpperCase();
    
    if (isLolosPangkat) {
      if (isJenjangChange) {
        return `DAPAT DIPERTIMBANGKAN UNTUK KENAIKAN JENJANG JABATAN SETINGKAT LEBIH TINGGI MENJADI GURU ${tgtLevel.toUpperCase()} PANGKAT/GOLONGAN RUANG ${targetPangkatName} (${profile.targetGolongan}).`;
      } else {
        return `DAPAT DIPERTIMBANGKAN UNTUK KENAIKAN PANGKAT SETINGKAT LEBIH TINGGI MENJADI PANGKAT/GOLONGAN RUANG ${targetPangkatName} (${profile.targetGolongan}).`;
      }
    } else {
      if (isJenjangChange) {
        return `TIDAK DAPAT DIPERTIMBANGKAN UNTUK KENAIKAN JENJANG JABATAN SETINGKAT LEBIH TINGGI MENJADI GURU ${tgtLevel.toUpperCase()} PANGKAT/GOLONGAN RUANG ${targetPangkatName} (${profile.targetGolongan}).`;
      } else {
        return `TIDAK DAPAT DIPERTIMBANGKAN UNTUK KENAIKAN PANGKAT SETINGKAT LEBIH TINGGI MENJADI PANGKAT/GOLONGAN RUANG ${targetPangkatName} (${profile.targetGolongan}).`;
      }
    }
  }, [isLolosPangkat, isJenjangChange, profile.targetGolongan, targetDetail]);
  
  const formattedPeriode = useMemo(() => {
    if (!latestEval) {
      return "01-01-2025 s.d 31-12-2025";
    }
    
    if (latestEval.startDate && latestEval.endDate) {
      const formatPart = (dateStr: string) => {
        const p = dateStr.split('-');
        if (p.length === 3) {
          return `${p[2]}-${p[1]}-${p[0]}`;
        }
        return dateStr;
      };
      return `${formatPart(latestEval.startDate)} s.d. ${formatPart(latestEval.endDate)}`;
    }
    
    const year = latestEval.year;
    switch (latestEval.period) {
      case 'Tahunan':
        return `01-01-${year} s.d 31-12-${year}`;
      case 'Triwulan I':
        return `01-01-${year} s.d 31-03-${year}`;
      case 'Triwulan II':
        return `01-04-${year} s.d 30-06-${year}`;
      case 'Triwulan III':
        return `01-07-${year} s.d 30-09-${year}`;
      case 'Triwulan IV':
        return `01-10-${year} s.d 31-12-${year}`;
      default:
        const pLower = latestEval.period.toLowerCase();
        if (pLower.includes('september') && pLower.includes('desember')) {
          return `01-09-${year} s.d 31-12-${year}`;
        }
        return `01-01-${year} s.d 31-12-${year}`;
    }
  }, [latestEval]);
  
  // Custom helper to render dynamic institutional Letter Header
  const renderGovHeader = () => (
    <div className="flex items-center gap-4 border-b-4 border-double border-black pb-3 mb-4 text-black select-none" style={{ borderBottom: "4px double #000000", color: "#000000" }}>
      {/* High-fidelity SVG of West Java Coat of Arms (Logo Jabar) or Custom Image URL */}
      <div className="w-20 h-22 print:w-16 print:h-18 shrink-0 flex items-center justify-center">
        {kopSettings.logoType === 'url' && kopSettings.customLogoUrl ? (
          <img 
            src={kopSettings.customLogoUrl} 
            alt="Logo Instansi" 
            className="max-w-full max-h-full object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg viewBox="0 0 100 110" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="ellipse-clip-header">
                <ellipse cx="50" cy="50" rx="35" ry="46" />
              </clipPath>
            </defs>
            
            {/* Outer yellow border shield */}
            <ellipse cx="50" cy="50" rx="37" ry="48" fill="#fec309" stroke="#111111" strokeWidth="1.2" />
            <ellipse cx="50" cy="50" rx="35" ry="46" fill="#15a03d" stroke="#111111" strokeWidth="0.8" />
            
            {/* Clipped content */}
            <g clipPath="url(#ellipse-clip-header)">
              {/* Split bottom left: Blue and White waves */}
              <rect x="15" y="62" width="35" height="40" fill="#0f4cc5" />
              {/* Waves lines */}
              <path d="M15 67 Q25 72 35 67 Q43 65 50 67" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <path d="M15 74 Q25 79 35 74 Q43 72 50 74" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <path d="M15 81 Q25 86 35 81 Q43 79 50 81" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <path d="M15 88 Q25 93 35 88 Q43 86 50 88" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              
              {/* Split bottom right: Blue and White checks */}
              <rect x="50" y="62" width="35" height="40" fill="#ffffff" />
              {/* Checkers layout */}
              <rect x="50" y="62" width="8.75" height="8" fill="#0f4cc5" />
              <rect x="67.5" y="62" width="8.75" height="8" fill="#0f4cc5" />
              
              <rect x="58.75" y="70" width="8.75" height="8" fill="#0f4cc5" />
              <rect x="76.25" y="70" width="8.75" height="8" fill="#0f4cc5" />
              
              <rect x="50" y="78" width="8.75" height="8" fill="#0f4cc5" />
              <rect x="67.5" y="78" width="8.75" height="8" fill="#0f4cc5" />
              
              <rect x="58.75" y="86" width="8.75" height="8" fill="#0f4cc5" />
              <rect x="76.25" y="86" width="8.75" height="8" fill="#0f4cc5" />

              <g stroke="#ffffff" strokeWidth="0.5">
                <line x1="50" y1="62" x2="50" y2="96" />
                <line x1="58.75" y1="62" x2="58.75" y2="96" />
                <line x1="67.5" y1="62" x2="67.5" y2="96" />
                <line x1="76.25" y1="62" x2="76.25" y2="96" />
              </g>

              {/* Black fortress/dam dividing bar */}
              <path d="M 12 62 L 20 62 L 23 57 L 33 57 L 36 62 L 44 62 L 47 57 L 57 57 L 60 62 L 66 62 L 69 57 L 79 57 L 82 62 L 88 62 L 88 67 L 12 67 Z" fill="#111111" />
            </g>

            {/* Central Kujang standing vertically */}
            <rect x="48.5" y="46" width="3" height="9" rx="1" fill="#e11d48" stroke="#111111" strokeWidth="0.5" />
            <path d="M49.5 46 C47 44 45 42 45 38 C45 37 47.5 35 48.5 35 C45 31 39 23 48 11 C48 18 52 22 54 24 C56 26 57 28 55 30 C53 32 50 34 50 37 C50 39 52 42 50 46 Z" fill="#ffffff" stroke="#111111" strokeWidth="0.6" />
            <circle cx="51.5" cy="18" r="0.6" fill="#111111" />
            <circle cx="52.4" cy="21" r="0.6" fill="#111111" />
            <circle cx="53.2" cy="24" r="0.6" fill="#111111" />
            <circle cx="53.8" cy="27" r="0.6" fill="#111111" />
            <circle cx="53.3" cy="30" r="0.6" fill="#111111" />

            {/* Curved Rice (Left) */}
            <path d="M 33 60 C 20 45 25 25 41 12" stroke="#fec309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M 23 48 Q 28 47 30 50" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 21 42 Q 27 41 28 44" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 22 36 Q 28 35 29 38" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 23 30 Q 29 29 30 32" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 26 24 Q 31 24 33 27" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 30 19 Q 35 20 36 23" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 35 15 Q 39 17 39 20" stroke="#fec309" strokeWidth="1.5" strokeLinecap="round" />

            {/* Curved Cotton (Right) */}
            <path d="M 67 60 C 80 45 75 25 59 12" stroke="#15a03d" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <circle cx="73" cy="46" r="2.2" fill="#ffffff" stroke="#111111" strokeWidth="0.5" />
            <circle cx="75" cy="39" r="2.2" fill="#ffffff" stroke="#111111" strokeWidth="0.5" />
            <circle cx="74" cy="32" r="2.2" fill="#ffffff" stroke="#111111" strokeWidth="0.5" />
            <circle cx="70" cy="25" r="2.2" fill="#ffffff" stroke="#111111" strokeWidth="0.5" />
            <circle cx="64" cy="19" r="2.2" fill="#ffffff" stroke="#111111" strokeWidth="0.5" />

            {/* Golden ribbon at the bottom */}
            <path d="M 16 88 L 8 82 L 16 76 Z" fill="#d97706" stroke="#111111" strokeWidth="0.8" />
            <path d="M 84 88 L 92 82 L 84 76 Z" fill="#d97706" stroke="#111111" strokeWidth="0.8" />
            <path d="M 12 84 Q 50 101 88 84 L 86 75 Q 50 92 14 75 Z" fill="#fec309" stroke="#111111" strokeWidth="0.8" />
            
            <path id="jabar-text-path-header" d="M 14 82 Q 50 99 86 82" fill="none" stroke="none" />
            <text fontFamily="Georgia, serif" fontSize="4.2" fontWeight="bold" fill="#000000" textAnchor="middle">
              <textPath href="#jabar-text-path-header" startOffset="50%">GEMAH RIPAH REPEH RAPIH</textPath>
            </text>
          </svg>
        )}
      </div>

      <div className="flex-1 text-center font-serif" style={{ color: "#000000" }}>
        {kopSettings.row1 && <h2 className="text-base print:text-[11pt] font-black tracking-wide leading-tight uppercase" style={{ color: "#000000" }}>{kopSettings.row1}</h2>}
        {kopSettings.row2 && <h1 className="text-xl print:text-[13pt] font-black tracking-normal leading-tight uppercase" style={{ color: "#000000" }}>{kopSettings.row2}</h1>}
        {kopSettings.row3 && <p className="text-[11px] print:text-[8pt] leading-snug" style={{ color: "#000000" }}>{kopSettings.row3}</p>}
        {kopSettings.row4 && <p className="text-[11px] print:text-[8pt] leading-snug" style={{ color: "#000000" }}>{kopSettings.row4}</p>}
        {kopSettings.row5 && <p className="text-[11px] print:text-[8pt] leading-snug" style={{ color: "#000000" }}>{kopSettings.row5}</p>}
        {kopSettings.row6 && <h3 className="text-xs print:text-[8.5pt] font-bold tracking-widest mt-0.5 uppercase" style={{ color: "#000000" }}>{kopSettings.row6}</h3>}
      </div>
    </div>
  );

  // Reusable Personal Details Table
  const renderPersonalTable = () => (
    <div className="border border-black text-[11px] text-black w-full my-2 font-serif">
      <div className="bg-slate-100 font-bold text-center border-b border-black py-1 select-none tracking-wide text-[10px]">
        PEJABAT FUNGSIONAL YANG DINILAI
      </div>
      <table className="w-full text-left border-collapse">
        <tbody>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 w-[5%] text-center border-r border-black font-semibold align-middle">1</td>
            <td className="py-1 px-2.5 w-[35%] border-r border-black font-semibold align-middle">NAMA</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {profile.name || "___________________________"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">2</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">NIP</td>
            <td className="py-1 px-2.5 font-mono text-[10.5px] align-middle"> {profile.nip || "___________________________"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">3</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">NOMOR SERI KARPEG</td>
            <td className="py-1 px-2.5 font-mono text-[10.5px] align-middle"> {profile.karpegNumber || "-"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">4</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">TEMPAT/TGL. LAHIR</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {profile.birthPlaceDate || "___________________________"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">5</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">JENIS KELAMIN</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {profile.gender || "Laki-Laki"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">6</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">PANGKAT/GOLONGAN RUANG TMT</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {currentDetail.pangkat} / {profile.currentGolongan} / {profile.tmtCurrentPangkat || "01-04-2024"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">7</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">JABATAN/TMT</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> GURU {getTeacherLevel(profile.currentGolongan).toUpperCase()} / {profile.tmtCurrentJabatan || "24-08-2023"}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">8</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">UNIT KERJA</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {profile.unitKerja || profile.school || "___________________________"}</td>
          </tr>
          <tr>
            <td className="py-1 px-2.5 text-center border-r border-black font-semibold align-middle">9</td>
            <td className="py-1 px-2.5 border-r border-black font-semibold align-middle">INSTANSI</td>
            <td className="py-1 px-2.5 text-[11px] align-middle"> {profile.instansiBiro || "PEMERINTAH PROVINSI JAWA BARAT"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // Reusable Signatures Block (Jabar Style supporting both TTE and TTD Basah)
  const renderSignatureBlock = () => {
    // Read signature preference
    const signatureType = profile.signatureType || kopSettings.signatureType || 'tte';
    const ttdBasahType = profile.ttdBasahType || kopSettings.ttdBasahType || 'blank';
    const ttdBasahImage = profile.ttdBasahImageBase64 || kopSettings.ttdBasahImageBase64 || profile.ttdBasahImageUrl || kopSettings.ttdBasahImageUrl || '';
    const ttdBasahHeight = profile.ttdBasahHeight || kopSettings.ttdBasahHeight || 80;

    // Read from shared kopSettings, fallback to profile for backward compatibility, then default
    const tteLogoType = kopSettings.tteLogoType || profile.tteLogoType || 'default';
    const tteLogoUrl = kopSettings.tteLogoUrl || profile.tteLogoUrl || '';
    const tteLogoBase64 = kopSettings.tteLogoBase64 || profile.tteLogoBase64 || '';
    const tteTextHeader = kopSettings.tteTextHeader || profile.tteTextHeader || 'Ditandatangani secara elektronik oleh :';

    const titlePrefix = profile.pejabatPenilaiStatus === 'plt' ? 'Plt. ' : profile.pejabatPenilaiStatus === 'plh' ? 'Plh. ' : '';

    // Automatically fall back to Pejabat Penilai titles to avoid manual repetitive input
    const tteTextJabatan1 = kopSettings.tteTextJabatan1 || profile.tteTextJabatan1 || (titlePrefix + (profile.pejabatPenilaiTitle || 'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII'));
    const tteTextJabatan2 = kopSettings.tteTextJabatan2 || profile.tteTextJabatan2 || profile.pejabatPenilaiInstansi || 'PROVINSI JAWA BARAT';

    return (
      <div className="pt-3 grid grid-cols-2 gap-4 text-[10px] text-black font-serif my-2 select-none leading-tight">
        <div>
          <p className="font-semibold italic">ASLI Penetapan Angka Kredit untuk:</p>
          <p className="font-bold underline uppercase text-slate-900">{profile.name}</p>
          
          <div className="mt-2">
            <p className="font-semibold">Tembusan disampaikan kepada:</p>
            <ol className="list-decimal pl-4 space-y-0 text-[9px]">
              <li>Yth. Pimpinan Instansi Pembina Jabatan Fungsional yang bersangkutan;</li>
              <li>Yth. Kepala Badan Kepegawaian Negara/Kepala Kantor Regional III BKN;</li>
              <li>Yth. Sekretaris Daerah Provinsi Jawa Barat;</li>
              <li>Yth. Kepala Dinas Pendidikan;</li>
              <li>Yth. Sekretaris Tim Penilai Kinerja PNS Pemerintah Provinsi Jawa Barat.</li>
            </ol>
          </div>
        </div>

        <div className="pl-6 border-l border-dashed border-slate-300 flex flex-col justify-start">
          <p className="text-black text-[10.5px] font-serif font-semibold">Ditetapkan di {profile.tempatDitetapkan || "Bandung"}</p>
          <p className="text-black text-[10.5px] font-serif font-semibold">Pada tanggal {profile.tanggalPenetapan || "02 April 2026"}</p>
          
          <div className="mt-2 text-[10.5px] font-serif leading-tight">
            <p className="font-bold">Pejabat Penilai Kinerja</p>
            <p className="font-bold uppercase text-[9.5px]">{titlePrefix}{profile.pejabatPenilaiTitle || "KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII"}</p>
            <p className="font-bold uppercase text-[9.5px]">{profile.pejabatPenilaiInstansi || "PROVINSI JAWA BARAT"}</p>
          </div>

          {signatureType === 'ttd_basah' ? (
            /* WET SIGNATURE BLOCK (TANDA TANGAN BASAH / SCAN) */
            <div className="mt-1 w-full max-w-[350px]">
              <div className="flex items-center justify-center my-0.5" style={{ minHeight: `${Math.min(ttdBasahHeight, 70)}px` }}>
                {ttdBasahType === 'upload' && ttdBasahImage ? (
                  <img 
                    src={ttdBasahImage} 
                    alt="Scan TTD Basah & Stempel" 
                    className="max-h-20 max-w-[220px] object-contain my-0.5"
                    style={{ display: 'block' }}
                  />
                ) : (
                  <div style={{ height: `${Math.min(ttdBasahHeight, 70)}px` }} className="w-full flex items-end justify-center">
                    <span className="text-[9px] text-slate-300 italic print:hidden">(Ruang Tanda Tangan Tinta & Stempel)</span>
                  </div>
                )}
              </div>

              <div className="text-[10.5px] font-serif leading-tight mt-1">
                <p className="font-bold text-black uppercase underline decoration-1">
                  {profile.pejabatPenilaiNama || "DWI YANTI ESTRININGRUM, S.Sos., M.Pd."}
                </p>
                <p className="font-bold text-black uppercase text-[9.5px]">
                  NIP. {profile.pejabatPenilaiNip || "19730512 199803 2 004"}
                </p>
                <p className="text-black text-[9.5px]">
                  {profile.pejabatPenilaiGolongan || "Pembina Tk.I"}
                  {!(profile.pejabatPenilaiGolongan || "Pembina Tk.I").endsWith('.') ? '.' : ''}
                </p>
              </div>
            </div>
          ) : (
            /* DISPUSIPDA / BSrE Electronic Signature Specimen Box (TTE) */
            <div className="mt-2 border-[1.5px] border-black rounded-xl p-2.5 flex items-center gap-3 bg-white w-full max-w-[350px]">
              {/* Left Column: TTD Electronic Logo (Enlarged) */}
              <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center">
                {tteLogoType === 'upload' && tteLogoBase64 ? (
                  <img 
                    src={tteLogoBase64} 
                    alt="TTE Logo" 
                    className="w-14 h-14 object-contain"
                    style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
                  />
                ) : tteLogoType === 'url' && tteLogoUrl ? (
                  <img 
                    src={tteLogoUrl} 
                    alt="TTE Logo" 
                    className="w-14 h-14 object-contain"
                    referrerPolicy="no-referrer"
                    style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
                  />
                ) : (
                  <SpecimenSVG className="w-14 h-14 shrink-0 select-none" />
                )}
              </div>

              {/* Right Column: Dynamic Specimen Text */}
              <div className="text-[9.5px] leading-tight font-sans text-black select-none">
                <p className="text-slate-800 italic text-[9px] mb-0.5">{tteTextHeader}</p>
                <p className="font-bold text-black uppercase text-[9.5px] tracking-tight">{tteTextJabatan1}</p>
                <p className="font-bold text-black uppercase text-[9.5px] tracking-tight">{tteTextJabatan2}</p>
                
                <div className="mt-2 font-sans text-[9.5px]">
                  <p className="font-bold text-black uppercase">{profile.pejabatPenilaiNama || "DWI YANTI ESTRININGRUM, S.Sos., M.Pd."}</p>
                  <p className="text-slate-800 text-[9px]">
                    {profile.pejabatPenilaiGolongan || "Pembina Tk.I"}
                    {!(profile.pejabatPenilaiGolongan || "Pembina Tk.I").endsWith('.') ? '.' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="official-pak-tab" className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {selectedEvalId && selectedEvalId !== 'all' && (
        <div className="xl:col-span-12 bg-amber-50 border-2 border-amber-400 p-4 rounded-xl flex items-center justify-between text-amber-900 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Mode Cetak Per Tahun
                </span>
                <h4 className="text-sm font-black">
                  Mencetak PAK Khusus Periode: {latestEval?.period} {latestEval?.year}
                </h4>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Dokumen PAK ini menggunakan data riwayat predikat dan data pejabat/golongan yang berlaku pada periode ini. Perhitungan Angka Kredit disesuaikan hingga periode tersebut tanpa mempengaruhi data akumulasi terbaru.
              </p>
            </div>
          </div>
          {onSelectEvalId && (
            <button 
              onClick={() => onSelectEvalId('all')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              Kembali ke Mode Akumulasi Terbaru
            </button>
          )}
        </div>
      )}
      
      {/* Editor Sidebar Left (5 cols) */}
      <div className="xl:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4 print:hidden">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
            <Landmark className="w-5 h-5 text-teal-600" /> Konfigurasi Blangko PAK Resmi
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Data di bawah ini akan diisikan ke dalam format lampiran asli Pemerintah Daerah Provinsi Jawa Barat Dinas Pendidikan.
          </p>
        </div>

        <div className="space-y-4 max-h-[750px] overflow-y-auto pr-2">
          
          {/* Section 1: Identitas Fungsional */}
          <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-150 space-y-3">
            <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> 1. Data Personal Pegawai
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NOMOR SERI KARPEG</label>
                <input
                  type="text"
                  value={profile.karpegNumber || ''}
                  onChange={e => handleMetaChange('karpegNumber', e.target.value.toUpperCase())}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                  placeholder="Contoh: B03023705"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">JENIS KELAMIN</label>
                <select
                  value={profile.gender || 'Laki-Laki'}
                  onChange={e => handleMetaChange('gender', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                >
                  <option value="Laki-Laki">Laki-Laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TEMPAT, TANGGAL LAHIR</label>
              <input
                type="text"
                value={profile.birthPlaceDate || ''}
                onChange={e => handleMetaChange('birthPlaceDate', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                placeholder="Contoh: CIAMIS, 19-06-1986"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TMT GOLONGAN TERAKHIR</label>
                <input
                  type="text"
                  value={profile.tmtCurrentPangkat || ''}
                  onChange={e => handleMetaChange('tmtCurrentPangkat', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                  placeholder="Contoh: 01-04-2024"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TMT JABATAN FUNGSIONAL Guru</label>
                <input
                  type="text"
                  value={profile.tmtCurrentJabatan || ''}
                  onChange={e => handleMetaChange('tmtCurrentJabatan', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                  placeholder="Contoh: 24-08-2023"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">UNIT KERJA LENGKAP</label>
              <input
                type="text"
                value={profile.unitKerja || ''}
                onChange={e => handleMetaChange('unitKerja', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                placeholder="Contoh: SMAN 2 CIAMIS KABUPATEN CIAMIS CABANG..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">INSTANSI INDUK</label>
              <input
                type="text"
                value={profile.instansiBiro || ''}
                onChange={e => handleMetaChange('instansiBiro', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                placeholder="Contoh: PEMERINTAH PROVINSI JAWA BARAT"
              />
            </div>

          </div>

          {/* Section 2: Administrasi Nomer Surat */}
          <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-150 space-y-3">
            <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> 2. Nomor Surat Keputusan (PAK)
            </h4>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NOMOR SK HALAMAN 1 (KONVERSI SKP)</label>
              <input
                type="text"
                value={profile.nomorSuratKonversi || ''}
                onChange={e => handleMetaChange('nomorSuratKonversi', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                placeholder="Nomor SK"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NOMOR SK HALAMAN 2 (AKUMULASI SKP)</label>
              <input
                type="text"
                value={profile.nomorSuratAkumulasi || ''}
                onChange={e => handleMetaChange('nomorSuratAkumulasi', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                placeholder="Nomor SK"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NOMOR SK HALAMAN 3 (PENETAPAN ANGKA KREDIT)</label>
              <input
                type="text"
                value={profile.nomorSuratPenetapan || ''}
                onChange={e => handleMetaChange('nomorSuratPenetapan', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                placeholder="Nomor SK"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TEMPAT DITETAPKAN</label>
                <input
                  type="text"
                  value={profile.tempatDitetapkan || ''}
                  onChange={e => handleMetaChange('tempatDitetapkan', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TANGGAL PENETAPAN</label>
                <input
                  type="text"
                  value={profile.tanggalPenetapan || ''}
                  onChange={e => handleMetaChange('tanggalPenetapan', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                />
              </div>
            </div>

          </div>

          {/* Section 3: Pejabat Penilai Kinerja & Format TTD */}
          <div className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-150 space-y-3">
            <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> 3. Data Pejabat Penilai & Format Tanda Tangan
            </h4>

            {/* Signature Type Toggle */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">MODE TANDA TANGAN BERKAS</label>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleMetaChange('signatureType', 'tte')}
                  className={`py-1.5 px-2 rounded-md font-bold border transition-all text-center cursor-pointer ${
                    (profile.signatureType || kopSettings.signatureType || 'tte') === 'tte'
                      ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  TTE (Elektronik)
                </button>
                <button
                  type="button"
                  onClick={() => handleMetaChange('signatureType', 'ttd_basah')}
                  className={`py-1.5 px-2 rounded-md font-bold border transition-all text-center cursor-pointer ${
                    (profile.signatureType || kopSettings.signatureType) === 'ttd_basah'
                      ? 'bg-teal-600 border-teal-700 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  TTD Basah (Manual/Scan)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">STATUS JABATAN PENILAI</label>
                <select
                  value={profile.pejabatPenilaiStatus || 'definitif'}
                  onChange={e => handleMetaChange('pejabatPenilaiStatus', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-bold text-slate-700"
                >
                  <option value="definitif">DEFINITIF (Biasa)</option>
                  <option value="plt">PLT (Pelaksana Tugas)</option>
                  <option value="plh">PLH (Pelaksana Harian)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">JABATAN PEJABAT PENILAI</label>
                <input
                  type="text"
                  value={profile.pejabatPenilaiTitle || ''}
                  onChange={e => handleMetaChange('pejabatPenilaiTitle', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NAMA PEJABAT PENILAI</label>
              <input
                type="text"
                value={profile.pejabatPenilaiNama || ''}
                onChange={e => handleMetaChange('pejabatPenilaiNama', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-serif font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">PANGKAT / GOLONGAN</label>
                <input
                  type="text"
                  value={profile.pejabatPenilaiGolongan || ''}
                  onChange={e => handleMetaChange('pejabatPenilaiGolongan', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">NIP PEJABAT PENILAI</label>
                <input
                  type="text"
                  value={profile.pejabatPenilaiNip || ''}
                  onChange={e => handleMetaChange('pejabatPenilaiNip', e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">PROVINSI/WILAYAH INSTANSI</label>
              <input
                type="text"
                value={profile.pejabatPenilaiInstansi || ''}
                onChange={e => handleMetaChange('pejabatPenilaiInstansi', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
              />
            </div>

            {/* Kop & Logo Customizer */}
            <div className="pt-4 border-t border-slate-200 mt-4 space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wide">
                <Settings className="w-3.5 h-3.5 text-teal-600" /> Pengaturan Kop & Logo
              </span>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">TIPE LOGO DI KOP</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setKopSettings({ ...kopSettings, logoType: 'svg-jabar' })}
                    className={`py-1 px-1.5 rounded font-bold border transition-all text-center cursor-pointer ${
                      kopSettings.logoType === 'svg-jabar'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Logo Jawa Barat
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopSettings({ ...kopSettings, logoType: 'url' })}
                    className={`py-1 px-1.5 rounded font-bold border transition-all text-center cursor-pointer ${
                      kopSettings.logoType === 'url'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Custom URL Logo
                  </button>
                </div>
              </div>

              {kopSettings.logoType === 'url' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">IMAGE URL LOGO KOP (STAMP/BRAND)</label>
                  <input
                    type="text"
                    value={kopSettings.customLogoUrl}
                    onChange={e => setKopSettings({ ...kopSettings, customLogoUrl: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              )}

              <div className="space-y-2 select-none">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">KOP BARIS 1 (PEMERINTAH DAERAH)</label>
                  <input
                    type="text"
                    value={kopSettings.row1}
                    onChange={e => setKopSettings({ ...kopSettings, row1: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">KOP BARIS 2 (NAMA INSTANSI)</label>
                  <input
                    type="text"
                    value={kopSettings.row2}
                    onChange={e => setKopSettings({ ...kopSettings, row2: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 uppercase font-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">KOP BARIS 3 (ALAMAT & TELP)</label>
                  <input
                    type="text"
                    value={kopSettings.row3}
                    onChange={e => setKopSettings({ ...kopSettings, row3: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">KOP BARIS 4 (WEBSITE)</label>
                    <input
                      type="text"
                      value={kopSettings.row4}
                      onChange={e => setKopSettings({ ...kopSettings, row4: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">KOP BARIS 5 (EMAIL)</label>
                    <input
                      type="text"
                      value={kopSettings.row5}
                      onChange={e => setKopSettings({ ...kopSettings, row5: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">KOP BARIS 6 (WILAYAH / KODE POS)</label>
                  <input
                    type="text"
                    value={kopSettings.row6}
                    onChange={e => setKopSettings({ ...kopSettings, row6: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 uppercase font-bold"
                  />
                </div>
              </div>
            </div>

            {/* TTE Signature Specimen Customizer */}
            <div className="pt-4 border-t border-slate-200 mt-4 space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wide">
                <Edit3 className="w-3.5 h-3.5 text-teal-600" /> Pengaturan Spesimen TTE (Global)
              </span>
              <p className="text-[9px] text-slate-500 italic leading-snug">
                *Pengaturan TTE ini disimpan secara otomatis dan berlaku global untuk seluruh berkas PNS di bawah pengawasan Admin.
              </p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">TIPE LOGO SPESIMEN</label>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setKopSettings({ ...kopSettings, tteLogoType: 'default' })}
                    className={`py-1 px-1 rounded font-bold border transition-all text-center cursor-pointer ${
                      (kopSettings.tteLogoType || 'default') === 'default'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bawaan (Digital)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopSettings({ ...kopSettings, tteLogoType: 'url' })}
                    className={`py-1 px-1 rounded font-bold border transition-all text-center cursor-pointer ${
                      kopSettings.tteLogoType === 'url'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    URL Gambar
                  </button>
                  <button
                    type="button"
                    onClick={() => setKopSettings({ ...kopSettings, tteLogoType: 'upload' })}
                    className={`py-1 px-1 rounded font-bold border transition-all text-center cursor-pointer ${
                      kopSettings.tteLogoType === 'upload'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Unggah File
                  </button>
                </div>
              </div>

              {kopSettings.tteLogoType === 'url' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">IMAGE URL LOGO TTE</label>
                  <input
                    type="text"
                    value={kopSettings.tteLogoUrl || ''}
                    onChange={e => setKopSettings({ ...kopSettings, tteLogoUrl: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-mono"
                    placeholder="https://example.com/logo-tte.png"
                  />
                </div>
              )}

              {kopSettings.tteLogoType === 'upload' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">UNGGAH FILE GAMBAR LOGO (TTD ELEKTRONIK)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            if (typeof reader.result === 'string') {
                              try {
                                const compressedObj = await compressLogoImage(reader.result);
                                setKopSettings({ ...kopSettings, tteLogoBase64: compressedObj });
                              } catch (err) {
                                console.error("Error compressing image:", err);
                                setKopSettings({ ...kopSettings, tteLogoBase64: reader.result });
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs w-full text-slate-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                    />
                  </div>
                  {kopSettings.tteLogoBase64 && (
                    <div className="mt-1.5 flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded">
                      <img src={kopSettings.tteLogoBase64} className="w-8 h-8 object-contain rounded border bg-white" />
                      <span className="text-[9px] text-slate-500 truncate max-w-[200px]">Berhasil dimuat offline!</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 select-none">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">TEKS HEADER SPESIMEN</label>
                  <input
                    type="text"
                    value={kopSettings.tteTextHeader || ''}
                    onChange={e => setKopSettings({ ...kopSettings, tteTextHeader: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500"
                    placeholder="Ditandatangani secara elektronik oleh :"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-bold text-slate-500">TEKS JABATAN BARIS 1</label>
                    <span className="text-[8px] text-slate-500 font-bold uppercase italic">Mendukung Otomatis</span>
                  </div>
                  <input
                    type="text"
                    value={kopSettings.tteTextJabatan1 || ''}
                    onChange={e => setKopSettings({ ...kopSettings, tteTextJabatan1: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-bold uppercase"
                    placeholder={profile.pejabatPenilaiTitle || "KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII"}
                  />
                  <p className="text-[8px] text-slate-400 mt-0.5">Kosongkan untuk otomatis menyalin dari nama jabatan Pejabat Penilai Kinerja.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-bold text-slate-500">TEKS JABATAN BARIS 2</label>
                    <span className="text-[8px] text-slate-500 font-bold uppercase italic">Mendukung Otomatis</span>
                  </div>
                  <input
                    type="text"
                    value={kopSettings.tteTextJabatan2 || ''}
                    onChange={e => setKopSettings({ ...kopSettings, tteTextJabatan2: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:outline-teal-500 font-bold uppercase"
                    placeholder={profile.pejabatPenilaiInstansi || "PROVINSI JAWA BARAT"}
                  />
                  <p className="text-[8px] text-slate-400 mt-0.5">Kosongkan untuk otomatis menyalin dari instansi/unit-kerja Pejabat Penilai.</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          <button
            onClick={handlePrintDocument}
            className="flex justify-center items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-lg shadow-sm transition-all cursor-pointer"
            title="Buka jendela cetak resolusi asli untuk disimpan ke PDF"
          >
            <Printer className="w-4 h-4 text-amber-300" /> Cetak / Simpan PDF (F4)
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex justify-center items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-lg shadow-md transition-all cursor-pointer disabled:cursor-wait"
            title="Unduh langsung berkas PDF 3 halaman"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memproses Berkas PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>Unduh File .PDF (F4)</span>
              </>
            )}
          </button>
        </div>

        {/* Print Guidance Card */}
        <div className="bg-amber-50/85 border border-amber-250 rounded-xl p-4 space-y-2 text-amber-900 text-[11px] font-sans">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950 text-xs">Penting: Tips Cetak PDF Lancar</p>
              <ul className="list-decimal pl-4 mt-1.5 space-y-1 leading-relaxed text-amber-900 font-medium">
                <li>
                  <strong>Buka di Tab Baru</strong>: Pratinjau AI Studio berjalan di dalam bingkai aman (iframe), sehingga browser cenderung memblokir dialog cetak otomatis. Klik tombol <strong>Buka di Tab Baru (ikon panah keluar di kanan atas layar preview)</strong> terlebih dahulu.
                </li>
                <li>
                  Tekan tombol <strong>"Cetak 3 Halaman PAK Resmi"</strong> setelah aplikasi terbuka di tab penuh.
                </li>
                <li>
                  Setel tujuan ke <strong>"Simpan sebagai PDF" / "Save as PDF"</strong>.
                </li>
                <li>
                  Pilih ukuran kertas/paper size <strong>F4 / Folio</strong> (atau ukuran kustom <strong>215 mm x 330 mm / 8.5" x 13"</strong>). Jika tidak ada, gunakan opsi "Legal" dengan margin disesuaikan.
                </li>
                <li>
                  Centang opsi <strong>"Grafik Latar Belakang" (Background graphics)</strong> agar border lencana pemerintah provinsi, bayangan, dan kop resmi Jawa Barat tercetak berwarna.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Informational inside Preview Panel */}
      <div className="xl:col-span-7 space-y-4">
        <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 flex justify-between items-center print:hidden">
          <div>
            <span className="text-[10px] tracking-widest font-bold uppercase text-teal-400 block mb-0.5">Live Interactive Report preview</span>
            <h4 className="text-sm font-extrabold">Portofolio Cetakan Dinas Pendidikan Wilayah XIII Provinsi Jawa Barat</h4>
          </div>
          <div className="flex gap-2">
            <span className="bg-slate-700 text-[10px] px-2.5 py-1 rounded-full font-bold">3 Halaman Terhubung</span>
            <span className="bg-teal-600 text-[10px] px-2.5 py-1 rounded-full font-bold">F4 / Folio</span>
          </div>
        </div>

        {/* Virtual F4 Canvas Stack (7 cols) */}
        <div id="pak-print-pages" className="space-y-8 select-text pr-2 print:p-0 print:m-0 print:border-none print:shadow-none">

          {/* PAGE 1 CANVAS */}
          <div 
            id="pak-page-1"
            className="print-page bg-white font-serif w-full max-w-[215mm] mx-auto px-[15mm] pt-[16mm] pb-[14mm] select-text border border-slate-200 rounded-xl shadow-md print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none print:min-h-0 min-h-[330mm] flex flex-col justify-between page-break"
            style={{ boxSizing: "border-box", borderColor: "#f1f5f9", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", backgroundColor: "#ffffff", color: "#000000" }}
          >
            {renderGovHeader()}
            
            <div className="text-center font-serif py-1">
              <h1 className="text-[12px] font-bold leading-none tracking-widest uppercase text-black underline">KONVERSI PREDIKAT KINERJA KE ANGKA KREDIT</h1>
              <p className="font-mono text-[10px] text-black uppercase mt-0.5">NOMOR : {profile.nomorSuratKonversi || "___________________________"}</p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-black font-semibold uppercase font-serif mt-2 select-none">
              <span>Instansi : Pemerintah Provinsi Jawa Barat</span>
              <span>Periode: {formattedPeriode}</span>
            </div>

            {renderPersonalTable()}

            {/* Page 1 Centerpiece Table: "KONVERSI PREDIKAT KINERJA KE ANGKA KREDIT" */}
            <div className="text-[11px] text-black w-full border border-black font-serif my-4 leading-normal">
              <div className="bg-slate-100 font-bold text-center border-b border-black py-1.5 select-none tracking-wider text-[10px] uppercase">
                Konversi Predikat Kinerja ke Angka Kredit
              </div>
              
              <table className="w-full text-center border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-black font-bold select-none text-[9px] uppercase">
                    <th className="py-2.5 px-3 border-r border-black w-[50%] align-middle" colSpan={2}>Hasil Penilaian Kinerja</th>
                    <th className="py-2.5 px-3 border-r border-black w-[25%] align-middle" rowSpan={2}>Koefisien per tahun</th>
                    <th className="py-2.5 px-3 w-[25%] align-middle" rowSpan={2}>Angka Kredit yang didapat<br/><span className="text-[8px] font-normal font-mono normal-case">(Kolom 2 x kolom 3)</span></th>
                  </tr>
                  <tr className="bg-slate-50/50 border-b border-black font-bold select-none text-[9px] uppercase">
                    <th className="py-1.5 px-2 border-r border-black w-[25%] border-b-none align-middle">PREDIKAT</th>
                    <th className="py-1.5 px-2 border-r border-black w-[25%] border-b-none align-middle">PROSENTASE</th>
                  </tr>
                  <tr className="border-b border-black select-none text-[8.5px] font-mono font-bold bg-slate-100">
                    <td className="py-1 px-2 border-r border-black align-middle">1</td>
                    <td className="py-1 px-2 border-r border-black align-middle">2</td>
                    <td className="py-1 px-2 border-r border-black align-middle">3</td>
                    <td className="py-1 px-2 align-middle">4</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold text-center h-14">
                    <td className="py-3 px-3 border-r border-black font-bold underline align-middle">
                      {latestEval ? latestEval.rating.toUpperCase() : "BAIK"}
                    </td>
                    <td className="py-3 px-3 border-r border-black font-mono font-bold align-middle">
                      {latestEval ? (latestEval.multiplier * 100).toFixed(2).replace('.', ',') : "100,00"}%
                    </td>
                    <td className="py-3 px-3 border-r border-black font-mono font-bold text-slate-800 align-middle">
                      {latestEval ? latestEval.coefficient : "12.5"}
                    </td>
                    <td className="py-3 px-3 font-mono font-extrabold text-[12px] bg-emerald-50/20 text-emerald-950 align-middle">
                      {latestEval ? (latestEval.creditEarned).toFixed(3) : "12,500"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {renderSignatureBlock()}
            
            <span data-html2canvas-ignore="true" className="absolute bottom-2 right-4 text-[7px] text-slate-400 font-mono print:hidden">Halaman 1 dari 3</span>
          </div>

          {/* PAGE 2 CANVAS */}
          <div 
            id="pak-page-2"
            className="print-page bg-white font-serif w-full max-w-[215mm] mx-auto px-[15mm] pt-[16mm] pb-[14mm] select-text border border-slate-200 rounded-xl shadow-md print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none print:min-h-0 min-h-[330mm] flex flex-col justify-between page-break page-break-before"
            style={{ boxSizing: "border-box", borderColor: "#f1f5f9", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", backgroundColor: "#ffffff", color: "#000000" }}
          >
            {renderGovHeader()}
            
            <div className="text-center font-serif py-1">
              <h1 className="text-xs font-bold leading-none tracking-widest uppercase text-black underline">AKUMULASI ANGKA KREDIT</h1>
              <p className="font-mono text-[10px] text-black uppercase mt-0.5">NOMOR : {profile.nomorSuratAkumulasi || "___________________________"}</p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-black font-semibold uppercase font-serif mt-2 select-none">
              <span>Instansi : Pemerintah Provinsi Jawa Barat</span>
              <span>Periode: {formattedPeriode}</span>
            </div>

            {renderPersonalTable()}

            {/* Page 2 centerpiece table: Accumulation over years */}
            <div className="text-[11px] text-black w-full border border-black font-serif my-4 leading-normal">
              <div className="bg-slate-100 font-bold text-center border-b border-black py-1.5 select-none tracking-wider text-[10px] uppercase">
                Hasil Penilalan Angka Kredit
              </div>
              
              <table className="w-full text-center border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-black font-bold select-none text-[9px] uppercase">
                    <th className="py-2.5 px-2 border-r border-black w-[10%] align-middle">TAHUN</th>
                    <th className="py-2.5 px-3 border-r border-black w-[25%] align-middle">PERIODIK (BULAN)</th>
                    <th className="py-2.5 px-2 border-r border-black w-[15%] align-middle">PREDIKAT</th>
                    <th className="py-2.5 px-2 border-r border-black w-[15%] align-middle">PROSENTASE</th>
                    <th className="py-2.5 px-2 border-r border-black w-[15%] align-middle">Koefisien per tahun</th>
                    <th className="py-2.5 px-3 w-[20%] align-middle">Angka Kredit yang didapat</th>
                  </tr>
                  <tr className="border-b border-black select-none text-[8.5px] font-mono font-bold bg-slate-100">
                    <td className="py-1 px-2 border-r border-black align-middle">1</td>
                    <td className="py-1 px-2 border-r border-black align-middle">2</td>
                    <td className="py-1 px-2 border-r border-black align-middle">3</td>
                    <td className="py-1 px-2 border-r border-black align-middle">4</td>
                    <td className="py-1 px-2 border-r border-black align-middle">5</td>
                    <td className="py-1 px-2 align-middle">6</td>
                  </tr>
                </thead>
                <tbody>
                  {/* PAK Integrasi 2022 Conditional Row */}
                  {(profile.akIntegrasi2022 || 0) > 0 && (
                    <tr className="border-b border-black font-serif font-medium">
                      <td className="py-2 px-2 border-r border-black font-mono font-bold align-middle">2022</td>
                      <td className="py-2 px-3 border-r border-black leading-tight text-[9px] align-middle text-left">
                        s.d. Desember
                      </td>
                      <td className="py-2 px-2 border-r border-black font-sans font-medium text-center text-slate-500 align-middle">-</td>
                      <td className="py-2 px-2 border-r border-black font-mono text-center text-slate-500 align-middle">-</td>
                      <td className="py-2 px-2 border-r border-black font-mono text-center text-slate-500 align-middle">-</td>
                      <td className="py-2 px-3 text-right font-mono font-extrabold pr-4 text-[10.5px] align-middle">
                        {(profile.akIntegrasi2022 || 0).toFixed(3).replace('.', ',')}
                      </td>
                    </tr>
                  )}

                  {sortedEvaluationsChrono.map((item, index) => (
                    <tr key={index} className="border-b border-black font-serif font-medium">
                      <td className="py-2 px-2 border-r border-black font-mono font-bold align-middle">{item.year}</td>
                      <td className="py-2 px-3 border-r border-black leading-tight text-[9px] align-middle text-left">
                        {item.notes || (item.period === 'Tahunan' ? 'Januari s.d Desember' : item.period)}
                      </td>
                      <td className="py-2 px-2 border-r border-black font-bold align-middle">{item.rating}</td>
                      <td className="py-2 px-2 border-r border-black font-mono align-middle">{(item.multiplier * 100).toFixed(0)}%</td>
                      <td className="py-2 px-2 border-r border-black font-mono align-middle">{item.coefficient}</td>
                      <td className="py-2 px-3 text-right font-mono font-extrabold pr-4 text-[10.5px] align-middle">
                        {item.creditEarned.toFixed(3).replace('.', ',')}
                      </td>
                    </tr>
                  ))}
                  
                  {sortedEvaluationsChrono.length === 0 && (
                    <tr className="border-b border-black">
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-sans italic align-middle">
                        Belum ada evaluasi SKP tercatat untuk riwayat ini.
                      </td>
                    </tr>
                  )}

                  {/* Total merged row */}
                  <tr className="bg-slate-100 font-bold font-serif text-[10px]">
                    <td className="py-2.5 px-3 border-r border-black uppercase text-left pl-4 align-middle" colSpan={5}>
                      JUMLAH ANGKA KREDIT YANG DIPEROLEH
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black pr-4 text-[11.5px] bg-emerald-50/20 text-emerald-950 align-middle">
                      {totalKonversi.toFixed(3).replace('.', ',')}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            {renderSignatureBlock()}
            
            <span data-html2canvas-ignore="true" className="absolute bottom-2 right-4 text-[7px] text-slate-400 font-mono print:hidden">Halaman 2 dari 3</span>
          </div>

          {/* PAGE 3 CANVAS */}
          <div 
            id="pak-page-3"
            className="print-page bg-white font-serif w-full max-w-[215mm] mx-auto px-[15mm] pt-[16mm] pb-[14mm] select-text border border-slate-200 rounded-xl shadow-md print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none print:min-h-0 min-h-[330mm] flex flex-col justify-between page-break page-break-before"
            style={{ boxSizing: "border-box", borderColor: "#f1f5f9", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", backgroundColor: "#ffffff", color: "#000000" }}
          >
            {renderGovHeader()}
            
            <div className="text-center font-serif py-1">
              <h1 className="text-xs font-bold leading-none tracking-widest uppercase text-black underline">PENETAPAN ANGKA KREDIT</h1>
              <p className="font-mono text-[10px] text-black uppercase mt-0.5">NOMOR : {profile.nomorSuratPenetapan || "___________________________"}</p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-black font-semibold uppercase font-serif mt-2 select-none">
              <span>Instansi : Pemerintah Provinsi Jawa Barat</span>
              <span>Periode: {formattedPeriode}</span>
            </div>

            {/* Personal Details Table */}
            {renderPersonalTable()}

            {/* Section II: "PENETAPAN ANGKA KREDIT" table */}
            <div className="text-[11px] text-black w-full border border-black font-serif my-2 leading-normal">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black text-center text-[9px] uppercase">
                    <th className="py-1.5 px-2 w-[4%] border-r border-black select-none align-middle">II</th>
                    <th className="py-1.5 px-3 w-[36%] border-r border-black text-left align-middle">PENETAPAN ANGKA KREDIT</th>
                    <th className="py-1.5 px-2 w-[15%] border-r border-black align-middle">LAMA</th>
                    <th className="py-1.5 px-2 w-[15%] border-r border-black align-middle">BARU</th>
                    <th className="py-1.5 px-2 w-[15%] border-r border-black align-middle">JUMLAH</th>
                    <th className="py-1.5 px-2 w-[15%] align-middle">KETERANGAN</th>
                  </tr>
                  <tr className="border-b border-black select-none text-[8px] font-mono font-bold bg-slate-150 text-center">
                    <td className="py-1 px-1 border-r border-black align-middle">1</td>
                    <td className="py-1 px-2 border-r border-black text-left align-middle">2</td>
                    <td className="py-1 px-1 border-r border-black align-middle">3</td>
                    <td className="py-1 px-1 border-r border-black align-middle">4</td>
                    <td className="py-1 px-1 border-r border-black align-middle">5</td>
                    <td className="py-1 px-1 align-middle">6</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black text-slate-500 font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center align-middle">1</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] text-slate-800 align-middle">AK DASAR YANG DIBERIKAN</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>
                  <tr className="border-b border-black text-slate-500 font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center align-middle">2</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] text-slate-800 align-middle">AK JF LAMA</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>
                  <tr className="border-b border-black text-slate-500 font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center align-middle">3</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] text-slate-800 align-middle">AK PENYESUAIAN / PENYETARAAN</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>
                  <tr className="border-b border-black font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center text-slate-500 align-middle">4</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] font-bold text-slate-800 align-middle">AK KONVERSI</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 text-[11px] align-middle">{konversiLama.toFixed(3).replace('.', ',')}</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 font-semibold text-[11px] align-middle">{konversiBaru.toFixed(3).replace('.', ',')}</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 font-bold text-[11px] align-middle">{konversiJumlah.toFixed(3).replace('.', ',')}</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>
                  <tr className="border-b border-black font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center text-slate-500 align-middle">5</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] text-slate-800 align-middle">AK YANG DIPEROLEH DARI PENINGKATAN PENDIDIKAN</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 text-[11px] align-middle">{pendidikanLama > 0 ? pendidikanLama.toFixed(3).replace('.', ',') : "-"}</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 font-semibold text-[11px] align-middle">{pendidikanBaru > 0 ? pendidikanBaru.toFixed(3).replace('.', ',') : "-"}</td>
                    <td className="py-1 px-3 border-r border-black text-right pr-3 font-semibold text-[11px] align-middle">{pendidikanJumlah > 0 ? pendidikanJumlah.toFixed(3).replace('.', ',') : "-"}</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>
                  <tr className="border-b border-black text-slate-500 font-mono text-[11px]">
                    <td className="py-1 px-2 border-r border-black text-center align-middle">6</td>
                    <td className="py-1 px-3 border-r border-black font-serif text-[11px] text-slate-800 align-middle">AK YANG DIPEROLEH DARI KENAIKAN PANGKAT LUAR BIASA</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 border-r border-black text-center align-middle">-</td>
                    <td className="py-1 px-2 align-middle"></td>
                  </tr>

                  {/* Cumulatives Grand Total */}
                  <tr className="bg-slate-100 font-bold font-serif text-[10px] uppercase">
                    <td className="py-2 px-3 border-r border-black text-left pl-6 align-middle" colSpan={2}>
                      JUMLAH ANGKA KREDIT KUMULATIF
                    </td>
                    <td className="py-2 px-3 border-r border-black text-right pr-3 font-mono font-bold text-[10.5px] align-middle">
                      {accumLama.toFixed(3).replace('.', ',')}
                    </td>
                    <td className="py-2 px-3 border-r border-black text-right pr-3 font-mono font-bold text-[10.5px] align-middle">
                      {accumBaru.toFixed(3).replace('.', ',')}
                    </td>
                    <td className="py-2 px-3 border-r border-black text-right pr-3 font-mono font-black text-[12px] bg-emerald-50/20 text-emerald-950 align-middle">
                      {accumJumlah.toFixed(3).replace('.', ',')}
                    </td>
                    <td className="py-2 px-2 align-middle"></td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* Lower Grid Panel: Minimun & Deficit Calculation block */}
            <div className="border border-black text-[10px] text-black w-full font-serif my-1.5 leading-tight font-medium">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black text-center text-[9px]">
                    <th className="py-1.5 px-2.5 w-[46%] border-r border-black uppercase text-left align-middle">KETERANGAN</th>
                    <th className="py-1.5 px-2 w-[27%] border-r border-black uppercase align-middle">PANGKAT</th>
                    <th className="py-1.5 px-2 w-[27%] uppercase align-middle">JENJANG JABATAN</th>
                  </tr>
                </thead>
                <tbody>
                   <tr className="border-b border-black text-center">
                    <td className="py-1.5 px-2.5 text-left font-semibold border-r border-black align-middle">ANGKA KREDIT MINIMAL YANG HARUS DIPENUHI UNTUK KENAIKAN PANGKAT/ JENJANG</td>
                    <td className="py-1.5 px-2 border-r border-black font-mono font-bold text-[10.5px] align-middle">
                      {minimalPangkat > 0 ? minimalPangkat.toFixed(3).replace('.', ',') : "-"}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-bold text-[10.5px] align-middle">
                      {minimalJenjang > 0 ? minimalJenjang.toFixed(3).replace('.', ',') : "-"}
                    </td>
                  </tr>
                  <tr className="border-b border-black text-center">
                    <td className="py-1.5 px-2.5 text-left font-semibold border-r border-black uppercase text-[9px] align-middle">
                      {minimalPangkat > 0 && isPangkatSurplus
                        ? "KELEBIHAN ANGKA KREDIT YANG DICAPAI UNTUK KENAIKAN PANGKAT"
                        : "KEKURANGAN ANGKA KREDIT YANG HARUS DICAPAI UNTUK KENAIKAN PANGKAT"}
                    </td>
                    <td className={`py-1.5 px-2 border-r border-black font-mono font-extrabold text-[10.5px] align-middle ${
                      isPangkatSurplus ? "bg-emerald-50/10 text-emerald-900" : "bg-amber-55/10 text-amber-900"
                    }`}>
                      {minimalPangkat > 0 ? pangkatDiffValue.toFixed(3).replace('.', ',') : "-"}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-slate-400 align-middle">-</td>
                  </tr>
                  <tr className="border-b border-black text-center">
                    <td className="py-1.5 px-2.5 text-left font-semibold border-r border-black uppercase text-[9px] align-middle">
                       {minimalJenjang > 0 && isJenjangSurplus 
                        ? "KELEBIHAN ANGKA KREDIT YANG DICAPAI UNTUK KENAIKAN JENJANG" 
                        : "KEKURANGAN ANGKA KREDIT YANG HARUS DICAPAI UNTUK KENAIKAN JENJANG"}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-slate-400 align-middle">-</td>
                    <td className={`py-1.5 px-2 font-mono font-extrabold text-[10.5px] align-middle ${
                      isJenjangSurplus ? "bg-emerald-50/10 text-emerald-900" : "bg-amber-55/10 text-amber-900"
                    }`}>
                      {minimalJenjang > 0 ? jenjangDiffValue.toFixed(3).replace('.', ',') : "-"}
                    </td>
                  </tr>
                  {/* Eligibility final visual status line inside Page 3 table */}
                  <tr className="bg-slate-50 uppercase text-[9.5px] font-bold">
                    <td className="py-2 px-3 text-left font-serif leading-snug align-middle" colSpan={3}>
                      {recommendationText}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {renderSignatureBlock()}
            
            <span data-html2canvas-ignore="true" className="absolute bottom-2 right-4 text-[7px] text-slate-400 font-mono print:hidden">Halaman 3 dari 3</span>
          </div>

        </div>
      </div>

    </div>
  );
}
