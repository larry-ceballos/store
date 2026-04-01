export class ZipWriter {
  private files: { name: string; data: Uint8Array; crc32: number }[] = [];
  private crcTable: Uint32Array;

  constructor() {
    this.crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      this.crcTable[i] = c;
    }
  }

  private crc32(data: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
      crc = this.crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
  }

  public addFile(name: string, data: Uint8Array) {
    this.files.push({ name, data, crc32: this.crc32(data) });
  }

  public generate(): Uint8Array {
    let outputData: number[] = [];
    let centralDirectory: number[] = [];
    let centralDirectorySize = 0;
    let centralDirectoryOffset = 0;

    const encoder = new TextEncoder();

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = file.crc32;
      const size = data.length;

      const localHeaderOffset = outputData.length;

      // Local File Header
      const lfh = new Uint8Array(30 + nameBytes.length);
      const lfhView = new DataView(lfh.buffer);
      lfhView.setUint32(0, 0x04034b50, true); // signature
      lfhView.setUint16(4, 20, true); // version needed
      lfhView.setUint16(6, 0, true); // flags
      lfhView.setUint16(8, 0, true); // compression (0 = store)
      lfhView.setUint16(10, 0, true); // mod time
      lfhView.setUint16(12, 0, true); // mod date
      lfhView.setUint32(14, crc, true); // crc32
      lfhView.setUint32(18, size, true); // compressed size
      lfhView.setUint32(22, size, true); // uncompressed size
      lfhView.setUint16(26, nameBytes.length, true); // name length
      lfhView.setUint16(28, 0, true); // extra field length
      lfh.set(nameBytes, 30);

      outputData.push(...lfh);
      outputData.push(...data); // file data

      // Central Directory Header
      const cdh = new Uint8Array(46 + nameBytes.length);
      const cdhView = new DataView(cdh.buffer);
      cdhView.setUint32(0, 0x02014b50, true); // signature
      cdhView.setUint16(4, 20, true); // version made by
      cdhView.setUint16(6, 20, true); // version needed
      cdhView.setUint16(8, 0, true); // flags
      cdhView.setUint16(10, 0, true); // compression
      cdhView.setUint16(12, 0, true); // mod time
      cdhView.setUint16(14, 0, true); // mod date
      cdhView.setUint32(16, crc, true); // crc32
      cdhView.setUint32(20, size, true); // compressed size
      cdhView.setUint32(24, size, true); // uncompressed size
      cdhView.setUint16(28, nameBytes.length, true); // name length
      cdhView.setUint16(30, 0, true); // extra field length
      cdhView.setUint16(32, 0, true); // comment length
      cdhView.setUint16(34, 0, true); // disk number start
      cdhView.setUint16(36, 0, true); // internal file addr
      cdhView.setUint32(38, 0, true); // external file addr
      cdhView.setUint32(42, localHeaderOffset, true); // offset of LFH
      cdh.set(nameBytes, 46);

      centralDirectory.push(...cdh);
      centralDirectorySize += cdh.length;
    }

    centralDirectoryOffset = outputData.length;
    outputData.push(...centralDirectory);

    // End of Central Directory Record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // signature
    eocdView.setUint16(4, 0, true); // disk number
    eocdView.setUint16(6, 0, true); // disk with start of CD
    eocdView.setUint16(8, this.files.length, true); // num entries on this disk
    eocdView.setUint16(10, this.files.length, true); // total entries
    eocdView.setUint32(12, centralDirectorySize, true); // size of CD
    eocdView.setUint32(16, centralDirectoryOffset, true); // offset of CD
    eocdView.setUint16(20, 0, true); // comment length

    outputData.push(...eocd);

    return new Uint8Array(outputData);
  }
}

export async function downloadImagesAsZip(urls: string[], productName: string): Promise<void> {
  const zip = new ZipWriter();
  let counter = 1;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      let ext = "jpg";
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("png")) ext = "png";
      else if (contentType?.includes("webp")) ext = "webp";
      else if (contentType?.includes("avif")) ext = "avif";
      else if (url.includes(".png")) ext = "png";
      else if (url.includes(".webp")) ext = "webp";

      const fileName = `${productName} ${counter}.${ext}`;
      zip.addFile(fileName, new Uint8Array(arrayBuffer));
      counter++;
    } catch (err) {
      console.error("Error fetching image", url, err);
    }
  }

  const zipContent = zip.generate();
  const blob = new Blob([zipContent as any], { type: "application/zip" });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${productName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
