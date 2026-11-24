"""Laptop matching key: brand, series, CPU, GPU, RAM and SSD.

Store titles for the same laptop differ in everything else (SKU codes like 82X5..., NX.HZRER.004,
regional suffixes, colour, screen marketing words), so the generic key that takes every code
almost never matched laptops across stores. These six fields are written by every store and
together pin down a model closely enough to compare prices.
"""
import re

BRANDS = ['apple', 'lenovo', 'acer', 'asus', 'hp', 'dell', 'huawei', 'honor', 'xiaomi', 'redmi', 'msi', 'gigabyte',
          'samsung', 'microsoft', 'infinix', 'tecno', 'chuwi', 'machenike', 'thunderobot', 'avita', 'jumper', 'gateway']
# series words per brand, longest first; the first one found in the title is the series
SERIES = {
    'apple': ['macbook air', 'macbook pro', 'macbook neo', 'macbook'],
    'lenovo': ['ideapad slim 5', 'ideapad slim 3', 'ideapad slim 1', 'ideapad flex 5', 'ideapad gaming', 'ideapad pro', 'ideapad 5',
               'ideapad 3', 'ideapad 1', 'ideapad', 'ip3', 'ip5', 'ip1', 'thinkpad', 'thinkbook', 'legion', 'loq', 'yoga', 'v14', 'v15', 'v17'],
    'acer': ['al15', 'al16', 'a315', 'a515', 'a715', 'a15', 'a16', 'aspire lite', 'aspire go', 'aspire 3', 'aspire 5', 'aspire 7', 'aspire', 'nitro lite', 'nitro v', 'nitro', 'predator',
             'swift', 'extensa', 'travelmate', 'chromebook'],
    'asus': ['vivobook go', 'vivobook s', 'vivobook pro', 'vivobook x', 'vivobook', 'zenbook', 'tuf', 'rog', 'expertbook', 'e1504', 'e1404', 'x1504', 'x1404'],
    'hp': ['pavilion', 'victus', 'omen', 'probook', 'elitebook', 'omnibook', 'envy', 'spectre', '250', '255', '240', '15s', '15', '14'],
    'dell': ['inspiron', 'vostro', 'latitude', 'xps', 'alienware', 'g15', 'g16', 'dc15250', 'dell 15'],
    'huawei': ['matebook d 16', 'matebook d 14', 'matebook d16', 'matebook d14', 'matebook'],
    'honor': ['magicbook'], 'xiaomi': ['redmibook', 'redmi book', 'mi notebook'], 'redmi': ['redmibook', 'redmi book'],
    'msi': ['katana', 'cyborg', 'thin', 'modern', 'prestige', 'sword', 'raider', 'stealth', 'bravo', 'pulse', 'vector', 'crosshair'],
}
ALIAS = {'ip3': 'ideapad slim 3', 'ip5': 'ideapad slim 5', 'ip1': 'ideapad 1', 'redmi book': 'redmibook', 'matebook d 16': 'matebook d16',
         'matebook d 14': 'matebook d14', 'e1504': 'vivobook go', 'e1404': 'vivobook go', 'x1504': 'vivobook', 'x1404': 'vivobook',
         'dell 15': 'dc15250', 'nitro v': 'nitro', 'al15': 'aspire lite', 'al16': 'aspire lite', 'a315': 'aspire 3',
         'a515': 'aspire 5', 'a715': 'aspire 7', 'a15': 'aspire 15', 'a16': 'aspire 16'}

CPU = [
    r'\b(?:core\s*)?(i[3579])[\s-]*(\d{4,5}[a-z]{0,2})\b',           # i5-13420H
    r'\bcore\s*(?:ultra\s*)?([3579])[\s-]*(\d{3}[a-z]{0,2})\b',      # Core 5-120U, Core Ultra 7 155H
    r'\b(?:ryzen\s*|r)([3579])[\s-]*(\d{4}[a-z]{0,2})\b',             # Ryzen 5 7520U, R5-5625U
    r'\b(?:ryzen\s*)(ai\s*\d)[\s-]*(\d{3}[a-z]{0,2})\b',
    r'\b(?:celeron\s*)?(n)(\d{4})\b',                                 # N4500
    r'\b(?:core\s*)?(i3)[\s-]*(n\d{3})\b',                            # i3-N305
    r'\bathlon\s*(?:silver\s*|gold\s*)?(\d)?\s*(\d{4}[a-z]?)\b',
    r'\b(m[1-5])(?:\s*(pro|max))?\b',                                  # Apple M4 / M4 Pro
    r'\b(a1[89])\s*(pro)\b',                                           # Apple A18 Pro
]


def _cpu(t):
    for rx in CPU:
        m = re.search(rx, t)
        if m:
            return ''.join(g for g in m.groups() if g).replace(' ', '')
    return ''


def _ram_ssd(t):
    """RAM and storage in GB. Accepts '16GB / SSD 512GB', '16/512', '8 ГБ / SSD 512 ГБ', '16GB 1TB'."""
    t = t.replace('гб', 'gb').replace('тб', 'tb').replace('sdd', 'ssd')
    m = re.search(r'(?<![\d.])(4|8|12|16|18|24|32|36|48|64)\s*/\s*(128|256|512|1024|2048|1|2)\s*(tb|gb)?\b', t)
    if m:
        ssd = int(m.group(2)); ssd = ssd * 1024 if ssd <= 2 else ssd
        return int(m.group(1)), ssd
    sizes = [(int(n), u) for n, u in re.findall(r'(?<![\d.])(\d{1,4})\s*(gb|tb)\b', t)]
    ram = next((n for n, u in sizes if u == 'gb' and n in (4, 8, 12, 16, 18, 24, 32, 36, 48, 64)), 0)
    ssd = next((n * 1024 if u == 'tb' else n for n, u in sizes if (u == 'tb' and n <= 8) or (u == 'gb' and n >= 128)), 0)
    return ram, ssd


def _gpu(t):
    m = re.search(r'\b(rtx|gtx)\s*-?\s*(\d{4})\b', t)
    return f'{m.group(1)}{m.group(2)}' if m else ''


USED = r'п/г|б/у|\bb/u\b|no box|без коробк|refurb|восстановл|уценк'

def laptop_key(title):
    t = ' ' + title.lower().replace('ё', 'е') + ' '
    if re.search(USED, t):
        return None  # used / open-box units are not the same offer as a new laptop
    t = re.sub(r'[(),;|]', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    brand = next((b for b in BRANDS if re.search(rf'\b{b}\b', t)), '')
    if not brand and re.search(r'\bmacbook\b', t):
        brand = 'apple'
    if not brand:
        return None
    # a series ending in a digit may run into the generation ("V15G4", "IdeaPad 3 15IAU7"): only refuse a following digit
    series = next((s for s in SERIES.get(brand, []) if re.search(rf'\b{re.escape(s)}' + (r'(?!\d)' if s[-1].isdigit() else r'\b'), t)), '')
    series = ALIAS.get(series, series)
    cpu = _cpu(t)
    if not cpu and series == 'macbook neo':
        cpu = 'a18pro'  # every MacBook Neo has the A18 Pro; some stores leave it out
    ram, ssd = _ram_ssd(t)
    if not (cpu and ram and ssd):
        return None  # without these the title is too vague to compare against other stores
    gpu = _gpu(t)
    if brand == 'apple':
        size = re.search(r'\b(13|14|15|16)(?:[.,]\d)?\s*(?:"|”|-inch|inch|дюйм|\b)', t)
        series = (series or 'macbook') + (size.group(1) if size and series != 'macbook neo' else '')
    return f"{brand}:{series.replace(' ', '')}:{cpu}{'+' + gpu if gpu else ''}:{ram}-{ssd}"
