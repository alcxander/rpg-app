// TS augmentation to satisfy fabric.Canvas.setBackgroundImage types in Fabric v6.
// Keep this file in your repo so tsc picks it up.
import type * as Fabric from 'fabric';

declare module 'fabric' {
  // augment the exported namespace
  namespace fabric {
    interface Canvas {
      setBackgroundImage(
        image: string | HTMLImageElement | fabric.Image,
        callback?: (img: fabric.Image | HTMLImageElement) => void,
        options?: {
          originX?: string;
          originY?: string;
          left?: number;
          top?: number;
          scaleX?: number;
          scaleY?: number;
          [key: string]: any;
        }
      ): void;
    }
  }
}
