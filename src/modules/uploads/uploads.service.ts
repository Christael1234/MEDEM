import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Thin wrapper around Cloudinary — the file-storage abstraction called out
 * in CLAUDE.md's Phase 0 notes. Swapping providers later means changing
 * this one file, not every caller.
 */
@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  uploadImage(buffer: Buffer, folder: string): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(new InternalServerErrorException(error?.message ?? 'Image upload failed'));
            return;
          }
          resolve({ url: result.secure_url });
        },
      );
      stream.end(buffer);
    });
  }
}
