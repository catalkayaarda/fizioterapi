import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";

export type UploadableFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export type StoredFile = {
  fileUrl: string;
  originalName: string;
  mimeType: string;
};

@Injectable()
export class StorageService {
  private readonly uploadRoot = join(process.cwd(), "uploads");

  async save(file: UploadableFile, folder: string): Promise<StoredFile> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9-_]/g, "-");
    const targetDir = join(this.uploadRoot, safeFolder);
    await mkdir(targetDir, { recursive: true });

    const extension = extname(file.originalname);
    const fileName = randomUUID() + extension;
    await writeFile(join(targetDir, fileName), file.buffer);

    return {
      fileUrl: "/uploads/" + safeFolder + "/" + fileName,
      originalName: file.originalname,
      mimeType: file.mimetype
    };
  }
}
