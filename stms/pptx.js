/**
 * ============================================================================
 * STMS PPTX Viewer Engine (pptx.js)
 * High-Fidelity Client-Side PowerPoint OpenXML (.pptx) Parser & Renderer
 * For KTPTTC Smart Training Management System
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Constants & Metrics
  const EMU_PER_INCH = 914400;
  const EMU_PER_PT = 12700;
  const DEFAULT_WIDTH_EMU = 9144000;  // 10 inches (16:9 widescreen default)
  const DEFAULT_HEIGHT_EMU = 5143500; // 5.625 inches (16:9 widescreen default)

  // Default theme color fallback (Office 2013-2024 standard)
  const DEFAULT_THEME_COLORS = {
    dk1: '#000000',
    lt1: '#ffffff',
    dk2: '#1f497d',
    lt2: '#eeece1',
    accent1: '#4f81bd',
    accent2: '#c0504d',
    accent3: '#9bbb59',
    accent4: '#8064a2',
    accent5: '#4bacc6',
    accent6: '#f79646',
    hlink: '#0000ff',
    folHlink: '#800080',
    tx1: '#000000',
    tx2: '#1f497d',
    bg1: '#ffffff',
    bg2: '#eeece1'
  };

  /**
   * Safe HTML Escaper
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Parse XML string into DOM Document
   */
  function parseXmlDoc(xmlStr) {
    if (!xmlStr) return null;
    try {
      const parser = new DOMParser();
      return parser.parseFromString(xmlStr, 'application/xml');
    } catch (e) {
      console.warn('PPTXViewer: XML parse error', e);
      return null;
    }
  }

  /**
   * Convert various input data types to Uint8Array for JSZip
   */
  function toUint8Array(data) {
    if (!data) return null;
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof data === 'string') {
      let b64 = data;
      if (data.includes('base64,')) {
        b64 = data.split('base64,')[1];
      }
      try {
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
      } catch (e) {
        console.warn('PPTXViewer: base64 decode failed', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Normalize zip file path resolution
   */
  function normalizeZipPath(baseDir, relativePath) {
    if (!relativePath) return '';
    if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
    const combined = baseDir ? baseDir + '/' + relativePath : relativePath;
    const parts = combined.split('/');
    const stack = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') {
        if (stack.length > 0) stack.pop();
      } else {
        stack.push(p);
      }
    }
    return stack.join('/');
  }

  /**
   * Color conversion & transformation helpers
   */
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = (n) => {
      const h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function applyColorMods(baseHex, colorNode) {
    if (!baseHex || !colorNode) return baseHex;
    let { r, g, b } = hexToRgb(baseHex);
    let alpha = 1.0;

    // 1. Tint (mix with white)
    const tintEl = colorNode.querySelector('tint');
    if (tintEl) {
      const tintVal = parseInt(tintEl.getAttribute('val') || '100000', 10) / 100000;
      r = r * tintVal + 255 * (1 - tintVal);
      g = g * tintVal + 255 * (1 - tintVal);
      b = b * tintVal + 255 * (1 - tintVal);
    }

    // 2. Shade (mix with black)
    const shadeEl = colorNode.querySelector('shade');
    if (shadeEl) {
      const shadeVal = parseInt(shadeEl.getAttribute('val') || '100000', 10) / 100000;
      r = r * shadeVal;
      g = g * shadeVal;
      b = b * shadeVal;
    }

    // 3. Luminance Modulation & Offset
    const lumModEl = colorNode.querySelector('lumMod');
    const lumOffEl = colorNode.querySelector('lumOff');
    if (lumModEl || lumOffEl) {
      const mod = lumModEl ? parseInt(lumModEl.getAttribute('val') || '100000', 10) / 100000 : 1;
      const off = lumOffEl ? parseInt(lumOffEl.getAttribute('val') || '0', 10) / 100000 : 0;
      r = Math.min(255, r * mod + 255 * off);
      g = Math.min(255, g * mod + 255 * off);
      b = Math.min(255, b * mod + 255 * off);
    }

    // 4. Alpha / Opacity
    const alphaEl = colorNode.querySelector('alpha');
    if (alphaEl) {
      alpha = parseInt(alphaEl.getAttribute('val') || '100000', 10) / 100000;
    }

    if (alpha < 1.0) {
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(2)})`;
    }
    return rgbToHex(r, g, b);
  }

  /**
   * Resolve any color node (srgbClr, schemeClr, sysClr, prstClr)
   */
  function resolveColor(parentContainer, themeColors) {
    if (!parentContainer) return null;
    themeColors = themeColors || DEFAULT_THEME_COLORS;

    // Direct solidFill or color wrapper
    const solidFill = parentContainer.querySelector('solidFill') || parentContainer;

    // 1. srgbClr
    const srgb = solidFill.querySelector('srgbClr');
    if (srgb) {
      const val = srgb.getAttribute('val');
      if (val) return applyColorMods('#' + val, srgb);
    }

    // 2. schemeClr
    const scheme = solidFill.querySelector('schemeClr');
    if (scheme) {
      const val = scheme.getAttribute('val');
      const base = themeColors[val] || DEFAULT_THEME_COLORS[val] || '#0284c7';
      return applyColorMods(base, scheme);
    }

    // 3. sysClr
    const sys = solidFill.querySelector('sysClr');
    if (sys) {
      const lastClr = sys.getAttribute('lastClr');
      if (lastClr) return applyColorMods('#' + lastClr, sys);
      const val = sys.getAttribute('val');
      if (val === 'windowText') return '#000000';
      if (val === 'window') return '#ffffff';
      return '#333333';
    }

    // 4. prstClr
    const prst = solidFill.querySelector('prstClr');
    if (prst) {
      const val = prst.getAttribute('val');
      const prstMap = {
        white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
        blue: '#0000ff', yellow: '#ffff00', gray: '#808080'
      };
      if (prstMap[val]) return prstMap[val];
    }

    return null;
  }

  /**
   * Parse Theme Colors from ppt/theme/theme1.xml
   */
  async function parseThemeColors(zip) {
    const colors = Object.assign({}, DEFAULT_THEME_COLORS);
    const themeFiles = Object.keys(zip.files).filter(k => /^ppt\/theme\/theme\d+\.xml$/i.test(k));
    if (themeFiles.length === 0) return colors;

    try {
      const xmlStr = await zip.files[themeFiles[0]].async('string');
      const doc = parseXmlDoc(xmlStr);
      if (!doc) return colors;

      const clrScheme = doc.querySelector('clrScheme');
      if (clrScheme) {
        const mapping = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
        for (const key of mapping) {
          const el = clrScheme.querySelector(key);
          if (el) {
            const srgb = el.querySelector('srgbClr');
            const sys = el.querySelector('sysClr');
            if (srgb && srgb.getAttribute('val')) {
              colors[key] = '#' + srgb.getAttribute('val');
            } else if (sys && sys.getAttribute('lastClr')) {
              colors[key] = '#' + sys.getAttribute('lastClr');
            }
          }
        }
      }
    } catch (e) {
      console.warn('PPTXViewer: Error parsing theme colors', e);
    }

    colors.tx1 = colors.dk1 || '#000000';
    colors.tx2 = colors.dk2 || '#1f497d';
    colors.bg1 = colors.lt1 || '#ffffff';
    colors.bg2 = colors.lt2 || '#eeece1';

    return colors;
  }

  /**
   * Parse slide relationships (_rels/slideN.xml.rels) and preload images
   */
  async function parseSlideRels(zip, slidePath) {
    const rels = {};
    const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/'));
    const slideFile = slidePath.substring(slidePath.lastIndexOf('/') + 1);
    const relsPath = `${slideDir}/_rels/${slideFile}.rels`;

    if (!zip.files[relsPath]) return rels;

    try {
      const relsXml = await zip.files[relsPath].async('string');
      const doc = parseXmlDoc(relsXml);
      if (!doc) return rels;

      const relEls = doc.querySelectorAll('Relationship');
      for (const rel of Array.from(relEls)) {
        const id = rel.getAttribute('Id');
        const type = rel.getAttribute('Type') || '';
        const target = rel.getAttribute('Target') || '';
        if (!id || !target) continue;

        if (type.includes('relationships/image')) {
          const mediaPath = normalizeZipPath(slideDir, target);
          if (zip.files[mediaPath]) {
            try {
              const b64 = await zip.files[mediaPath].async('base64');
              const ext = mediaPath.split('.').pop().toLowerCase();
              let mime = 'image/png';
              if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
              else if (ext === 'gif') mime = 'image/gif';
              else if (ext === 'svg') mime = 'image/svg+xml';
              else if (ext === 'webp') mime = 'image/webp';
              rels[id] = {
                type: 'image',
                dataUrl: `data:${mime};base64,${b64}`,
                target: target
              };
            } catch (e) {
              console.warn(`PPTXViewer: Error extracting media ${mediaPath}`, e);
            }
          }
        } else {
          rels[id] = { type: 'other', target: target };
        }
      }
    } catch (e) {
      console.warn(`PPTXViewer: Error parsing rels for ${slidePath}`, e);
    }

    return rels;
  }

  /**
   * Parse Slide Background
   */
  function parseSlideBackground(doc, rels, themeColors) {
    const bgResult = {
      css: themeColors.bg1 || '#ffffff',
      color: themeColors.bg1 || '#ffffff',
      gradient: null,
      image: null
    };

    if (!doc) return bgResult;

    const bgEl = doc.querySelector('bg, p\\:bg');
    if (!bgEl) return bgResult;

    // 1. Solid fill
    const solidClr = resolveColor(bgEl, themeColors);
    if (solidClr) {
      bgResult.css = solidClr;
      bgResult.color = solidClr;
      return bgResult;
    }

    // 2. Gradient fill
    const gradFill = bgEl.querySelector('gradFill');
    if (gradFill) {
      const gsList = gradFill.querySelectorAll('gs');
      const stops = [];
      gsList.forEach(gs => {
        const pos = parseInt(gs.getAttribute('pos') || '0', 10) / 1000; // in %
        const clr = resolveColor(gs, themeColors) || '#ffffff';
        stops.push(`${clr} ${pos}%`);
      });
      if (stops.length > 0) {
        const lin = gradFill.querySelector('lin');
        const ang = lin ? (parseInt(lin.getAttribute('ang') || '5400000', 10) / 60000) : 90;
        const cssGrad = `linear-gradient(${ang}deg, ${stops.join(', ')})`;
        bgResult.css = cssGrad;
        bgResult.gradient = cssGrad;
        return bgResult;
      }
    }

    // 3. Image background (blipFill)
    const blip = bgEl.querySelector('blip');
    if (blip) {
      const rId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
      if (rId && rels[rId] && rels[rId].dataUrl) {
        bgResult.css = `url("${rels[rId].dataUrl}") center/cover no-repeat`;
        bgResult.image = rels[rId].dataUrl;
        return bgResult;
      }
    }

    return bgResult;
  }

  /**
   * Parse Transform Coordinates (xfrm -> off & ext)
   */
  function parseTransform(xfrmEl, slideW, slideH) {
    if (!xfrmEl) return null;
    const off = xfrmEl.querySelector('off');
    const ext = xfrmEl.querySelector('ext');
    if (!off || !ext) return null;

    const x = parseInt(off.getAttribute('x') || '0', 10);
    const y = parseInt(off.getAttribute('y') || '0', 10);
    const cx = parseInt(ext.getAttribute('cx') || '0', 10);
    const cy = parseInt(ext.getAttribute('cy') || '0', 10);

    const rotAttr = xfrmEl.getAttribute('rot');
    const rot = rotAttr ? (parseInt(rotAttr, 10) / 60000) : 0;
    const flipH = xfrmEl.getAttribute('flipH') === '1';
    const flipV = xfrmEl.getAttribute('flipV') === '1';

    return {
      x, y, cx, cy,
      left: Math.max(0, (x / slideW) * 100),
      top: Math.max(0, (y / slideH) * 100),
      width: Math.min(100, (cx / slideW) * 100),
      height: Math.min(100, (cy / slideH) * 100),
      rot, flipH, flipV
    };
  }

  /**
   * Parse Shape Geometry & Style
   */
  function parseShapeVisual(spPrEl, themeColors) {
    const style = {
      bgColor: null,
      borderColor: null,
      borderWidth: 0,
      borderStyle: 'none',
      borderRadius: '0px',
      boxShadow: 'none'
    };

    if (!spPrEl) return style;

    // Fill
    const solidClr = resolveColor(spPrEl, themeColors);
    if (solidClr) {
      style.bgColor = solidClr;
    }

    // Geometry
    const prstGeom = spPrEl.querySelector('prstGeom');
    if (prstGeom) {
      const geomType = prstGeom.getAttribute('prst');
      if (geomType === 'roundRect') {
        style.borderRadius = '10px';
      } else if (geomType === 'ellipse') {
        style.borderRadius = '50%';
      }
    }

    // Border line
    const ln = spPrEl.querySelector('ln');
    if (ln) {
      const w = parseInt(ln.getAttribute('w') || '12700', 10);
      style.borderWidth = Math.max(1, Math.round(w / EMU_PER_PT));
      const lnClr = resolveColor(ln, themeColors);
      style.borderColor = lnClr || '#94a3b8';
      style.borderStyle = 'solid';
    }

    return style;
  }

  /**
   * Parse Text Body (<p:txBody>)
   */
  function parseTextBody(txBodyEl, themeColors, slideW, slideH) {
    if (!txBodyEl) return null;

    const bodyPr = txBodyEl.querySelector('bodyPr');
    let vAlign = 'flex-start';
    if (bodyPr) {
      const anchor = bodyPr.getAttribute('anchor');
      if (anchor === 'ctr') vAlign = 'center';
      else if (anchor === 'b') vAlign = 'flex-end';
    }

    const pNodes = txBodyEl.querySelectorAll('p');
    const paragraphs = [];

    pNodes.forEach((pNode, pIdx) => {
      const pPr = pNode.querySelector('pPr');
      let align = 'left';
      let lvl = 0;
      let isBullet = false;
      let bulletChar = '•';

      if (pPr) {
        const algn = pPr.getAttribute('algn');
        if (algn === 'ctr') align = 'center';
        else if (algn === 'r') align = 'right';
        else if (algn === 'just') align = 'justify';

        lvl = parseInt(pPr.getAttribute('lvl') || '0', 10);

        const buChar = pPr.querySelector('buChar');
        const buAuto = pPr.querySelector('buAutoNum');
        const buNone = pPr.querySelector('buNone');

        if (buNone) {
          isBullet = false;
        } else if (buChar) {
          isBullet = true;
          bulletChar = buChar.getAttribute('char') || '•';
        } else if (buAuto) {
          isBullet = true;
          bulletChar = `${pIdx + 1}.`;
        } else if (lvl > 0) {
          isBullet = true;
        }
      }

      // Runs inside paragraph
      const runs = [];
      const childNodes = Array.from(pNode.children);

      childNodes.forEach(child => {
        const tagName = child.tagName.toLowerCase();
        if (tagName.endsWith('r')) {
          const rPr = child.querySelector('rPr');
          let szPt = 18;
          let bold = false;
          let italic = false;
          let underline = false;
          let strike = false;
          let color = themeColors.tx1 || '#1e293b';
          let fontFamily = 'var(--font-khmer, "Khmer OS Battambang", "Segoe UI", sans-serif)';

          if (rPr) {
            const szAttr = rPr.getAttribute('sz');
            if (szAttr) szPt = parseInt(szAttr, 10) / 100;
            bold = rPr.getAttribute('b') === '1';
            italic = rPr.getAttribute('i') === '1';
            underline = rPr.getAttribute('u') === 'sng';
            strike = rPr.getAttribute('strike') === 'sngStrike';

            const clr = resolveColor(rPr, themeColors);
            if (clr) color = clr;

            const latin = rPr.querySelector('latin');
            const cs = rPr.querySelector('cs');
            const ea = rPr.querySelector('ea');
            const fontName = (latin && latin.getAttribute('typeface')) ||
                             (cs && cs.getAttribute('typeface')) ||
                             (ea && ea.getAttribute('typeface'));
            if (fontName) {
              fontFamily = `"${fontName}", var(--font-khmer, "Khmer OS Battambang", "Segoe UI", sans-serif)`;
            }
          }

          const tEl = child.querySelector('t');
          const text = tEl ? tEl.textContent : '';

          if (text) {
            runs.push({
              text,
              szPt,
              bold,
              italic,
              underline,
              strike,
              color,
              fontFamily
            });
          }
        } else if (tagName.endsWith('br')) {
          runs.push({ isBr: true });
        }
      });

      if (runs.length > 0) {
        paragraphs.push({
          align,
          lvl,
          isBullet,
          bulletChar,
          runs
        });
      }
    });

    return {
      vAlign,
      paragraphs
    };
  }

  /**
   * Parse Tables (<a:tbl>)
   */
  function parseTable(graphicFrameEl, themeColors, slideW, slideH) {
    const tbl = graphicFrameEl.querySelector('tbl');
    if (!tbl) return null;

    const xfrm = graphicFrameEl.querySelector('xfrm');
    const transform = parseTransform(xfrm, slideW, slideH);
    if (!transform) return null;

    // Grid columns
    const gridCols = tbl.querySelectorAll('gridCol');
    let totalGridWidth = 0;
    const colWidths = [];
    gridCols.forEach(gc => {
      const w = parseInt(gc.getAttribute('w') || '0', 10);
      colWidths.push(w);
      totalGridWidth += w;
    });

    const columns = colWidths.map(w => ({
      widthPercent: totalGridWidth > 0 ? (w / totalGridWidth) * 100 : (100 / colWidths.length)
    }));

    // Rows and cells
    const trEls = tbl.querySelectorAll('tr');
    const rows = [];

    trEls.forEach(trEl => {
      const tcEls = trEl.querySelectorAll('tc');
      const cells = [];

      tcEls.forEach(tcEl => {
        const tcPr = tcEl.querySelector('tcPr');
        let bgColor = null;
        if (tcPr) {
          bgColor = resolveColor(tcPr, themeColors);
        }

        const txBody = tcEl.querySelector('txBody');
        const textData = txBody ? parseTextBody(txBody, themeColors, slideW, slideH) : null;

        cells.push({
          bgColor,
          textData
        });
      });

      rows.push({ cells });
    });

    return {
      type: 'table',
      transform,
      columns,
      rows
    };
  }

  /**
   * Parse Picture (<p:pic>)
   */
  function parsePicture(picEl, rels, slideW, slideH) {
    const xfrm = picEl.querySelector('spPr xfrm, xfrm');
    const transform = parseTransform(xfrm, slideW, slideH);
    if (!transform) return null;

    const blip = picEl.querySelector('blip');
    if (!blip) return null;

    const rId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
    if (!rId || !rels[rId] || !rels[rId].dataUrl) return null;

    return {
      type: 'picture',
      transform,
      dataUrl: rels[rId].dataUrl
    };
  }

  /**
   * Parse Shape (<p:sp>)
   */
  function parseShape(spEl, themeColors, slideW, slideH) {
    const spPr = spEl.querySelector('spPr');
    const xfrm = spPr ? spPr.querySelector('xfrm') : spEl.querySelector('xfrm');
    const transform = parseTransform(xfrm, slideW, slideH);
    if (!transform) return null;

    const visual = parseShapeVisual(spPr, themeColors);
    const txBody = spEl.querySelector('txBody');
    const textData = txBody ? parseTextBody(txBody, themeColors, slideW, slideH) : null;

    // Check placeholder type (title, subtitle, body)
    let phType = 'body';
    const ph = spEl.querySelector('nvSpPr ph');
    if (ph) {
      phType = ph.getAttribute('type') || 'body';
    }

    return {
      type: 'shape',
      phType,
      transform,
      visual,
      textData
    };
  }

  /**
   * Parse Speaker Notes for a slide
   */
  async function parseNotes(zip, slideNum) {
    const noteFiles = [
      `ppt/notesSlides/notesSlide${slideNum}.xml`,
      `ppt/notesSlides/notesslide${slideNum}.xml`
    ];
    for (const nf of noteFiles) {
      if (zip.files[nf]) {
        try {
          const xmlStr = await zip.files[nf].async('string');
          const doc = parseXmlDoc(xmlStr);
          if (doc) {
            const tEls = doc.querySelectorAll('t');
            const texts = [];
            tEls.forEach(t => {
              const str = (t.textContent || '').trim();
              if (str && !str.includes(String(slideNum))) {
                texts.push(str);
              }
            });
            if (texts.length > 0) return texts.join(' ');
          }
        } catch (e) {}
      }
    }
    return '';
  }

  /**
   * Main PPTX Parsing Engine
   * @param {ArrayBuffer|Uint8Array|string} fileData - The raw PPTX data
   * @param {Object} options - Custom options (lesson, title, etc.)
   * @returns {Promise<Array<Object>>} Array of parsed slide objects
   */
  async function parse(fileData, options) {
    options = options || {};
    if (!window.JSZip) {
      throw new Error('JSZip library is required but not loaded.');
    }

    const rawBytes = toUint8Array(fileData);
    if (!rawBytes) {
      throw new Error('Could not convert input data into byte array.');
    }

    const zip = await window.JSZip.loadAsync(rawBytes);

    // 1. Presentation Dimensions from ppt/presentation.xml
    let slideW = DEFAULT_WIDTH_EMU;
    let slideH = DEFAULT_HEIGHT_EMU;
    let slideOrder = [];

    if (zip.files['ppt/presentation.xml']) {
      try {
        const presXml = await zip.files['ppt/presentation.xml'].async('string');
        const presDoc = parseXmlDoc(presXml);
        if (presDoc) {
          const sldSz = presDoc.querySelector('sldSz');
          if (sldSz) {
            slideW = parseInt(sldSz.getAttribute('cx') || String(DEFAULT_WIDTH_EMU), 10);
            slideH = parseInt(sldSz.getAttribute('cy') || String(DEFAULT_HEIGHT_EMU), 10);
          }

          // Slide order mapping via relationships
          const sldIdEls = presDoc.querySelectorAll('sldId');
          const rIds = Array.from(sldIdEls).map(el => el.getAttribute('r:id') || el.getAttribute('id'));

          if (zip.files['ppt/_rels/presentation.xml.rels']) {
            const presRelsXml = await zip.files['ppt/_rels/presentation.xml.rels'].async('string');
            const presRelsDoc = parseXmlDoc(presRelsXml);
            if (presRelsDoc) {
              const relEls = presRelsDoc.querySelectorAll('Relationship');
              const relMap = {};
              relEls.forEach(r => {
                relMap[r.getAttribute('Id')] = r.getAttribute('Target');
              });
              rIds.forEach(rid => {
                if (relMap[rid]) {
                  slideOrder.push('ppt/' + relMap[rid].replace(/^\.\.\//, '').replace(/^\//, ''));
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn('PPTXViewer: Error parsing presentation.xml', e);
      }
    }

    // Fallback slide order if presentation.xml did not yield slides
    if (slideOrder.length === 0) {
      const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k));
      slideOrder = slideFiles.sort((a, b) => {
        const na = parseInt((a.match(/slide(\d+)\.xml/i) || [0, 0])[1], 10);
        const nb = parseInt((b.match(/slide(\d+)\.xml/i) || [0, 0])[1], 10);
        return na - nb;
      });
    }

    if (slideOrder.length === 0) {
      throw new Error('No slide XML files found inside this PPTX archive.');
    }

    // 2. Parse Theme Colors
    const themeColors = await parseThemeColors(zip);
    const aspectRatio = slideW / slideH;

    // 3. Parse Each Slide
    const parsedSlides = [];

    for (let i = 0; i < slideOrder.length; i++) {
      const slidePath = slideOrder[i];
      if (!zip.files[slidePath]) continue;

      const slideNum = i + 1;
      const slideXml = await zip.files[slidePath].async('string');
      const doc = parseXmlDoc(slideXml);
      if (!doc) continue;

      // Relationships & Media
      const rels = await parseSlideRels(zip, slidePath);

      // Background
      const background = parseSlideBackground(doc, rels, themeColors);

      // Elements extraction (Shapes, Pictures, Tables)
      const elements = [];
      const rawTextParts = [];
      let detectedTitle = '';
      let detectedSubtitle = '';

      // SpTree traversal
      const spTree = doc.querySelector('spTree');
      if (spTree) {
        const childNodes = Array.from(spTree.children);
        for (const child of childNodes) {
          const tag = child.tagName.toLowerCase();

          if (tag.endsWith('sp')) {
            const shapeObj = parseShape(child, themeColors, slideW, slideH);
            if (shapeObj) {
              elements.push(shapeObj);
              if (shapeObj.textData && shapeObj.textData.paragraphs) {
                const textStr = shapeObj.textData.paragraphs.map(p => p.runs.map(r => r.text || '').join('')).join(' ');
                if (textStr) {
                  rawTextParts.push(textStr);
                  if (shapeObj.phType === 'title' || shapeObj.phType === 'ctrTitle') {
                    if (!detectedTitle) detectedTitle = textStr;
                  } else if (shapeObj.phType === 'subTitle') {
                    if (!detectedSubtitle) detectedSubtitle = textStr;
                  }
                }
              }
            }
          } else if (tag.endsWith('pic')) {
            const picObj = parsePicture(child, rels, slideW, slideH);
            if (picObj) elements.push(picObj);
          } else if (tag.endsWith('graphicframe')) {
            const tblObj = parseTable(child, themeColors, slideW, slideH);
            if (tblObj) elements.push(tblObj);
          }
        }
      }

      // Title fallbacks
      if (!detectedTitle && rawTextParts.length > 0) {
        detectedTitle = rawTextParts[0];
      }
      if (!detectedSubtitle && rawTextParts.length > 1) {
        detectedSubtitle = rawTextParts[1];
      }

      // Speaker Notes
      const note = await parseNotes(zip, slideNum);

      parsedSlides.push({
        type: 'pptx_rendered',
        slideNum,
        badge: `ស្លាយទី ${slideNum}`,
        title: detectedTitle || `ស្លាយទី ${slideNum}`,
        subtitle: detectedSubtitle || (options.lesson ? `${options.lesson.subjectCode || ''} • ${options.lesson.chapter || ''}` : ''),
        width: slideW,
        height: slideH,
        aspectRatio: aspectRatio,
        background: background,
        elements: elements,
        note: note || (options.lesson ? `ស្លាយផ្លូវការនៃមេរៀន ${options.lesson.title || ''}` : `ស្លាយទី ${slideNum}`),
        rawText: rawTextParts.join('\n')
      });
    }

    return parsedSlides;
  }

  /**
   * Render Slide Elements to HTML
   */
  function renderSlideToHtml(slide, options) {
    if (!slide) return '';
    options = options || {};

    const zoom = options.zoom || 1.0;
    const aspectRatio = slide.aspectRatio || (16 / 9);
    const bgStyle = slide.background && slide.background.css ? slide.background.css : '#ffffff';

    let html = `
      <div class="stms-pptx-stage-wrapper" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; position:relative; overflow:auto; padding:8px;">
        <div class="stms-pptx-canvas-frame" style="position:relative; width:100%; max-width:100%; aspect-ratio:${aspectRatio}; transform: scale(${zoom}); transform-origin: center center; transition: transform 0.15s ease; box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; background:${bgStyle};">
    `;

    // Render elements sorted in document order
    const elements = slide.elements || [];
    elements.forEach((el, elIdx) => {
      const tf = el.transform || { left: 0, top: 0, width: 100, height: 100, rot: 0 };
      const rotStyle = tf.rot ? `transform: rotate(${tf.rot}deg);` : '';

      if (el.type === 'picture') {
        html += `
          <div class="pptx-el pptx-pic" style="position:absolute; left:${tf.left}%; top:${tf.top}%; width:${tf.width}%; height:${tf.height}%; z-index:${elIdx + 1}; ${rotStyle} pointer-events:none; display:flex; align-items:center; justify-content:center;">
            <img src="${el.dataUrl}" alt="Slide Image ${elIdx + 1}" style="width:100%; height:100%; object-fit:contain; display:block;" />
          </div>
        `;
      } else if (el.type === 'shape') {
        const vis = el.visual || {};
        const shapeBg = vis.bgColor ? `background:${vis.bgColor};` : '';
        const shapeBorder = vis.borderWidth > 0 ? `border:${vis.borderWidth}px ${vis.borderStyle} ${vis.borderColor};` : '';
        const shapeRadius = vis.borderRadius ? `border-radius:${vis.borderRadius};` : '';
        const textData = el.textData;

        let contentHtml = '';
        if (textData && textData.paragraphs && textData.paragraphs.length > 0) {
          const vAlignStyle = `justify-content:${textData.vAlign || 'flex-start'};`;

          const pTags = textData.paragraphs.map(p => {
            const alignStyle = `text-align:${p.align || 'left'};`;
            const bulletPrefix = p.isBullet ? `<span style="display:inline-block; margin-right:6px; opacity:0.85;">${escapeHtml(p.bulletChar || '•')}</span>` : '';
            const lvlIndent = p.lvl ? `margin-left: calc(${p.lvl} * 1.5em);` : '';

            const runSpans = p.runs.map(r => {
              if (r.isBr) return '<br/>';
              const boldStyle = r.bold ? 'font-weight:700;' : 'font-weight:400;';
              const italicStyle = r.italic ? 'font-style:italic;' : '';
              const uStyle = r.underline ? 'text-decoration:underline;' : '';
              const strikeStyle = r.strike ? 'text-decoration:line-through;' : '';
              const clrStyle = `color:${r.color || '#1e293b'};`;
              const fontStyle = `font-family:${r.fontFamily || 'inherit'};`;

              // Proportional Font Sizing using cqw (container query width)
              const fontSizeStyle = `font-size: clamp(8px, ${(r.szPt / 7.2).toFixed(2)}cqw, ${Math.round(r.szPt * 2.2)}px); line-height:1.35;`;

              return `<span style="${boldStyle} ${italicStyle} ${uStyle} ${strikeStyle} ${clrStyle} ${fontStyle} ${fontSizeStyle}">${escapeHtml(r.text)}</span>`;
            }).join('');

            return `<div style="${alignStyle} ${lvlIndent} margin: 2px 0;">${bulletPrefix}${runSpans}</div>`;
          }).join('');

          contentHtml = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; ${vAlignStyle} padding: 0.4cqw 0.6cqw; box-sizing:border-box;">
              ${pTags}
            </div>
          `;
        }

        html += `
          <div class="pptx-el pptx-shape" style="position:absolute; left:${tf.left}%; top:${tf.top}%; width:${tf.width}%; height:${tf.height}%; z-index:${elIdx + 1}; ${shapeBg} ${shapeBorder} ${shapeRadius} ${rotStyle} box-sizing:border-box; overflow:hidden;">
            ${contentHtml}
          </div>
        `;
      } else if (el.type === 'table') {
        const cols = el.columns || [];
        const rows = el.rows || [];

        const colGroupHtml = cols.map(c => `<col style="width:${c.widthPercent}%">`).join('');
        const rowsHtml = rows.map(r => {
          const cellsHtml = r.cells.map(c => {
            const cellBg = c.bgColor ? `background:${c.bgColor};` : '';
            let cellTextHtml = '';
            if (c.textData && c.textData.paragraphs) {
              cellTextHtml = c.textData.paragraphs.map(p => {
                const alignStyle = `text-align:${p.align || 'left'};`;
                const runSpans = p.runs.map(rn => {
                  const szStyle = `font-size: clamp(8px, ${(rn.szPt / 7.2).toFixed(2)}cqw, 28px);`;
                  const bStyle = rn.bold ? 'font-weight:700;' : '';
                  const cStyle = `color:${rn.color || '#1e293b'};`;
                  return `<span style="${szStyle} ${bStyle} ${cStyle}">${escapeHtml(rn.text)}</span>`;
                }).join('');
                return `<div style="${alignStyle} margin:1px 0;">${runSpans}</div>`;
              }).join('');
            }
            return `<td style="${cellBg} padding:4px 8px; border:1px solid #cbd5e1; vertical-align:middle;">${cellTextHtml}</td>`;
          }).join('');
          return `<tr>${cellsHtml}</tr>`;
        }).join('');

        html += `
          <div class="pptx-el pptx-table" style="position:absolute; left:${tf.left}%; top:${tf.top}%; width:${tf.width}%; height:${tf.height}%; z-index:${elIdx + 1}; overflow:auto; box-sizing:border-box;">
            <table style="width:100%; height:100%; border-collapse:collapse; table-layout:fixed; font-family:var(--font-khmer, sans-serif);">
              <colgroup>${colGroupHtml}</colgroup>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  // Inject CSS Styles for PPTX Container Queries & Crisp Text
  function injectStylesOnce() {
    if (document.getElementById('stmsPptxViewerStyles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'stmsPptxViewerStyles';
    styleEl.textContent = `
      .stms-pptx-canvas-frame {
        container-type: inline-size;
        user-select: text;
        -webkit-user-select: text;
      }
      .stms-pptx-canvas-frame * {
        box-sizing: border-box;
      }
      .pptx-el {
        transition: opacity 0.2s ease;
      }
      .stms-pptx-stage-wrapper::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .stms-pptx-stage-wrapper::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Auto-inject styles when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStylesOnce);
    } else {
      injectStylesOnce();
    }
  }

  // Public Interface
  const PPTXViewer = {
    parse: parse,
    renderSlide: renderSlideToHtml,
    renderSlideToHtml: renderSlideToHtml,
    toUint8Array: toUint8Array
  };

  window.PPTXViewer = PPTXViewer;

})(typeof window !== 'undefined' ? window : this);
