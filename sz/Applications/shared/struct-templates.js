;(function() {
  'use strict';

  const reg = (window.SZ || (window.SZ = {})).StructEngine.registerTemplate;

  // NOTE: Registration order matters for magic detection — more specific
  // patterns (AVI, ANI) must come before generic ones (RIFF).

  // -----------------------------------------------------------------------
  // AVI (RIFF + AVI specific) — must precede generic RIFF
  // -----------------------------------------------------------------------
  reg('avi', {
    label: 'AVI Video',
    endian: 'le',
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x56, 0x49, 0x20],
    extensions: ['avi'],
    fields: [
      { name: 'ChunkID',    type: 'char[4]', display: 'string' },
      { name: 'ChunkSize',  type: 'uint32',  display: 'dec' },
      { name: 'Format',     type: 'char[4]', display: 'string' },
      { name: 'hdrl List', type: 'struct', children: [
        { name: 'ListID',     type: 'char[4]', display: 'string' },
        { name: 'ListSize',   type: 'uint32',  display: 'dec' },
        { name: 'ListType',   type: 'char[4]', display: 'string' },
        { name: 'avih Chunk', type: 'struct', children: [
          { name: 'ChunkID',            type: 'char[4]', display: 'string' },
          { name: 'ChunkSize',          type: 'uint32',  display: 'dec' },
          { name: 'MicroSecPerFrame',   type: 'uint32',  display: 'dec' },
          { name: 'MaxBytesPerSec',     type: 'uint32',  display: 'dec' },
          { name: 'PaddingGranularity', type: 'uint32',  display: 'dec' },
          { name: 'Flags',              type: 'uint32',  display: 'hex' },
          { name: 'TotalFrames',        type: 'uint32',  display: 'dec' },
          { name: 'InitialFrames',      type: 'uint32',  display: 'dec' },
          { name: 'Streams',            type: 'uint32',  display: 'dec' },
          { name: 'SuggestedBufferSize', type: 'uint32', display: 'dec' },
          { name: 'Width',              type: 'uint32',  display: 'dec' },
          { name: 'Height',             type: 'uint32',  display: 'dec' },
        ]},
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // ANI (Animated Cursor — RIFF + ACON) — must precede generic RIFF
  // -----------------------------------------------------------------------
  reg('ani', {
    label: 'ANI Animated Cursor',
    endian: 'le',
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x43, 0x4F, 0x4E],
    extensions: ['ani'],
    fields: [
      { name: 'ChunkID',    type: 'char[4]', display: 'string' },
      { name: 'ChunkSize',  type: 'uint32',  display: 'dec' },
      { name: 'Format',     type: 'char[4]', display: 'string' },
      { name: 'anih Chunk', type: 'struct', children: [
        { name: 'ChunkID',     type: 'char[4]', display: 'string' },
        { name: 'ChunkSize',   type: 'uint32',  display: 'dec' },
        { name: 'HeaderSize',  type: 'uint32',  display: 'dec' },
        { name: 'NumFrames',   type: 'uint32',  display: 'dec' },
        { name: 'NumSteps',    type: 'uint32',  display: 'dec' },
        { name: 'Width',       type: 'uint32',  display: 'dec' },
        { name: 'Height',      type: 'uint32',  display: 'dec' },
        { name: 'BitCount',    type: 'uint32',  display: 'dec' },
        { name: 'NumPlanes',   type: 'uint32',  display: 'dec' },
        { name: 'DisplayRate', type: 'uint32',  display: 'dec' },
        { name: 'Flags',       type: 'uint32',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // WebP (RIFF + WEBP) — must precede generic RIFF
  // -----------------------------------------------------------------------
  reg('webp', {
    label: 'WebP Image',
    endian: 'le',
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    extensions: ['webp'],
    fields: [
      { name: 'RIFF ID',     type: 'char[4]', display: 'string' },
      { name: 'FileSize',    type: 'uint32',  display: 'dec' },
      { name: 'WEBP ID',     type: 'char[4]', display: 'string' },
      { name: 'ChunkID',     type: 'char[4]', display: 'string' },
      { name: 'ChunkSize',   type: 'uint32',  display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // RIFF / WAV (generic RIFF)
  // -----------------------------------------------------------------------
  reg('riff', {
    label: 'RIFF / WAV',
    endian: 'le',
    magic: [0x52, 0x49, 0x46, 0x46],
    extensions: ['wav', 'riff'],
    fields: [
      { name: 'ChunkID',    type: 'char[4]', display: 'string' },
      { name: 'ChunkSize',  type: 'uint32',  display: 'dec' },
      { name: 'Format',     type: 'char[4]', display: 'string' },
      { name: 'fmt Subchunk', type: 'struct', children: [
        { name: 'SubchunkID',   type: 'char[4]', display: 'string' },
        { name: 'SubchunkSize', type: 'uint32',  display: 'dec' },
        { name: 'AudioFormat',  type: 'uint16',  display: 'enum', enumMap: { 1: 'PCM', 3: 'IEEE Float', 6: 'A-law', 7: 'Mu-law', 0xFFFE: 'Extensible' } },
        { name: 'NumChannels',  type: 'uint16',  display: 'dec' },
        { name: 'SampleRate',   type: 'uint32',  display: 'dec' },
        { name: 'ByteRate',     type: 'uint32',  display: 'dec' },
        { name: 'BlockAlign',   type: 'uint16',  display: 'dec' },
        { name: 'BitsPerSample', type: 'uint16', display: 'dec' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // PNG
  // -----------------------------------------------------------------------
  reg('png', {
    label: 'PNG Image',
    endian: 'be',
    magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    extensions: ['png'],
    fields: [
      { name: 'Signature',    type: 'char[8]', display: 'string' },
      { name: 'IHDR Chunk', type: 'struct', children: [
        { name: 'Length',      type: 'uint32',  display: 'dec' },
        { name: 'Type',        type: 'char[4]', display: 'string' },
        { name: 'Width',       type: 'uint32',  display: 'dec' },
        { name: 'Height',      type: 'uint32',  display: 'dec' },
        { name: 'BitDepth',    type: 'uint8',   display: 'dec' },
        { name: 'ColorType',   type: 'uint8',   display: 'enum', enumMap: { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Gray+Alpha', 6: 'RGBA' } },
        { name: 'Compression', type: 'uint8',   display: 'enum', enumMap: { 0: 'Deflate' } },
        { name: 'Filter',      type: 'uint8',   display: 'enum', enumMap: { 0: 'Adaptive' } },
        { name: 'Interlace',   type: 'uint8',   display: 'enum', enumMap: { 0: 'None', 1: 'Adam7' } },
        { name: 'CRC',         type: 'uint32',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // BMP
  // -----------------------------------------------------------------------
  reg('bmp', {
    label: 'BMP Image',
    endian: 'le',
    magic: [0x42, 0x4D],
    extensions: ['bmp', 'dib'],
    fields: [
      { name: 'Signature',   type: 'char[2]', display: 'string' },
      { name: 'FileSize',    type: 'uint32',  display: 'dec' },
      { name: 'Reserved1',   type: 'uint16',  display: 'hex' },
      { name: 'Reserved2',   type: 'uint16',  display: 'hex' },
      { name: 'DataOffset',  type: 'uint32',  display: 'hex' },
      { name: 'DIB Header',  type: 'struct', children: [
        { name: 'HeaderSize',    type: 'uint32',  display: 'dec' },
        { name: 'Width',         type: 'int32',   display: 'dec' },
        { name: 'Height',        type: 'int32',   display: 'dec' },
        { name: 'Planes',        type: 'uint16',  display: 'dec' },
        { name: 'BitsPerPixel',  type: 'uint16',  display: 'dec' },
        { name: 'Compression',   type: 'uint32',  display: 'enum', enumMap: { 0: 'BI_RGB', 1: 'BI_RLE8', 2: 'BI_RLE4', 3: 'BI_BITFIELDS', 4: 'BI_JPEG', 5: 'BI_PNG' } },
        { name: 'ImageSize',     type: 'uint32',  display: 'dec' },
        { name: 'XPixelsPerM',   type: 'int32',   display: 'dec' },
        { name: 'YPixelsPerM',   type: 'int32',   display: 'dec' },
        { name: 'ColorsUsed',    type: 'uint32',  display: 'dec' },
        { name: 'ColorsImportant', type: 'uint32', display: 'dec' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // JPEG
  // -----------------------------------------------------------------------
  reg('jpeg', {
    label: 'JPEG Image',
    endian: 'be',
    magic: [0xFF, 0xD8, 0xFF],
    extensions: ['jpg', 'jpeg', 'jfif'],
    fields: [
      { name: 'SOI',         type: 'uint16',  display: 'hex' },
      { name: 'APP0 Marker', type: 'uint16',  display: 'hex' },
      { name: 'Length',       type: 'uint16',  display: 'dec' },
      { name: 'Identifier',  type: 'char[5]', display: 'string' },
      { name: 'VersionMajor', type: 'uint8',  display: 'dec' },
      { name: 'VersionMinor', type: 'uint8',  display: 'dec' },
      { name: 'DensityUnits', type: 'uint8',  display: 'enum', enumMap: { 0: 'No units', 1: 'DPI', 2: 'DPCM' } },
      { name: 'XDensity',    type: 'uint16',  display: 'dec' },
      { name: 'YDensity',    type: 'uint16',  display: 'dec' },
      { name: 'ThumbW',      type: 'uint8',   display: 'dec' },
      { name: 'ThumbH',      type: 'uint8',   display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // GIF
  // -----------------------------------------------------------------------
  reg('gif', {
    label: 'GIF Image',
    endian: 'le',
    magic: [0x47, 0x49, 0x46, 0x38],
    extensions: ['gif'],
    fields: [
      { name: 'Signature',  type: 'char[3]', display: 'string' },
      { name: 'Version',    type: 'char[3]', display: 'string' },
      { name: 'Width',      type: 'uint16',  display: 'dec' },
      { name: 'Height',     type: 'uint16',  display: 'dec' },
      { name: 'Packed',     type: 'uint8',   display: 'hex' },
      { name: 'BgColor',    type: 'uint8',   display: 'dec' },
      { name: 'AspectRatio', type: 'uint8',  display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // TIFF (Little Endian)
  // -----------------------------------------------------------------------
  reg('tiff-le', {
    label: 'TIFF Image (LE)',
    endian: 'le',
    magic: [0x49, 0x49, 0x2A, 0x00],
    extensions: ['tif', 'tiff'],
    fields: [
      { name: 'ByteOrder',   type: 'char[2]', display: 'string' },
      { name: 'Magic',       type: 'uint16',  display: 'dec' },
      { name: 'IFD Offset',  type: 'uint32',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // TIFF (Big Endian)
  // -----------------------------------------------------------------------
  reg('tiff-be', {
    label: 'TIFF Image (BE)',
    endian: 'be',
    magic: [0x4D, 0x4D, 0x00, 0x2A],
    extensions: ['tif', 'tiff'],
    fields: [
      { name: 'ByteOrder',   type: 'char[2]', display: 'string' },
      { name: 'Magic',       type: 'uint16',  display: 'dec' },
      { name: 'IFD Offset',  type: 'uint32',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // ICO (Windows Icon)
  // -----------------------------------------------------------------------
  reg('ico', {
    label: 'ICO Icon',
    endian: 'le',
    magic: [0x00, 0x00, 0x01, 0x00],
    extensions: ['ico'],
    fields: [
      { name: 'Reserved',    type: 'uint16',  display: 'dec' },
      { name: 'Type',        type: 'uint16',  display: 'enum', enumMap: { 1: 'Icon', 2: 'Cursor' } },
      { name: 'ImageCount',  type: 'uint16',  display: 'dec' },
      { name: 'Entry 1', type: 'struct', children: [
        { name: 'Width',       type: 'uint8',   display: 'dec' },
        { name: 'Height',      type: 'uint8',   display: 'dec' },
        { name: 'ColorCount',  type: 'uint8',   display: 'dec' },
        { name: 'Reserved',    type: 'uint8',   display: 'dec' },
        { name: 'Planes',      type: 'uint16',  display: 'dec' },
        { name: 'BitCount',    type: 'uint16',  display: 'dec' },
        { name: 'ImageSize',   type: 'uint32',  display: 'dec' },
        { name: 'ImageOffset', type: 'uint32',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // CUR (Windows Cursor)
  // -----------------------------------------------------------------------
  reg('cur', {
    label: 'CUR Cursor',
    endian: 'le',
    magic: [0x00, 0x00, 0x02, 0x00],
    extensions: ['cur'],
    fields: [
      { name: 'Reserved',    type: 'uint16',  display: 'dec' },
      { name: 'Type',        type: 'uint16',  display: 'enum', enumMap: { 1: 'Icon', 2: 'Cursor' } },
      { name: 'ImageCount',  type: 'uint16',  display: 'dec' },
      { name: 'Entry 1', type: 'struct', children: [
        { name: 'Width',       type: 'uint8',   display: 'dec' },
        { name: 'Height',      type: 'uint8',   display: 'dec' },
        { name: 'ColorCount',  type: 'uint8',   display: 'dec' },
        { name: 'Reserved',    type: 'uint8',   display: 'dec' },
        { name: 'XHotspot',    type: 'uint16',  display: 'dec' },
        { name: 'YHotspot',    type: 'uint16',  display: 'dec' },
        { name: 'ImageSize',   type: 'uint32',  display: 'dec' },
        { name: 'ImageOffset', type: 'uint32',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // PCX
  // -----------------------------------------------------------------------
  reg('pcx', {
    label: 'PCX Image',
    endian: 'le',
    magic: [0x0A, null, 0x01],
    extensions: ['pcx'],
    fields: [
      { name: 'Manufacturer', type: 'uint8',  display: 'hex' },
      { name: 'Version',      type: 'uint8',  display: 'enum', enumMap: { 0: 'v2.5', 2: 'v2.8 palette', 3: 'v2.8 no palette', 4: 'Paintbrush for Windows', 5: 'v3.0+' } },
      { name: 'Encoding',     type: 'uint8',  display: 'enum', enumMap: { 0: 'None', 1: 'RLE' } },
      { name: 'BitsPerPixel', type: 'uint8',  display: 'dec' },
      { name: 'XMin',         type: 'uint16', display: 'dec' },
      { name: 'YMin',         type: 'uint16', display: 'dec' },
      { name: 'XMax',         type: 'uint16', display: 'dec' },
      { name: 'YMax',         type: 'uint16', display: 'dec' },
      { name: 'HDpi',         type: 'uint16', display: 'dec' },
      { name: 'VDpi',         type: 'uint16', display: 'dec' },
      { name: 'Colormap',     type: 'uint8',  count: 48, display: 'hex' },
      { name: 'Reserved',     type: 'uint8',  display: 'hex' },
      { name: 'NPlanes',      type: 'uint8',  display: 'dec' },
      { name: 'BytesPerLine', type: 'uint16', display: 'dec' },
      { name: 'PaletteInfo',  type: 'uint16', display: 'enum', enumMap: { 1: 'Color/BW', 2: 'Grayscale' } },
      { name: 'HScreenSize',  type: 'uint16', display: 'dec' },
      { name: 'VScreenSize',  type: 'uint16', display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // MKV / WebM (EBML container)
  // -----------------------------------------------------------------------
  reg('mkv', {
    label: 'MKV / WebM (EBML)',
    endian: 'be',
    magic: [0x1A, 0x45, 0xDF, 0xA3],
    extensions: ['mkv', 'webm', 'mka'],
    fields: [
      { name: 'EBML Header ID', type: 'uint32', display: 'hex' },
      { name: 'HeaderSize',     type: 'uint8',  display: 'dec' },
      { name: 'Header Data', type: 'struct', children: [
        { name: 'EBMLVersion ID',    type: 'uint16', display: 'hex' },
        { name: 'EBMLVersion Size',  type: 'uint8',  display: 'dec' },
        { name: 'EBMLVersion',       type: 'uint8',  display: 'dec' },
        { name: 'ReadVersion ID',    type: 'uint16', display: 'hex' },
        { name: 'ReadVersion Size',  type: 'uint8',  display: 'dec' },
        { name: 'ReadVersion',       type: 'uint8',  display: 'dec' },
        { name: 'MaxIDLength ID',    type: 'uint16', display: 'hex' },
        { name: 'MaxIDLength Size',  type: 'uint8',  display: 'dec' },
        { name: 'MaxIDLength',       type: 'uint8',  display: 'dec' },
        { name: 'MaxSizeLength ID',  type: 'uint16', display: 'hex' },
        { name: 'MaxSizeLength Size', type: 'uint8', display: 'dec' },
        { name: 'MaxSizeLength',     type: 'uint8',  display: 'dec' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // MPEG Program Stream
  // -----------------------------------------------------------------------
  reg('mpeg-ps', {
    label: 'MPEG Program Stream',
    endian: 'be',
    magic: [0x00, 0x00, 0x01, 0xBA],
    extensions: ['mpg', 'mpeg', 'vob'],
    fields: [
      { name: 'PackStartCode', type: 'uint32', display: 'hex' },
      { name: 'SCR Bytes',     type: 'uint8',  count: 6, display: 'hex' },
      { name: 'MuxRate',       type: 'uint8',  count: 3, display: 'hex' },
      { name: 'Stuffing',      type: 'uint8',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // MP3 ID3v2
  // -----------------------------------------------------------------------
  reg('mp3-id3', {
    label: 'MP3 (ID3v2)',
    endian: 'be',
    magic: [0x49, 0x44, 0x33],
    extensions: ['mp3'],
    fields: [
      { name: 'Signature',   type: 'char[3]', display: 'string' },
      { name: 'VersionMajor', type: 'uint8',  display: 'dec' },
      { name: 'VersionMinor', type: 'uint8',  display: 'dec' },
      { name: 'Flags',       type: 'uint8',   display: 'hex' },
      { name: 'Size (syncsafe)', type: 'uint32', display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // PE / MZ (DOS Header)
  // -----------------------------------------------------------------------
  reg('pe', {
    label: 'PE / MZ Executable',
    endian: 'le',
    magic: [0x4D, 0x5A],
    extensions: ['exe', 'dll', 'sys', 'drv', 'ocx', 'scr'],
    fields: [
      { name: 'DOS Header', type: 'struct', children: [
        { name: 'e_magic',    type: 'char[2]', display: 'string' },
        { name: 'e_cblp',     type: 'uint16',  display: 'dec' },
        { name: 'e_cp',       type: 'uint16',  display: 'dec' },
        { name: 'e_crlc',     type: 'uint16',  display: 'dec' },
        { name: 'e_cparhdr',  type: 'uint16',  display: 'dec' },
        { name: 'e_minalloc', type: 'uint16',  display: 'dec' },
        { name: 'e_maxalloc', type: 'uint16',  display: 'dec' },
        { name: 'e_ss',       type: 'uint16',  display: 'hex' },
        { name: 'e_sp',       type: 'uint16',  display: 'hex' },
        { name: 'e_csum',     type: 'uint16',  display: 'hex' },
        { name: 'e_ip',       type: 'uint16',  display: 'hex' },
        { name: 'e_cs',       type: 'uint16',  display: 'hex' },
        { name: 'e_lfarlc',   type: 'uint16',  display: 'hex' },
        { name: 'e_ovno',     type: 'uint16',  display: 'dec' },
        { name: 'e_res',      type: 'uint16',  count: 4, display: 'hex' },
        { name: 'e_oemid',    type: 'uint16',  display: 'hex' },
        { name: 'e_oeminfo',  type: 'uint16',  display: 'hex' },
        { name: 'e_res2',     type: 'uint16',  count: 10, display: 'hex' },
        { name: 'e_lfanew',   type: 'uint32',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // ELF
  // -----------------------------------------------------------------------
  reg('elf', {
    label: 'ELF Executable',
    endian: 'le',
    magic: [0x7F, 0x45, 0x4C, 0x46],
    extensions: ['elf', 'so', 'o'],
    fields: [
      { name: 'e_ident Magic', type: 'char[4]', display: 'string' },
      { name: 'Class',        type: 'uint8',   display: 'enum', enumMap: { 1: '32-bit', 2: '64-bit' } },
      { name: 'Data',         type: 'uint8',   display: 'enum', enumMap: { 1: 'Little Endian', 2: 'Big Endian' } },
      { name: 'Version',      type: 'uint8',   display: 'dec' },
      { name: 'OS/ABI',       type: 'uint8',   display: 'enum', enumMap: { 0: 'System V', 3: 'Linux', 6: 'Solaris', 9: 'FreeBSD' } },
      { name: 'ABI Version',  type: 'uint8',   display: 'dec' },
      { name: 'Padding',      type: 'uint8',   count: 7, display: 'hex' },
      { name: 'Type',         type: 'uint16',  display: 'enum', enumMap: { 1: 'Relocatable', 2: 'Executable', 3: 'Shared Object', 4: 'Core' } },
      { name: 'Machine',      type: 'uint16',  display: 'enum', enumMap: { 3: 'x86', 8: 'MIPS', 0x14: 'PowerPC', 0x28: 'ARM', 0x3E: 'x86-64', 0xB7: 'AArch64', 0xF3: 'RISC-V' } },
      { name: 'Version2',     type: 'uint32',  display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // N64 ROM (big endian / z64 format)
  // -----------------------------------------------------------------------
  reg('n64', {
    label: 'N64 ROM',
    endian: 'be',
    magic: [0x80, 0x37, 0x12, 0x40],
    extensions: ['z64', 'n64'],
    fields: [
      { name: 'PI BSB DOM1',   type: 'uint32',   display: 'hex' },
      { name: 'ClockRate',     type: 'uint32',   display: 'hex' },
      { name: 'ProgramCounter', type: 'uint32',  display: 'hex' },
      { name: 'Release',       type: 'uint32',   display: 'hex' },
      { name: 'CRC1',          type: 'uint32',   display: 'hex' },
      { name: 'CRC2',          type: 'uint32',   display: 'hex' },
      { name: 'Reserved',      type: 'uint8',    count: 8, display: 'hex' },
      { name: 'ImageName',     type: 'char[20]', display: 'string' },
      { name: 'Reserved2',     type: 'uint8',    count: 7, display: 'hex' },
      { name: 'MediaFormat',   type: 'uint8',    display: 'hex' },
      { name: 'CartridgeID',   type: 'char[2]',  display: 'string' },
      { name: 'CountryCode',   type: 'uint8',    display: 'enum', enumMap: { 0x44: 'Germany', 0x45: 'USA', 0x4A: 'Japan', 0x50: 'Europe', 0x55: 'Australia' } },
      { name: 'Version',       type: 'uint8',    display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // ZIP (Local File Header)
  // -----------------------------------------------------------------------
  reg('zip', {
    label: 'ZIP Archive',
    endian: 'le',
    magic: [0x50, 0x4B, 0x03, 0x04],
    extensions: ['zip', 'jar', 'apk'],
    fields: [
      { name: 'Signature',      type: 'uint32',  display: 'hex' },
      { name: 'VersionNeeded',  type: 'uint16',  display: 'dec' },
      { name: 'Flags',          type: 'uint16',  display: 'hex' },
      { name: 'Compression',    type: 'uint16',  display: 'enum', enumMap: { 0: 'Stored', 8: 'Deflated', 14: 'LZMA' } },
      { name: 'ModTime',        type: 'uint16',  display: 'hex' },
      { name: 'ModDate',        type: 'uint16',  display: 'hex' },
      { name: 'CRC32',          type: 'uint32',  display: 'hex' },
      { name: 'CompressedSize', type: 'uint32',  display: 'dec' },
      { name: 'UncompressedSize', type: 'uint32', display: 'dec' },
      { name: 'FilenameLen',    type: 'uint16',  display: 'dec' },
      { name: 'ExtraLen',       type: 'uint16',  display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // TGA (extension-only, no reliable magic)
  // -----------------------------------------------------------------------
  reg('tga', {
    label: 'TGA Image',
    endian: 'le',
    extensions: ['tga', 'icb', 'vda', 'vst'],
    fields: [
      { name: 'IDLength',       type: 'uint8',  display: 'dec' },
      { name: 'ColorMapType',   type: 'uint8',  display: 'enum', enumMap: { 0: 'No Colormap', 1: 'Has Colormap' } },
      { name: 'ImageType',      type: 'uint8',  display: 'enum', enumMap: { 0: 'No Image', 1: 'Colormapped', 2: 'True-Color', 3: 'Grayscale', 9: 'RLE Colormapped', 10: 'RLE True-Color', 11: 'RLE Grayscale' } },
      { name: 'Colormap Spec', type: 'struct', children: [
        { name: 'FirstIndex',   type: 'uint16', display: 'dec' },
        { name: 'Length',       type: 'uint16', display: 'dec' },
        { name: 'EntrySize',    type: 'uint8',  display: 'dec' },
      ]},
      { name: 'Image Spec', type: 'struct', children: [
        { name: 'XOrigin',      type: 'uint16', display: 'dec' },
        { name: 'YOrigin',      type: 'uint16', display: 'dec' },
        { name: 'Width',        type: 'uint16', display: 'dec' },
        { name: 'Height',       type: 'uint16', display: 'dec' },
        { name: 'PixelDepth',   type: 'uint8',  display: 'dec' },
        { name: 'Descriptor',   type: 'uint8',  display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // D64 BAM (C64 disk image — extension-only, header at track 18)
  // -----------------------------------------------------------------------
  reg('d64', {
    label: 'D64 Disk Image (BAM)',
    endian: 'le',
    extensions: ['d64'],
    headerOffset: 0x16500,
    fields: [
      { name: 'DirTrack',      type: 'uint8',   display: 'dec' },
      { name: 'DirSector',     type: 'uint8',   display: 'dec' },
      { name: 'DOSVersion',    type: 'uint8',   display: 'hex' },
      { name: 'Unused',        type: 'uint8',   display: 'hex' },
      { name: 'BAM Track 1',   type: 'uint8',   count: 4, display: 'hex' },
      { name: 'BAM Track 2',   type: 'uint8',   count: 4, display: 'hex' },
      { name: 'BAM Track 3',   type: 'uint8',   count: 4, display: 'hex' },
      { name: 'BAM Track 4',   type: 'uint8',   count: 4, display: 'hex' },
      { name: 'BAM Track 5',   type: 'uint8',   count: 4, display: 'hex' },
      { name: 'BAM Remaining', type: 'uint8',   count: 120, display: 'hex' },
      { name: 'DiskName',      type: 'char[16]', display: 'string' },
      { name: 'Fill1',         type: 'uint8',   count: 2, display: 'hex' },
      { name: 'DiskID',        type: 'char[2]', display: 'string' },
      { name: 'Fill2',         type: 'uint8',   display: 'hex' },
      { name: 'DOSType',       type: 'char[2]', display: 'string' },
    ],
  });

  // -----------------------------------------------------------------------
  // SNES ROM internal header (LoROM at 0x7FC0 — extension-only)
  // -----------------------------------------------------------------------
  reg('sfc', {
    label: 'SNES ROM (LoROM)',
    endian: 'le',
    extensions: ['sfc', 'smc'],
    headerOffset: 0x7FC0,
    fields: [
      { name: 'GameTitle',         type: 'char[21]', display: 'string' },
      { name: 'MapMode',          type: 'uint8',    display: 'hex' },
      { name: 'CartridgeType',    type: 'uint8',    display: 'hex' },
      { name: 'ROMSize',          type: 'uint8',    display: 'enum', enumMap: { 8: '256 KB', 9: '512 KB', 10: '1 MB', 11: '2 MB', 12: '4 MB' } },
      { name: 'RAMSize',          type: 'uint8',    display: 'enum', enumMap: { 0: 'None', 1: '2 KB', 3: '8 KB', 5: '32 KB' } },
      { name: 'Country',          type: 'uint8',    display: 'enum', enumMap: { 0: 'Japan', 1: 'USA', 2: 'Europe', 3: 'Sweden', 6: 'France', 8: 'Spain', 9: 'Germany', 13: 'Korea' } },
      { name: 'Developer',        type: 'uint8',    display: 'hex' },
      { name: 'Version',          type: 'uint8',    display: 'dec' },
      { name: 'ChecksumComplement', type: 'uint16', display: 'hex' },
      { name: 'Checksum',         type: 'uint16',   display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // Sega Genesis / Mega Drive ROM header (at 0x100 — extension-only)
  // -----------------------------------------------------------------------
  reg('smd', {
    label: 'Genesis / Mega Drive ROM',
    endian: 'be',
    extensions: ['smd', 'gen', 'md'],
    headerOffset: 0x100,
    fields: [
      { name: 'ConsoleName',   type: 'char[16]', display: 'string' },
      { name: 'Copyright',     type: 'char[16]', display: 'string' },
      { name: 'DomesticName',  type: 'char[48]', display: 'string' },
      { name: 'OverseasName',  type: 'char[48]', display: 'string' },
      { name: 'SerialNumber',  type: 'char[14]', display: 'string' },
      { name: 'Checksum',      type: 'uint16',   display: 'hex' },
      { name: 'IOSupport',     type: 'char[16]', display: 'string' },
      { name: 'ROMStart',      type: 'uint32',   display: 'hex' },
      { name: 'ROMEnd',        type: 'uint32',   display: 'hex' },
      { name: 'RAMStart',      type: 'uint32',   display: 'hex' },
      { name: 'RAMEnd',        type: 'uint32',   display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // FLAC
  // -----------------------------------------------------------------------
  reg('flac', {
    label: 'FLAC Audio',
    endian: 'be',
    magic: [0x66, 0x4C, 0x61, 0x43],
    extensions: ['flac'],
    fields: [
      { name: 'Signature',      type: 'char[4]', display: 'string' },
      { name: 'STREAMINFO Block', type: 'struct', children: [
        { name: 'BlockType',       type: 'uint8',   display: 'hex' },
        { name: 'BlockLength',     type: 'uint8',   count: 3, display: 'hex' },
        { name: 'MinBlockSize',    type: 'uint16',  display: 'dec' },
        { name: 'MaxBlockSize',    type: 'uint16',  display: 'dec' },
        { name: 'MinFrameSize',    type: 'uint8',   count: 3, display: 'hex' },
        { name: 'MaxFrameSize',    type: 'uint8',   count: 3, display: 'hex' },
        { name: 'SampleRateEtc',   type: 'uint8',   count: 8, display: 'hex' },
        { name: 'MD5',             type: 'uint8',   count: 16, display: 'hex' },
      ]},
    ],
  });

  // -----------------------------------------------------------------------
  // OGG
  // -----------------------------------------------------------------------
  reg('ogg', {
    label: 'OGG Container',
    endian: 'le',
    magic: [0x4F, 0x67, 0x67, 0x53],
    extensions: ['ogg', 'oga', 'ogv', 'ogx'],
    fields: [
      { name: 'CapturePattern', type: 'char[4]', display: 'string' },
      { name: 'Version',        type: 'uint8',   display: 'dec' },
      { name: 'HeaderType',     type: 'uint8',   display: 'hex' },
      { name: 'GranulePosition', type: 'uint64', display: 'dec' },
      { name: 'SerialNumber',   type: 'uint32',  display: 'hex' },
      { name: 'PageSequence',   type: 'uint32',  display: 'dec' },
      { name: 'CRC32',          type: 'uint32',  display: 'hex' },
      { name: 'PageSegments',   type: 'uint8',   display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // GZIP
  // -----------------------------------------------------------------------
  reg('gzip', {
    label: 'GZIP Archive',
    endian: 'le',
    magic: [0x1F, 0x8B],
    extensions: ['gz', 'gzip'],
    fields: [
      { name: 'Magic',          type: 'uint16',  display: 'hex' },
      { name: 'Method',         type: 'uint8',   display: 'enum', enumMap: { 8: 'Deflate' } },
      { name: 'Flags',          type: 'uint8',   display: 'hex' },
      { name: 'ModTime',        type: 'unix32le', display: 'dec' },
      { name: 'ExtraFlags',     type: 'uint8',   display: 'hex' },
      { name: 'OS',             type: 'uint8',   display: 'enum', enumMap: { 0: 'FAT', 3: 'Unix', 7: 'Macintosh', 10: 'NTFS', 11: 'HPFS', 255: 'Unknown' } },
    ],
  });

  // -----------------------------------------------------------------------
  // RAR
  // -----------------------------------------------------------------------
  reg('rar', {
    label: 'RAR Archive',
    endian: 'le',
    magic: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07],
    extensions: ['rar'],
    fields: [
      { name: 'Signature',     type: 'char[4]', display: 'string' },
      { name: 'SigTrail',      type: 'uint8',   count: 2, display: 'hex' },
      { name: 'RarVersion',    type: 'uint8',   display: 'dec' },
      { name: 'HeaderCRC',     type: 'uint16',  display: 'hex' },
      { name: 'HeaderType',    type: 'uint8',   display: 'hex' },
      { name: 'Flags',         type: 'uint16',  display: 'hex' },
      { name: 'HeaderSize',    type: 'uint16',  display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // 7z
  // -----------------------------------------------------------------------
  reg('7z', {
    label: '7-Zip Archive',
    endian: 'le',
    magic: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C],
    extensions: ['7z'],
    fields: [
      { name: 'Signature',        type: 'uint8',  count: 6, display: 'hex' },
      { name: 'VersionMajor',     type: 'uint8',  display: 'dec' },
      { name: 'VersionMinor',     type: 'uint8',  display: 'dec' },
      { name: 'StartHeaderCRC',   type: 'uint32', display: 'hex' },
      { name: 'NextHeaderOffset', type: 'uint64', display: 'hex' },
      { name: 'NextHeaderSize',   type: 'uint64', display: 'dec' },
      { name: 'NextHeaderCRC',    type: 'uint32', display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // Java Class
  // -----------------------------------------------------------------------
  reg('java-class', {
    label: 'Java Class',
    endian: 'be',
    magic: [0xCA, 0xFE, 0xBA, 0xBE],
    extensions: ['class'],
    fields: [
      { name: 'Magic',           type: 'uint32',  display: 'hex' },
      { name: 'MinorVersion',    type: 'uint16',  display: 'dec' },
      { name: 'MajorVersion',    type: 'uint16',  display: 'enum', enumMap: { 45: 'JDK 1.1', 46: 'JDK 1.2', 47: 'JDK 1.3', 48: 'JDK 1.4', 49: 'Java 5', 50: 'Java 6', 51: 'Java 7', 52: 'Java 8', 53: 'Java 9', 55: 'Java 11', 57: 'Java 13', 61: 'Java 17', 65: 'Java 21' } },
      { name: 'ConstantPoolCount', type: 'uint16', display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // Mach-O (32-bit)
  // -----------------------------------------------------------------------
  reg('macho32', {
    label: 'Mach-O (32-bit)',
    endian: 'le',
    magic: [0xCE, 0xFA, 0xED, 0xFE],
    extensions: ['dylib'],
    fields: [
      { name: 'Magic',      type: 'uint32',  display: 'hex' },
      { name: 'CPUType',    type: 'uint32',  display: 'enum', enumMap: { 7: 'x86', 12: 'ARM', 18: 'PowerPC' } },
      { name: 'CPUSubtype', type: 'uint32',  display: 'hex' },
      { name: 'FileType',   type: 'uint32',  display: 'enum', enumMap: { 1: 'Object', 2: 'Executable', 3: 'Fixed VM', 4: 'Core', 5: 'Preloaded', 6: 'Dylib', 7: 'Dylinker', 8: 'Bundle' } },
      { name: 'NumCmds',    type: 'uint32',  display: 'dec' },
      { name: 'SizeCmds',   type: 'uint32',  display: 'dec' },
      { name: 'Flags',      type: 'uint32',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // Mach-O (64-bit)
  // -----------------------------------------------------------------------
  reg('macho64', {
    label: 'Mach-O (64-bit)',
    endian: 'le',
    magic: [0xCF, 0xFA, 0xED, 0xFE],
    fields: [
      { name: 'Magic',      type: 'uint32',  display: 'hex' },
      { name: 'CPUType',    type: 'uint32',  display: 'enum', enumMap: { 0x01000007: 'x86_64', 0x0100000C: 'ARM64' } },
      { name: 'CPUSubtype', type: 'uint32',  display: 'hex' },
      { name: 'FileType',   type: 'uint32',  display: 'enum', enumMap: { 1: 'Object', 2: 'Executable', 3: 'Fixed VM', 4: 'Core', 5: 'Preloaded', 6: 'Dylib', 7: 'Dylinker', 8: 'Bundle' } },
      { name: 'NumCmds',    type: 'uint32',  display: 'dec' },
      { name: 'SizeCmds',   type: 'uint32',  display: 'dec' },
      { name: 'Flags',      type: 'uint32',  display: 'hex' },
      { name: 'Reserved',   type: 'uint32',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // Game Boy ROM (at 0x100)
  // -----------------------------------------------------------------------
  reg('gb', {
    label: 'Game Boy ROM',
    endian: 'le',
    extensions: ['gb', 'gbc'],
    headerOffset: 0x100,
    fields: [
      { name: 'EntryPoint',   type: 'uint8',    count: 4, display: 'hex' },
      { name: 'NintendoLogo', type: 'uint8',    count: 48, display: 'hex' },
      { name: 'Title',        type: 'char[16]', display: 'string' },
      { name: 'NewLicensee',  type: 'char[2]',  display: 'string' },
      { name: 'SGBFlag',      type: 'uint8',    display: 'hex' },
      { name: 'CartridgeType', type: 'uint8',   display: 'enum', enumMap: { 0: 'ROM Only', 1: 'MBC1', 2: 'MBC1+RAM', 3: 'MBC1+RAM+Battery', 5: 'MBC2', 0x0F: 'MBC3+Timer+Battery', 0x10: 'MBC3+Timer+RAM+Battery', 0x11: 'MBC3', 0x19: 'MBC5', 0x1B: 'MBC5+RAM+Battery' } },
      { name: 'ROMSize',      type: 'uint8',    display: 'enum', enumMap: { 0: '32 KB', 1: '64 KB', 2: '128 KB', 3: '256 KB', 4: '512 KB', 5: '1 MB', 6: '2 MB', 7: '4 MB', 8: '8 MB' } },
      { name: 'RAMSize',      type: 'uint8',    display: 'enum', enumMap: { 0: 'None', 1: '2 KB (unused)', 2: '8 KB', 3: '32 KB', 4: '128 KB', 5: '64 KB' } },
      { name: 'DestCode',     type: 'uint8',    display: 'enum', enumMap: { 0: 'Japan', 1: 'International' } },
      { name: 'OldLicensee',  type: 'uint8',    display: 'hex' },
      { name: 'ROMVersion',   type: 'uint8',    display: 'dec' },
      { name: 'HeaderChecksum', type: 'uint8',  display: 'hex' },
      { name: 'GlobalChecksum', type: 'uint16', display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // NES ROM (iNES)
  // -----------------------------------------------------------------------
  reg('nes', {
    label: 'NES ROM (iNES)',
    endian: 'le',
    magic: [0x4E, 0x45, 0x53, 0x1A],
    extensions: ['nes'],
    fields: [
      { name: 'Magic',        type: 'char[4]', display: 'string' },
      { name: 'PRG ROM Size', type: 'uint8',   display: 'dec' },
      { name: 'CHR ROM Size', type: 'uint8',   display: 'dec' },
      { name: 'Flags6',       type: 'uint8',   display: 'hex' },
      { name: 'Flags7',       type: 'uint8',   display: 'hex' },
      { name: 'PRG RAM Size', type: 'uint8',   display: 'dec' },
      { name: 'Flags9',       type: 'uint8',   display: 'hex' },
      { name: 'Flags10',      type: 'uint8',   display: 'hex' },
      { name: 'Padding',      type: 'uint8',   count: 5, display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // MIDI
  // -----------------------------------------------------------------------
  reg('midi', {
    label: 'MIDI',
    endian: 'be',
    magic: [0x4D, 0x54, 0x68, 0x64],
    extensions: ['mid', 'midi'],
    fields: [
      { name: 'ChunkID',    type: 'char[4]', display: 'string' },
      { name: 'ChunkSize',  type: 'uint32',  display: 'dec' },
      { name: 'Format',     type: 'uint16',  display: 'enum', enumMap: { 0: 'Single Track', 1: 'Multi Track', 2: 'Multi Song' } },
      { name: 'NumTracks',  type: 'uint16',  display: 'dec' },
      { name: 'Division',   type: 'uint16',  display: 'hex' },
    ],
  });

  // -----------------------------------------------------------------------
  // SQLite
  // -----------------------------------------------------------------------
  reg('sqlite', {
    label: 'SQLite Database',
    endian: 'be',
    magic: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00],
    extensions: ['sqlite', 'db', 'sqlite3'],
    fields: [
      { name: 'HeaderString', type: 'char[16]', display: 'string' },
      { name: 'PageSize',     type: 'uint16',   display: 'dec' },
      { name: 'WriteVersion', type: 'uint8',    display: 'dec' },
      { name: 'ReadVersion',  type: 'uint8',    display: 'dec' },
      { name: 'ReservedSpace', type: 'uint8',   display: 'dec' },
      { name: 'MaxPayload',   type: 'uint8',    display: 'dec' },
      { name: 'MinPayload',   type: 'uint8',    display: 'dec' },
      { name: 'LeafPayload',  type: 'uint8',    display: 'dec' },
      { name: 'FileChangeCounter', type: 'uint32', display: 'dec' },
      { name: 'DatabaseSize', type: 'uint32',   display: 'dec' },
      { name: 'FreelistPage', type: 'uint32',   display: 'dec' },
      { name: 'FreelistCount', type: 'uint32',  display: 'dec' },
      { name: 'SchemaCookie', type: 'uint32',   display: 'dec' },
      { name: 'SchemaFormat', type: 'uint32',   display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // WASM
  // -----------------------------------------------------------------------
  reg('wasm', {
    label: 'WebAssembly',
    endian: 'le',
    magic: [0x00, 0x61, 0x73, 0x6D],
    extensions: ['wasm'],
    fields: [
      { name: 'Magic',     type: 'uint32', display: 'hex' },
      { name: 'Version',   type: 'uint32', display: 'dec' },
    ],
  });

  // -----------------------------------------------------------------------
  // PSD (Adobe Photoshop)
  // -----------------------------------------------------------------------
  reg('psd', {
    label: 'PSD / PSB',
    endian: 'be',
    magic: [0x38, 0x42, 0x50, 0x53],
    extensions: ['psd', 'psb'],
    fields: [
      { name: 'Signature',  type: 'char[4]', display: 'string' },
      { name: 'Version',    type: 'uint16',  display: 'enum', enumMap: { 1: 'PSD', 2: 'PSB' } },
      { name: 'Reserved',   type: 'uint8',   count: 6, display: 'hex' },
      { name: 'Channels',   type: 'uint16',  display: 'dec' },
      { name: 'Height',     type: 'uint32',  display: 'dec' },
      { name: 'Width',      type: 'uint32',  display: 'dec' },
      { name: 'BitDepth',   type: 'uint16',  display: 'dec' },
      { name: 'ColorMode',  type: 'uint16',  display: 'enum', enumMap: { 0: 'Bitmap', 1: 'Grayscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab' } },
    ],
  });

  // -----------------------------------------------------------------------
  // PDF
  // -----------------------------------------------------------------------
  reg('pdf', {
    label: 'PDF Document',
    endian: 'be',
    magic: [0x25, 0x50, 0x44, 0x46],
    extensions: ['pdf'],
    fields: [
      { name: 'Magic',     type: 'char[4]', display: 'string' },
      { name: 'Dash',      type: 'char[1]', display: 'string' },
      { name: 'VerMajor',  type: 'char[1]', display: 'string' },
      { name: 'Dot',       type: 'char[1]', display: 'string' },
      { name: 'VerMinor',  type: 'char[1]', display: 'string' },
    ],
  });

  // -----------------------------------------------------------------------
  // TAR (USTAR — magic at offset 257)
  // -----------------------------------------------------------------------
  reg('tar', {
    label: 'TAR Archive (USTAR)',
    endian: 'le',
    extensions: ['tar'],
    fields: [
      { name: 'FileName',       type: 'char[100]', display: 'string' },
      { name: 'FileMode',       type: 'char[8]',   display: 'string' },
      { name: 'OwnerUID',       type: 'char[8]',   display: 'string' },
      { name: 'GroupGID',       type: 'char[8]',   display: 'string' },
      { name: 'FileSize',       type: 'char[12]',  display: 'string' },
      { name: 'ModTime',        type: 'char[12]',  display: 'string' },
      { name: 'Checksum',       type: 'char[8]',   display: 'string' },
      { name: 'TypeFlag',       type: 'char[1]',   display: 'string' },
      { name: 'LinkName',       type: 'char[100]', display: 'string' },
      { name: 'USTARMagic',     type: 'char[6]',   display: 'string', offset: 257 },
      { name: 'USTARVersion',   type: 'char[2]',   display: 'string' },
      { name: 'OwnerName',      type: 'char[32]',  display: 'string' },
      { name: 'GroupName',      type: 'char[32]',  display: 'string' },
    ],
  });

})();
